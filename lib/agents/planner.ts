import type { DraftArtifact } from "@/lib/schemas";
import { buildPlannerPrompt } from "@/lib/prompts/agent-prompts";
import { generateJson } from "@/lib/tools/model";

import {
  buildArtifact,
  makeTraceStep,
  requireProfiles,
  type AgentContext
} from "./shared";

type PlannerPayload = {
  plan: string[];
  checklist: string[];
  sessionSummary: string;
};

function fallbackPlannerPayload() {
  return {
    plan: [
      "Lock the top 3 evidence-backed strengths to emphasize in the resume.",
      "Tailor outreach so it references grounded interest in the company and role.",
      "Prepare stories for the biggest requirement-to-evidence gaps before applying."
    ],
    checklist: [
      "Review resume bullets for truthfulness and ATS keyword alignment.",
      "Send outreach or apply directly within 24 hours.",
      "Practice behavioral and technical questions using the interview prep tab."
    ],
    sessionSummary:
      "Candidate appears directionally aligned for an AI product engineering role, with strongest evidence in grounded workflow tooling, full-stack product shipping, and career-tech adjacent projects."
  };
}

export async function runPlannerAgent(
  context: AgentContext,
  options?: { instruction?: string }
) {
  const { candidateProfile, jobProfile } = requireProfiles(
    context.session.candidateProfile,
    context.session.jobProfile
  );

  const prompt = buildPlannerPrompt({
    candidate: candidateProfile,
    job: jobProfile,
    instruction: options?.instruction
  });
  const result = await generateJson<PlannerPayload>(prompt, fallbackPlannerPayload);
  const payload = { ...fallbackPlannerPayload(), ...result.data };

  const content = [
    "Next-step plan:",
    ...payload.plan.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Checklist:",
    ...payload.checklist.map((item) => `- ${item}`),
    "",
    "Session summary:",
    payload.sessionSummary
  ].join("\n");

  const artifact: DraftArtifact = await buildArtifact({
    type: "plan",
    title: "Action Plan",
    content,
    chunks: context.chunks,
    session: context.session
  });

  context.updateTrace(
    makeTraceStep(
      "PlannerAgent",
      "Built a concrete next-step plan and session summary.",
      "completed",
      [artifact.id]
    )
  );

  return {
    artifact,
    sessionSummary: payload.sessionSummary
  };
}
