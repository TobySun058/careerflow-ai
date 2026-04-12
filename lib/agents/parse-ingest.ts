import type { AgentContext } from "@/lib/agents/shared";
import { buildAgentContext, buildArtifact, makeTraceStep, upsertArtifact } from "@/lib/agents/shared";
import { DecodoMcpClient } from "@/lib/mcp/decodo/client";
import { ResumeOptimizerProMcpClient } from "@/lib/mcp/resume-optimizer-pro/client";
import type { JobSearchResult, SessionRecord, SourceDocument } from "@/lib/schemas";
import { getStorage } from "@/lib/storage";
import { parseJobDescription } from "@/lib/tools/parse-job";
import { parseResume } from "@/lib/tools/parse-resume";
import { rebuildSessionSourceState, getSessionSources } from "@/lib/tools/source-manager";
import {
  getActiveResumeSource,
  getOpportunitySources,
  getSelectedOpportunitySource,
  markOpportunitySourceSaved,
  setActiveResumeSource,
  setParsedResumeProfile,
  setSelectedOpportunityProfile,
  setSessionSources,
  upsertJobProfileSnapshot
} from "@/lib/tools/session-state";
import { deriveUrlSourceTitle, parseSourceFromFormData } from "@/lib/tools/source-input";
import { buildSourceDocument } from "@/lib/tools/session-state";
import { fetchAndCleanJobUrl } from "@/lib/tools/fetch-job-url";

function appendNote(session: SessionRecord, note: string) {
  session.notes = [...session.notes, note].filter(Boolean).slice(-6);
}

