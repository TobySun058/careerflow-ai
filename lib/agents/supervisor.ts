import type {
  DraftArtifact,
  SessionRecord,
  WorkflowBundle,
  WorkflowTraceStep
} from "@/lib/schemas";
import { getStorage } from "@/lib/storage";
import { makeId } from "@/lib/utils";

import { runInterviewPrepAgent } from "./interview-prep";
import { runMatchAgent } from "./match";
import { runPlannerAgent } from "./planner";
import { runResumeEvidenceAgent } from "./resume-evidence";
import { runRoleResearchAgent } from "./role-research";
import { upsertArtifact, type AgentContext } from "./shared";
import { runApplicationWriterAgent } from "./writer";

function buildContext(
  session: SessionRecord,
  chunks: Awaited<ReturnType<ReturnType<typeof getStorage>["getChunkIndex"]>>
) {
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
  } satisfies AgentContext;
}

function replaceArtifacts(session: SessionRecord, artifacts: DraftArtifact[]) {
  artifacts.forEach((artifact) => {
    upsertArtifact(session.artifacts, artifact);
    if (artifact.type === "plan") {
      session.plan = artifact;
    }
  });
}

export async function runSupervisorWorkflow(
  sessionId: string
): Promise<WorkflowBundle> {
  const storage = getStorage();
  const session = await storage.getSession(sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const chunks = await storage.getChunkIndex(sessionId);
  const context = buildContext(session, chunks);

  session.workflowTrace = [];
  session.candidateProfile = await runResumeEvidenceAgent(context);
  session.jobProfile = await runRoleResearchAgent(context);

  const matchResult = await runMatchAgent(context);
  session.matchReport = matchResult.matchReport;
  replaceArtifacts(session, [matchResult.artifact]);

  const writerArtifacts = await runApplicationWriterAgent(context);
  replaceArtifacts(session, writerArtifacts);

  const interviewArtifact = await runInterviewPrepAgent(context);
  replaceArtifacts(session, [interviewArtifact]);

  const plannerResult = await runPlannerAgent(context);
  replaceArtifacts(session, [plannerResult.artifact]);
  session.notes = [plannerResult.sessionSummary];
  session.updatedAt = new Date().toISOString();

  await storage.saveSession(session);

  return {
    session,
    artifacts: session.artifacts,
    match: session.matchReport,
    workflowTrace: session.workflowTrace
  };
}

function inferFollowUpTargets(instruction: string) {
  const lowered = instruction.toLowerCase();

  if (/(interview|question|harder|behavioral|technical)/.test(lowered)) {
    return ["interview"];
  }

  if (/(plan|checklist|next step)/.test(lowered)) {
    return ["plan"];
  }

  if (/(fit|score|gap|keyword|emphasis)/.test(lowered)) {
    return ["match"];
  }

  if (/(ats)/.test(lowered)) {
    return ["writer-ats"];
  }

  return ["writer"];
}

export async function runSupervisorFollowUp(
  sessionId: string,
  instruction: string
): Promise<WorkflowBundle> {
  const storage = getStorage();
  const session = await storage.getSession(sessionId);

  if (!session) {
    throw new Error("Session not found.");
  }

  const chunks = await storage.getChunkIndex(sessionId);
  const context = buildContext(session, chunks);
  const targets = inferFollowUpTargets(instruction);
  const freshArtifacts: DraftArtifact[] = [];

  if (!session.candidateProfile) {
    session.candidateProfile = await runResumeEvidenceAgent(context);
  }

  if (!session.jobProfile) {
    session.jobProfile = await runRoleResearchAgent(context);
  }

  if (targets.includes("match")) {
    const matchResult = await runMatchAgent(context);
    session.matchReport = matchResult.matchReport;
    freshArtifacts.push(matchResult.artifact);
  }

  if (targets.includes("writer")) {
    freshArtifacts.push(...(await runApplicationWriterAgent(context, { instruction })));
  }

  if (targets.includes("writer-ats")) {
    freshArtifacts.push(
      ...(await runApplicationWriterAgent(context, {
        instruction,
        mode: "ats"
      }))
    );
  }

  if (targets.includes("interview")) {
    freshArtifacts.push(await runInterviewPrepAgent(context, { instruction }));
  }

  if (targets.includes("plan")) {
    const planResult = await runPlannerAgent(context, { instruction });
    freshArtifacts.push(planResult.artifact);
    session.notes = [planResult.sessionSummary];
  }

  replaceArtifacts(session, freshArtifacts);
  session.updatedAt = new Date().toISOString();
  await storage.saveSession(session);

  return {
    session,
    artifacts: freshArtifacts,
    match: session.matchReport,
    workflowTrace: session.workflowTrace
  };
}
