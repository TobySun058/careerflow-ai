import type {
  CandidateProfile,
  DraftArtifact,
  IndexedChunk,
  JobProfile,
  MatchReport,
  SessionRecord,
  WorkflowTraceStep
} from "@/lib/schemas";
import {
  finalizeSourceRefs,
  generateClaimMap,
  verifyClaims
} from "@/lib/tools/claim-check";
import { makeId } from "@/lib/utils";

export type AgentContext = {
  session: SessionRecord;
  chunks: IndexedChunk[];
  updateTrace: (step: WorkflowTraceStep) => void;
};

export function buildAgentContext(
  session: SessionRecord,
  chunks: IndexedChunk[]
): AgentContext {
  return {
    session,
    chunks,
    updateTrace(step: WorkflowTraceStep) {
      session.workflowTrace.push({
        ...step,
        id: step.id ?? makeId("trace")
      });
      session.updatedAt = new Date().toISOString();
    }
  };
}

export function makeTraceStep(
  agent: string,
  summary: string,
  status: WorkflowTraceStep["status"],
  artifactIds: string[] = [],
  tools: string[] = []
): WorkflowTraceStep {
  return {
    id: makeId("trace"),
    agent,
    status,
    summary,
    tools,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    artifactIds
  };
}

export function upsertArtifact(artifacts: DraftArtifact[], nextArtifact: DraftArtifact) {
  const index = artifacts.findIndex((artifact) => artifact.type === nextArtifact.type);
  if (index === -1) {
    artifacts.push(nextArtifact);
    return artifacts;
  }

  artifacts[index] = nextArtifact;
  return artifacts;
}

export async function buildArtifact(input: {
  id?: string;
  type: DraftArtifact["type"];
  title: string;
  content: string;
  editable?: boolean;
  chunks: IndexedChunk[];
  session: SessionRecord;
}) {
  const claimMap = await generateClaimMap(
    input.content,
    input.chunks,
    input.session.sourceManifest
  );
  const verified = verifyClaims(input.content, claimMap);

  return {
    id: input.id ?? makeId("artifact"),
    type: input.type,
    title: input.title,
    content: verified.content,
    claimMap,
    sourceRefs: finalizeSourceRefs(
      claimMap,
      input.chunks,
      input.session.sourceManifest
    ),
    editable: input.editable ?? true
  } satisfies DraftArtifact;
}

export function requireProfiles(
  candidateProfile: CandidateProfile | null,
  jobProfile: JobProfile | null,
  matchReport?: MatchReport | null
) {
  if (!candidateProfile || !jobProfile) {
    throw new Error("Candidate and job profiles are required to run this agent.");
  }

  return { candidateProfile, jobProfile, matchReport: matchReport ?? null };
}
