import { NextResponse } from "next/server";

import { getStorage } from "@/lib/storage";
import { chunkDocument } from "@/lib/tools/chunk";
import { embedChunks } from "@/lib/tools/embed";
import { fetchAndCleanJobUrl } from "@/lib/tools/fetch-job-url";
import { extractTextFromUpload } from "@/lib/tools/parse-resume";
import type { IndexedChunk, SessionRecord, SourceDocument } from "@/lib/schemas";
import { makeId, truncate } from "@/lib/utils";

function createSource(input: {
  title: string;
  kind: SourceDocument["kind"];
  subtype: SourceDocument["subtype"];
  content: string;
  preview?: string;
  metadata?: SourceDocument["metadata"];
}) {
  return {
    id: makeId("source"),
    title: input.title,
    kind: input.kind,
    subtype: input.subtype,
    content: input.content,
    preview: input.preview ?? truncate(input.content, 240),
    createdAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
    chunkIds: []
  } satisfies SourceDocument;
}

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
          createSource({
            title: parsed.filename || "Uploaded resume",
            kind: "truth",
            subtype: "resume",
            content: parsed.text,
            metadata: {
              filename: parsed.filename,
              mimeType: parsed.mimeType
            }
          })
        );
      }
    } else if (resumeText) {
      sources.push(
        createSource({
          title: "Pasted resume",
          kind: "truth",
          subtype: "resume",
          content: resumeText
        })
      );
    }

    if (jobText) {
      sources.push(
        createSource({
          title: "Job description",
          kind: "opportunity",
          subtype: "job_description",
          content: jobText
        })
      );
    }

    if (jobUrl) {
      const fetched = await fetchAndCleanJobUrl(jobUrl);
      if (fetched.content.trim()) {
        sources.push(
          createSource({
            title: "Parsed job URL",
            kind: "opportunity",
            subtype: "job_url",
            content: fetched.content,
            preview: fetched.preview,
            metadata: {
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
    const chunks: IndexedChunk[] = [];

    sources.forEach((source) => {
      const docChunks = chunkDocument(source);
      source.chunkIds = docChunks.map((chunk) => chunk.id);
      source.metadata.chunkCount = docChunks.length;
      chunks.push(...docChunks);
    });

    const embeddedChunks = await embedChunks(chunks);
    const session: SessionRecord = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      candidateProfile: null,
      jobProfile: null,
      matchReport: null,
      artifacts: [],
      plan: null,
      workflowTrace: [],
      sourceManifest: sources,
      notes
    };

    const storage = getStorage();
    await storage.saveSourceDocuments(sessionId, sources);
    await storage.saveChunkIndex(sessionId, embeddedChunks);
    await storage.saveSession(session);

    return NextResponse.json({
      sessionId,
      sourceManifest: sources
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to ingest files."
      },
      { status: 500 }
    );
  }
}
