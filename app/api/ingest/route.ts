import { NextResponse } from "next/server";

import { buildAgentContext } from "@/lib/agents/shared";
import {
  ensureParsedSessionState,
  resolveUrlThroughDecodo
} from "@/lib/agents/workers/source-ingest";
import { getStorage } from "@/lib/storage";
import { fetchAndCleanJobUrl } from "@/lib/tools/fetch-job-url";
import { extractTextFromUpload } from "@/lib/tools/parse-resume";
import type { SessionRecord, SourceDocument } from "@/lib/schemas";
import { rebuildSessionSourceState } from "@/lib/tools/source-manager";
import { buildSourceDocument, createChatMessage } from "@/lib/tools/session-state";
import { deriveUrlSourceTitle } from "@/lib/tools/source-input";
import { toPublicErrorMessage } from "@/lib/utils/public-error";
import { makeId } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const resumeEntry = formData.get("resume");
    const resumeText = String(formData.get("resumeText") ?? "").trim();
    const jobText = String(formData.get("jobText") ?? "").trim();
    const jobUrl = String(formData.get("jobUrl") ?? "").trim();

    const sources: SourceDocument[] = [];
    const notes: string[] = [];

    if (resumeEntry instanceof File) {
      const parsed = await extractTextFromUpload(resumeEntry);
      if (parsed.text.trim()) {
        sources.push(
          buildSourceDocument({
            title: parsed.filename || "Uploaded resume",
            kind: "truth",
            type: "resume",
            content: parsed.text,
            metadata: {
              filename: parsed.filename,
              mimeType: parsed.mimeType
            },
            active: true
          })
        );
      }
    } else if (resumeText) {
      sources.push(
        buildSourceDocument({
          title: "Pasted resume",
          kind: "truth",
          type: "resume",
          content: resumeText,
          active: true
        })
      );
    }

    if (jobText) {
      sources.push(
        buildSourceDocument({
          title: "Job description",
          kind: "opportunity",
          type: "job_description",
          content: jobText
        })
      );
    }

    if (jobUrl) {
      const resolved = await resolveUrlThroughDecodo(jobUrl, "url");
      const fetched =
        resolved?.content.trim()
          ? {
              content: resolved.content,
              preview: resolved.preview ?? "",
              metadata: resolved.metadata ?? {}
            }
          : await fetchAndCleanJobUrl(jobUrl);

      if (fetched.content.trim()) {
        const fetchedMetadata =
          "metadata" in fetched && fetched.metadata ? fetched.metadata : {};
        sources.push(
          buildSourceDocument({
            title:
              "title" in fetched && typeof fetched.title === "string"
                ? fetched.title
                : deriveUrlSourceTitle(jobUrl, "url"),
            kind: "opportunity",
            type: "url",
            content: fetched.content,
            preview: fetched.preview,
            metadata: {
              ...fetchedMetadata,
              url: jobUrl
            }
          })
        );
      } else if ("error" in fetched) {
        notes.push(`Job URL fetch fallback: ${fetched.error}`);
      }
    }

    if (!sources.length) {
      return NextResponse.json(
        { error: "Add at least a resume or role source to create a session." },
        { status: 400 }
      );
    }

    const sessionId = makeId("session");
    const session: SessionRecord = {
      id: sessionId,
      title:
        sources.find((source) => source.type === "job_description" || source.kind === "opportunity")
          ?.title ??
        sources.find((source) => source.type === "resume")?.title ??
        "CareerFlow session",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeResumeSourceId:
        sources.find((source) => source.type === "resume" && source.active)?.id ?? null,
      savedOpportunitySourceIds: [],
      selectedOpportunitySourceId:
        sources.find((source) => source.kind === "opportunity")?.id ?? null,
      parsedResumeProfile: null,
      selectedOpportunityProfile: null,
      savedJobSearchResults: [],
      candidateProfile: null,
      jobProfile: null,
      jobProfiles: [],
      matchReport: null,
      matchReports: [],
      artifacts: [],
      plan: null,
      workflowTrace: [],
      sources,
      sourceManifest: sources,
      chatHistory: [
        createChatMessage({
          role: "assistant",
          content:
            "Your sources are loaded. Ask anything about fit, resume tailoring, outreach, interview prep, or whether this role is worth applying to."
        })
      ],
      jobSearchResults: [],
      notes
    };

    const storage = getStorage();
    await storage.saveSession(session);
    const rebuilt = await rebuildSessionSourceState(session);
    const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
    await ensureParsedSessionState(context, {
      preferredOpportunitySourceId:
        rebuilt.session.selectedOpportunitySourceId ?? undefined
    });
    await storage.saveSession(rebuilt.session);

    return NextResponse.json({
      sessionId,
      sourceManifest: rebuilt.session.sources,
      sources: rebuilt.session.sources
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toPublicErrorMessage(error, "Unable to ingest files.")
      },
      { status: 500 }
    );
  }
}
