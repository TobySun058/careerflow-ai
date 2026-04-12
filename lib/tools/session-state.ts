import type {
  ChatMessage,
  JobProfile,
  MatchReport,
  SessionRecord,
  SourceDocument,
  SourceKind,
  SourceType
} from "@/lib/schemas";
import { makeId, truncate } from "@/lib/utils";

function deriveSessionTitle(candidate: Partial<SessionRecord>, sources: SourceDocument[]) {
  const explicitTitle = candidate.title?.trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const activeResume = sources.find(
    (source) => source.type === "resume" && source.active
  );
  if (candidate.jobProfile?.title?.trim()) {
    return candidate.jobProfile.title.trim();
  }

  if (activeResume?.title?.trim()) {
    return activeResume.title.trim();
  }

  const firstSource = sources[0]?.title?.trim();
  if (firstSource) {
    return firstSource;
  }

  return "CareerFlow session";
}

export function createChatMessage(input: {
  role: ChatMessage["role"];
  content: string;
  explicitIntent?: string;
  sourceRefs?: ChatMessage["sourceRefs"];
  artifactIds?: string[];
}): ChatMessage {
  return {
    id: makeId("msg"),
    role: input.role,
    content: input.content,
    createdAt: new Date().toISOString(),
    explicitIntent: input.explicitIntent,
    sourceRefs: input.sourceRefs ?? [],
    artifactIds: input.artifactIds ?? []
  };
}

export function getSessionSources(session: SessionRecord) {
  return session.sources.length ? session.sources : session.sourceManifest;
}

export function getActiveResumeSource(session: SessionRecord) {
  return (
    getSessionSources(session).find(
      (source) =>
        source.type === "resume" &&
        source.id === (session.activeResumeSourceId ?? undefined)
    ) ??
    getSessionSources(session).find((source) => source.type === "resume" && source.active) ??
    null
  );
}

export function getOpportunitySources(session: SessionRecord) {
  return getSessionSources(session).filter((source) => source.kind === "opportunity");
}

export function getSelectedOpportunitySource(
  session: SessionRecord,
  preferredSourceId?: string
) {
  const sources = getSessionSources(session);
  const selectedId =
    preferredSourceId ??
    session.selectedOpportunitySourceId ??
    session.savedOpportunitySourceIds.at(-1) ??
    null;

  return (
    sources.find(
      (source) => source.kind === "opportunity" && source.id === selectedId
    ) ??
    sources.find((source) => source.kind === "opportunity") ??
    null
  );
}

export function setSessionSources(
  session: SessionRecord,
  sources: SourceDocument[]
) {
  session.sources = sources;
  session.sourceManifest = sources;
   session.activeResumeSourceId =
    sources.find((source) => source.type === "resume" && source.active)?.id ?? null;
  if (
    session.selectedOpportunitySourceId &&
    !sources.some((source) => source.id === session.selectedOpportunitySourceId)
  ) {
    session.selectedOpportunitySourceId = null;
  }
  session.savedOpportunitySourceIds = session.savedOpportunitySourceIds.filter((sourceId) =>
    sources.some((source) => source.id === sourceId)
  );
  session.updatedAt = new Date().toISOString();
  return session;
}

export function inferSourceKind(
  type: SourceType,
  preferredKind?: SourceKind
): SourceKind {
  if (preferredKind) {
    return preferredKind;
  }

  if (["job_description", "url", "job_url", "company_page", "job_search"].includes(type)) {
    return "opportunity";
  }

  return "truth";
}

export function buildSourceDocument(input: {
  title: string;
  type: SourceType;
  kind?: SourceKind;
  content: string;
  preview?: string;
  metadata?: SourceDocument["metadata"];
  active?: boolean;
}) {
  return {
    id: makeId("source"),
    title: input.title,
    type: input.type,
    subtype: input.type,
    kind: input.kind ?? inferSourceKind(input.type),
    content: input.content,
    preview: input.preview ?? truncate(input.content, 240),
    createdAt: new Date().toISOString(),
    active: input.active ?? false,
    metadata: input.metadata ?? {},
    chunkIds: []
  } satisfies SourceDocument;
}

export function ensureActiveResume(sources: SourceDocument[]) {
  const resumeSources = sources.filter((source) => source.type === "resume");
  if (!resumeSources.length) {
    return sources;
  }

  if (!resumeSources.some((source) => source.active)) {
    resumeSources[0].active = true;
  }

  return sources.map((source) => {
    if (source.type !== "resume") {
      return source;
    }

    return {
      ...source,
      active:
        source.id === resumeSources.find((candidate) => candidate.active)?.id
    };
  });
}

export function setActiveResumeSource(
  session: SessionRecord,
  sourceId: string | null
) {
  const nextSources = getSessionSources(session).map((source) => {
    if (source.type !== "resume") {
      return source;
    }

    return {
      ...source,
      active: sourceId ? source.id === sourceId : source.active
    };
  });

  setSessionSources(session, ensureActiveResume(nextSources));
  session.activeResumeSourceId =
    getSessionSources(session).find((source) => source.type === "resume" && source.active)?.id ??
    null;
  return session;
}

export function setParsedResumeProfile(
  session: SessionRecord,
  profile: SessionRecord["parsedResumeProfile"]
) {
  session.parsedResumeProfile = profile;
  session.candidateProfile = profile;
  session.updatedAt = new Date().toISOString();
  return session;
}