function summarizeResumeProfile(session: SessionRecord) {
  const profile = session.parsedResumeProfile;
  const activeResume = getActiveResumeSource(session);

  if (!profile) {
    return "No grounded resume profile is available yet.";
  }

  return [
    activeResume ? `Active resume: ${activeResume.title}` : "",
    profile.summary ? `Summary: ${profile.summary}` : "",
    profile.skills.length
      ? `Top skills: ${profile.skills.slice(0, 10).join(", ")}`
      : "",
    profile.experience.length
      ? `Recent roles: ${profile.experience
          .slice(0, 3)
          .map((item) =>
            [item.title, item.company ? `at ${item.company}` : ""]
              .filter(Boolean)
              .join(" ")
          )
          .join("; ")}`
      : "",
    profile.education.length
      ? `Education: ${profile.education
          .slice(0, 2)
          .map((item) => [item.school, item.degree ?? ""].filter(Boolean).join(" "))
          .join("; ")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export async function resolveUrlThroughDecodo(
  url: string,
  sourceType: SourceDocument["type"],
  title?: string
) {
  const decodo = new DecodoMcpClient();
  if (!decodo.isConfigured()) {
    return null;
  }

  try {
    const extracted = await decodo.extractStructuredText(url);
    return {
      title:
        extracted.title && extracted.title !== url
          ? extracted.title
          : deriveUrlSourceTitle(url, sourceType, title),
      content: extracted.content,
      preview: extracted.preview,
      metadata: {
        url,
        provider: "decodo_mcp"
      },
      notes: [`Decodo MCP extracted content for ${url}.`]
    };
  } catch (error) {
    return {
      title: deriveUrlSourceTitle(url, sourceType, title),
      content: "",
      preview: "",
      metadata: {
        url
      },
      notes: [
        error instanceof Error
          ? `Decodo MCP fallback: ${error.message}`
          : "Decodo MCP fallback triggered."
      ]
    };
  }
}

async function parseResumeIntoSession(
  context: AgentContext,
  options?: {
    preferredResumeSourceId?: string | null;
    truthSourceIds?: string[];
  }
) {
  if (options?.preferredResumeSourceId) {
    setActiveResumeSource(context.session, options.preferredResumeSourceId);
  }

  const activeResume = getActiveResumeSource(context.session);
  const selectedTruthIds = new Set(options?.truthSourceIds ?? []);
  if (activeResume && selectedTruthIds.size) {
    selectedTruthIds.add(activeResume.id);
  }
  const truthSources = getSessionSources(context.session).filter((source) => {
    if (source.kind !== "truth") {
      return false;
    }

    if (!selectedTruthIds.size) {
      return true;
    }

    return selectedTruthIds.has(source.id);
  });

  if (!activeResume || !truthSources.length) {
    setParsedResumeProfile(context.session, null);
    return null;
  }

  const truthChunks = context.chunks.filter((chunk) => {
    if (chunk.kind !== "truth") {
      return false;
    }

    if (!selectedTruthIds.size) {
      return true;
    }

    return selectedTruthIds.has(chunk.sourceId);
  });
  const resumeOptimizer = new ResumeOptimizerProMcpClient();
  let profile = null;
  let parserLabel = "local parser";

  if (resumeOptimizer.isConfigured()) {
    try {
      const parsed = await resumeOptimizer.parseResume({
        text: activeResume.content,
        title: activeResume.title
      });
      if (parsed.candidateProfile) {
        profile = parsed.candidateProfile;
        parserLabel = "Resume Optimizer Pro MCP";
      }
    } catch (error) {
      appendNote(
        context.session,
        error instanceof Error
          ? `Resume Optimizer Pro fallback: ${error.message}`
          : "Resume Optimizer Pro fallback triggered."
      );
    }
  }

  if (!profile) {
    const local = await parseResume({
      text: truthSources.map((source) => source.content).join("\n\n"),
      chunks: truthChunks
    });
    profile = local.candidateProfile;
  }

  setParsedResumeProfile(context.session, profile);
  context.session.activeResumeSourceId = activeResume.id;

  const artifact = await buildArtifact({
    type: "parsed_resume_summary",
    title: "Parsed Resume Summary",
    content: summarizeResumeProfile(context.session),
    editable: false,
    chunks: context.chunks,
    session: context.session
  });
  upsertArtifact(context.session.artifacts, artifact);

  context.updateTrace(
    makeTraceStep(
      "ParseIngestAgent",
      `Parsed the active resume using ${parserLabel}.`,
      "completed",
      [artifact.id],
      [
        parserLabel === "Resume Optimizer Pro MCP" ? "ResumeOptimizerProMcp.parseResume" : "parseResume",
        "rebuildSessionSourceState",
        "buildArtifact"
      ]
    )
  );

  return artifact;
}

async function parseOpportunityIntoSession(
  context: AgentContext,
  preferredSourceId?: string | null,
  opportunitySourceIds?: string[]
) {
  const selectedOpportunityIds = new Set(opportunitySourceIds ?? []);
  const candidateOpportunitySources = getOpportunitySources(context.session).filter((source) => {
    if (!selectedOpportunityIds.size) {
      return true;
    }

    return selectedOpportunityIds.has(source.id);
  });
  const selectedSource =
    candidateOpportunitySources.find((source) => source.id === preferredSourceId) ??
    getSelectedOpportunitySource(context.session, preferredSourceId ?? undefined);
  const opportunitySources = selectedSource
    ? candidateOpportunitySources.length
      ? candidateOpportunitySources
      : getOpportunitySources(context.session).filter((source) => source.id === selectedSource.id)
    : [];

  if (!selectedSource || !opportunitySources.length) {
    setSelectedOpportunityProfile(context.session, null, null);
    return null;
  }

  const selectedSourceIds = new Set(opportunitySources.map((source) => source.id));
  const opportunityChunks = context.chunks.filter((chunk) =>
    selectedSourceIds.has(chunk.sourceId)
  );
  const { jobProfile } = await parseJobDescription({
    text: opportunitySources.map((source) => source.content).join("\n\n"),
    chunks: opportunityChunks
  });

  setSelectedOpportunityProfile(context.session, jobProfile, selectedSource.id);
  upsertJobProfileSnapshot(context.session, jobProfile);
  context.updateTrace(
    makeTraceStep(
      "ParseIngestAgent",
      `Parsed the selected opportunity context from ${selectedSource.title}.`,
      "completed",
      [],
      ["parseJobDescription", "rebuildSessionSourceState"]
    )
  );

  return jobProfile;
}

export async function ensureParsedSessionState(
  context: AgentContext,
  options?: {
    preferredResumeSourceId?: string | null;
    preferredOpportunitySourceId?: string | null;
    truthSourceIds?: string[];
    opportunitySourceIds?: string[];
  }
) {
  const artifacts = [];

  const resumeArtifact = await parseResumeIntoSession(context, {
    preferredResumeSourceId: options?.preferredResumeSourceId ?? undefined,
    truthSourceIds: options?.truthSourceIds
  });
  if (resumeArtifact) {
    artifacts.push(resumeArtifact);
  }

  await parseOpportunityIntoSession(
    context,
    options?.preferredOpportunitySourceId ?? undefined,
    options?.opportunitySourceIds
  );

  return {
    parsedResumeProfile: context.session.parsedResumeProfile,
    selectedOpportunityProfile: context.session.selectedOpportunityProfile,
    artifacts
  };
}

async function loadSession(sessionId: string) {
  const storage = getStorage();
  const session = await storage.getSession(sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  return { storage, session };
}

function buildSourceUpdateNote(source: SourceDocument, action: "added" | "replaced" | "removed") {
  if (action === "added") {
    return `${source.title} was added. The session was re-indexed and reparsed.`;
  }

  if (action === "replaced") {
    return `${source.title} is now the active resume. The session was re-indexed and reparsed.`;
  }

  return `${source.title} was removed. Derived outputs were cleared and rebuilt where possible.`;
}

export async function addSourceToSession(sessionId: string, formData: FormData) {
  const { storage, session } = await loadSession(sessionId);
  const { source, notes } = await parseSourceFromFormData(formData, {
    resolveUrl: resolveUrlThroughDecodo
  });

  if (!source) {
    throw new Error("Provide a file, text body, or URL to add a source.");
  }

  const nextSources = getSessionSources(session).map((item) => ({
    ...item,
    active: source.type === "resume" ? false : item.active
  }));
  nextSources.push(source);
  setSessionSources(session, nextSources);

  if (source.type === "resume") {
    setActiveResumeSource(session, source.id);
  }
  if (source.kind === "opportunity") {
    session.selectedOpportunitySourceId = source.id;
  }

  notes.forEach((note) => appendNote(session, note));
  const rebuilt = await rebuildSessionSourceState(session, {
    resetDerived: true,
    note: buildSourceUpdateNote(source, "added")
  });
  const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
  await ensureParsedSessionState(context, {
    preferredOpportunitySourceId: source.kind === "opportunity" ? source.id : undefined
  });
  await storage.saveSession(rebuilt.session);

  return {
    session: rebuilt.session,
    source
  };
}

export async function replaceResumeInSession(
  sessionId: string,
  formData: FormData
) {
  const { storage, session } = await loadSession(sessionId);
  const sourceId = String(formData.get("sourceId") ?? "").trim();

  if (sourceId) {
    setActiveResumeSource(session, sourceId);
    const rebuilt = await rebuildSessionSourceState(session, {
      resetDerived: true,
      note: "Active resume changed. Grounded outputs were rebuilt."
    });
    const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
    await ensureParsedSessionState(context);
    await storage.saveSession(rebuilt.session);
    return { session: rebuilt.session };
  }

  const { source, notes } = await parseSourceFromFormData(formData, {
    fallbackType: "resume",
    fallbackKind: "truth",
    forceActive: true,
    resolveUrl: resolveUrlThroughDecodo
  });

  if (!source) {
    throw new Error("Provide a replacement resume file or pasted resume text.");
  }

  const nextSources = getSessionSources(session).filter((item) => item.type !== "resume");
  nextSources.push(source);
  setSessionSources(session, nextSources);
  setActiveResumeSource(session, source.id);
  notes.forEach((note) => appendNote(session, note));

  const rebuilt = await rebuildSessionSourceState(session, {
    resetDerived: true,
    note: buildSourceUpdateNote(source, "replaced")
  });
  const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
  await ensureParsedSessionState(context);
  await storage.saveSession(rebuilt.session);

  return {
    session: rebuilt.session,
    source
  };
}

export async function removeSourceFromSession(sessionId: string, sourceId: string) {
  const { storage, session } = await loadSession(sessionId);
  const removed = getSessionSources(session).find((source) => source.id === sourceId);

  if (!removed) {
    throw new Error("Source not found.");
  }

  setSessionSources(
    session,
    getSessionSources(session).filter((source) => source.id !== sourceId)
  );

  if (removed.id === session.selectedOpportunitySourceId) {
    session.selectedOpportunitySourceId = null;
  }

  const rebuilt = await rebuildSessionSourceState(session, {
    resetDerived: true,
    note: buildSourceUpdateNote(removed, "removed")
  });
  const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
  await ensureParsedSessionState(context);
  await storage.saveSession(rebuilt.session);

  return {
    session: rebuilt.session
  };
}

export async function updateSourceInSession(
  sessionId: string,
  input: {
    sourceId: string;
    title?: string;
    content?: string;
  }
) {
  const { storage, session } = await loadSession(sessionId);
  const existingSource = getSessionSources(session).find((source) => source.id === input.sourceId);

  if (!existingSource) {
    throw new Error("Source not found.");
  }

  const nextSources = getSessionSources(session).map((source) =>
    source.id === input.sourceId
      ? {
          ...source,
          title: input.title?.trim() || source.title,
          content: input.content?.trim() || source.content,
          preview: (input.content?.trim() || source.content).slice(0, 240)
        }
      : source
  );

  setSessionSources(session, nextSources);
  const rebuilt = await rebuildSessionSourceState(session, {
    resetDerived: true,
    note: `${existingSource.title} was updated. The session was re-indexed and reparsed.`
  });
  const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
  await ensureParsedSessionState(context, {
    preferredResumeSourceId:
      existingSource.type === "resume" ? existingSource.id : rebuilt.session.activeResumeSourceId,
    preferredOpportunitySourceId:
      existingSource.kind === "opportunity"
        ? existingSource.id
        : rebuilt.session.selectedOpportunitySourceId ?? undefined
  });
  await storage.saveSession(rebuilt.session);

  return {
    session: rebuilt.session,
    source: getSessionSources(rebuilt.session).find((source) => source.id === input.sourceId) ?? null
  };
}

function formatSavedJobAsSource(job: JobSearchResult, enrichedContent?: string) {
  const baseText = [
    job.title,
    job.company,
    job.location,
    job.summary,
    job.keywords.length ? `Keywords: ${job.keywords.join(", ")}` : "",
    enrichedContent ?? ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return buildSourceDocument({
    title: `${job.title} at ${job.company}`,
    type: "job_search",
    kind: "opportunity",
    content: baseText,
    metadata: {
      url: job.url,
      provider: job.provider ?? "job_search",
      jobId: job.id,
      company: job.company,
      location: job.location
    }
  });
}

export async function saveJobResultAsOpportunity(
  sessionId: string,
  job: JobSearchResult
) {
  const { storage, session } = await loadSession(sessionId);
  const existingResult = session.savedJobSearchResults.find((item) => item.id === job.id);
  const effectiveJob = existingResult ?? job;

  let enrichedContent = "";
  if (effectiveJob.url) {
    const decodo = new DecodoMcpClient();
    if (decodo.isConfigured()) {
      try {
        const extracted = await decodo.extractStructuredText(effectiveJob.url);
        enrichedContent = extracted.content;
      } catch (error) {
        appendNote(
          session,
          error instanceof Error
            ? `Decodo MCP fallback: ${error.message}`
            : "Decodo MCP fallback triggered."
        );
      }
    }

    if (!enrichedContent) {
      const fetched = await fetchAndCleanJobUrl(effectiveJob.url);
      enrichedContent = fetched.content;
    }
  }

  const source = formatSavedJobAsSource(effectiveJob, enrichedContent);
  setSessionSources(session, [...getSessionSources(session), source]);
  markOpportunitySourceSaved(session, source.id);
  const rebuilt = await rebuildSessionSourceState(session, {
    resetDerived: true,
    note: `${source.title} was saved into the opportunity corpus.`
  });
  const context = buildAgentContext(rebuilt.session, rebuilt.chunks);
  await ensureParsedSessionState(context, {
    preferredOpportunitySourceId: source.id
  });

  rebuilt.session.savedJobSearchResults = rebuilt.session.savedJobSearchResults.map((item) =>
    item.id === effectiveJob.id
      ? { ...item, savedSourceId: source.id, selected: true }
      : item
  );
  rebuilt.session.jobSearchResults = rebuilt.session.savedJobSearchResults;
  await storage.saveSession(rebuilt.session);

  return {
    session: rebuilt.session,
    source
  };
}
