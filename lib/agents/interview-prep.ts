import type { DraftArtifact } from "@/lib/schemas";
import { buildInterviewPrompt } from "@/lib/prompts/agent-prompts";
import { generateJson } from "@/lib/tools/model";
import {
  retrieveOpportunityEvidence,
  retrieveTruthEvidence
} from "@/lib/tools/retrieve";

import {
  buildArtifact,
  makeTraceStep,
  requireProfiles,
  type AgentContext
} from "./shared";

type InterviewPayload = {
  tellMeAboutYourself: string;
  behavioralQuestions: string[];
  technicalQuestions: string[];
  storyMappings: string[];
  checklist: string[];
};

function fallbackInterviewPayload() {
  return {
    tellMeAboutYourself:
      "I’m a computer science student who enjoys building product-minded AI workflows. Most of my recent work has been at the intersection of retrieval quality, user-facing full-stack development, and tools that help people make better career decisions.",
    behavioralQuestions: [
      "Tell me about a time you improved the quality of an AI-powered feature.",
      "Describe a product decision you made with incomplete information.",
      "Tell me about a time you collaborated closely with design or product partners."
    ],
    technicalQuestions: [
      "How would you design a grounded retrieval pipeline for career documents?",
      "What tradeoffs would you consider when chunking resumes and job descriptions?",
      "How would you evaluate hallucination risk in a multi-agent workflow?"
    ],
    storyMappings: [
      "Retrieval quality question -> FinSight Labs assistant chunking redesign.",
      "Product collaboration question -> Career Studio portal and analytics dashboard.",
      "Grounding / explainability question -> Campus Connect Search source citation work."
    ],
    checklist: [
      "Prepare one STAR story for retrieval quality improvements.",
      "Prepare one STAR story for product/design collaboration.",
      "Review the role’s required skills and connect each one to truth-store evidence."
    ]
  };
}

export async function runInterviewPrepAgent(
  context: AgentContext,
  options?: { instruction?: string }
) {
  const { candidateProfile, jobProfile } = requireProfiles(
    context.session.candidateProfile,
    context.session.jobProfile
  );
  const query = options?.instruction ?? "interview prep";
  const truthEvidence = await retrieveTruthEvidence(
    query,
    context.chunks,
    context.session.sourceManifest,
    6
  );
  const opportunityEvidence = await retrieveOpportunityEvidence(
    query,
    context.chunks,
    context.session.sourceManifest,
    6
  );

  const prompt = buildInterviewPrompt({
    candidate: candidateProfile,
    job: jobProfile,
    truthEvidence,
    opportunityEvidence,
    instruction: options?.instruction
  });

  const result = await generateJson<InterviewPayload>(
    prompt,
    fallbackInterviewPayload
  );
  const payload = { ...fallbackInterviewPayload(), ...result.data };

  const content = [
    "Tell me about yourself:",
    payload.tellMeAboutYourself,
    "",
    "Behavioral questions:",
    ...payload.behavioralQuestions.map((item) => `- ${item}`),
    "",
    "Technical questions:",
    ...payload.technicalQuestions.map((item) => `- ${item}`),
    "",
    "Story mappings:",
    ...payload.storyMappings.map((item) => `- ${item}`),
    "",
    "Prep checklist:",
    ...payload.checklist.map((item) => `- ${item}`)
  ].join("\n");

  const artifact: DraftArtifact = await buildArtifact({
    type: "interview_prep",
    title: "Interview Prep",
    content,
    chunks: context.chunks,
    session: context.session
  });

  context.updateTrace(
    makeTraceStep(
      "InterviewPrepAgent",
      "Generated grounded interview questions and talking points.",
      "completed",
      [artifact.id]
    )
  );

  return artifact;
}