export function setSelectedOpportunityProfile(
  session: SessionRecord,
  profile: SessionRecord["selectedOpportunityProfile"],
  sourceId?: string | null
) {
  session.selectedOpportunityProfile = profile;
  session.jobProfile = profile;
  if (sourceId !== undefined) {
    session.selectedOpportunitySourceId = sourceId;
  }
  session.updatedAt = new Date().toISOString();
  return session;
}

export function setSavedJobSearchResults(
  session: SessionRecord,
  results: SessionRecord["savedJobSearchResults"]
) {
  session.savedJobSearchResults = results;
  session.jobSearchResults = results;
  session.updatedAt = new Date().toISOString();
  return session;
}

export function markOpportunitySourceSaved(session: SessionRecord, sourceId: string) {
  session.savedOpportunitySourceIds = Array.from(
    new Set([...session.savedOpportunitySourceIds, sourceId])
  );
  session.selectedOpportunitySourceId = sourceId;
  session.updatedAt = new Date().toISOString();
  return session;
}

export function clearDerivedSessionState(
  session: SessionRecord,
  assistantNote?: string
) {
  session.parsedResumeProfile = null;
  session.selectedOpportunityProfile = null;
  session.candidateProfile = null;
  session.jobProfile = null;
  session.jobProfiles = [];
  session.matchReport = null;
  session.matchReports = [];
  session.artifacts = [];
  session.plan = null;
  session.workflowTrace = [];
  session.notes = assistantNote ? [assistantNote] : [];

  if (assistantNote) {
    session.chatHistory.push(
      createChatMessage({
        role: "assistant",
        content: assistantNote
      })
    );
  }

  session.updatedAt = new Date().toISOString();
  return session;
}

export function upsertJobProfileSnapshot(
  session: SessionRecord,
  jobProfile: JobProfile | null
) {
  if (!jobProfile) {
    return;
  }

  const existingIndex = session.jobProfiles.findIndex(
    (candidate) =>
      candidate.title === jobProfile.title && candidate.company === jobProfile.company
  );
  if (existingIndex === -1) {
    session.jobProfiles.push(jobProfile);
    return;
  }

  session.jobProfiles[existingIndex] = jobProfile;
}

export function appendMatchReportSnapshot(
  session: SessionRecord,
  matchReport: MatchReport | null
) {
  if (!matchReport) {
    return;
  }

  const last = session.matchReports.at(-1);
  if (last && JSON.stringify(last) === JSON.stringify(matchReport)) {
    return;
  }

  session.matchReports.push(matchReport);
}

export function normalizeSessionRecord(raw: unknown): SessionRecord {
  const candidate = raw as Partial<SessionRecord> & {
    sourceManifest?: SourceDocument[];
    sources?: SourceDocument[];
    chatHistory?: ChatMessage[];
  };

  const sources = ensureActiveResume(
    (candidate.sources?.length ? candidate.sources : candidate.sourceManifest ?? []).map(
      (source) => ({
        ...source,
        type: source.type ?? source.subtype ?? "uploaded_document",
        subtype: source.subtype ?? source.type ?? "uploaded_document",
        active: source.active ?? false
      })
    )
  );
  const activeResumeSourceId =
    candidate.activeResumeSourceId ??
    sources.find((source) => source.type === "resume" && source.active)?.id ??
    null;
  const savedOpportunitySourceIds =
    candidate.savedOpportunitySourceIds ??
    sources.filter((source) => source.kind === "opportunity").map((source) => source.id);
  const selectedOpportunitySourceId =
    candidate.selectedOpportunitySourceId ??
    savedOpportunitySourceIds.at(-1) ??
    sources.find((source) => source.kind === "opportunity")?.id ??
    null;
  const parsedResumeProfile = candidate.parsedResumeProfile ?? candidate.candidateProfile ?? null;
  const selectedOpportunityProfile =
    candidate.selectedOpportunityProfile ?? candidate.jobProfile ?? null;
  const savedJobSearchResults =
    candidate.savedJobSearchResults ?? candidate.jobSearchResults ?? [];

  return {
    id: candidate.id ?? makeId("session"),
    title: deriveSessionTitle(candidate, sources),
    createdAt: candidate.createdAt ?? new Date().toISOString(),
    updatedAt: candidate.updatedAt ?? new Date().toISOString(),
    activeResumeSourceId,
    savedOpportunitySourceIds,
    selectedOpportunitySourceId,
    parsedResumeProfile,
    selectedOpportunityProfile,
    savedJobSearchResults,
    candidateProfile: candidate.candidateProfile ?? parsedResumeProfile,
    jobProfile: candidate.jobProfile ?? selectedOpportunityProfile,
    jobProfiles:
      candidate.jobProfiles ??
      (selectedOpportunityProfile ? [selectedOpportunityProfile] : []),
    matchReport: candidate.matchReport ?? null,
    matchReports:
      candidate.matchReports ?? (candidate.matchReport ? [candidate.matchReport] : []),
    artifacts: candidate.artifacts ?? [],
    plan: candidate.plan ?? null,
    workflowTrace: candidate.workflowTrace ?? [],
    sources,
    sourceManifest: sources,
    chatHistory: candidate.chatHistory ?? [],
    jobSearchResults: candidate.jobSearchResults ?? savedJobSearchResults,
    notes: candidate.notes ?? []
  };
}
