import type { CandidateProfile, JobProfile } from "@/lib/schemas";
import type { RetrievedEvidence } from "@/lib/tools/retrieval";

function formatEvidence(evidence: RetrievedEvidence[]) {
  return evidence
    .map(
      (item) =>
        `- [${item.kind}] ${item.title} (${item.chunkId}): ${item.excerpt}`
    )
    .join("\n");
}

export function buildWriterPrompt(input: {
  candidate: CandidateProfile;
  job: JobProfile;
  truthEvidence: RetrievedEvidence[];
  opportunityEvidence: RetrievedEvidence[];
  instruction?: string;
  mode?: "default" | "ats";
}) {
  return [
    "You are ApplicationWriterAgent for CareerFlow AI.",
    "Generate grounded application materials using only the evidence below.",
    "Rules:",
    "- Never invent internships, metrics, tools, dates, leadership, or awards.",
    "- Statements about the candidate must be supported by truth-store evidence.",
    "- Statements about the role/company must be supported by opportunity-store evidence.",
    "- If support is weak, phrase it as a suggestion instead of a fact.",
    "- Return strict JSON with keys: rewrittenBullets, outreach, linkedInNote, coverLetterSnippet, whyThisRole, atsVersion.",
    "",
    `Candidate profile: ${JSON.stringify(input.candidate)}`,
    `Job profile: ${JSON.stringify(input.job)}`,
    "",
    "Truth evidence:",
    formatEvidence(input.truthEvidence),
    "",
    "Opportunity evidence:",
    formatEvidence(input.opportunityEvidence),
    "",
    `Mode: ${input.mode ?? "default"}`,
    input.instruction ? `Follow-up instruction: ${input.instruction}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInterviewPrompt(input: {
  candidate: CandidateProfile;
  job: JobProfile;
  truthEvidence: RetrievedEvidence[];
  opportunityEvidence: RetrievedEvidence[];
  instruction?: string;
}) {
  return [
    "You are InterviewPrepAgent for CareerFlow AI.",
    "Generate grounded interview prep in strict JSON with keys: tellMeAboutYourself, behavioralQuestions, technicalQuestions, storyMappings, checklist.",
    "Rules:",
    "- Use only provided candidate evidence and role evidence.",
    "- Behavioral story suggestions must reference real projects or experience from the truth store.",
    "- If a story is missing, say it needs a user-provided example instead of fabricating one.",
    "",
    `Candidate profile: ${JSON.stringify(input.candidate)}`,
    `Job profile: ${JSON.stringify(input.job)}`,
    "",
    "Truth evidence:",
    formatEvidence(input.truthEvidence),
    "",
    "Opportunity evidence:",
    formatEvidence(input.opportunityEvidence),
    "",
    input.instruction ? `Follow-up instruction: ${input.instruction}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPlannerPrompt(input: {
  candidate: CandidateProfile;
  job: JobProfile;
  instruction?: string;
}) {
  return [
    "You are PlannerAgent for CareerFlow AI.",
    "Generate strict JSON with keys: plan, checklist, sessionSummary.",
    "Rules:",
    "- Keep the plan action-oriented and honest.",
    "- Note where additional candidate proof is required.",
    "",
    `Candidate profile: ${JSON.stringify(input.candidate)}`,
    `Job profile: ${JSON.stringify(input.job)}`,
    input.instruction ? `Follow-up instruction: ${input.instruction}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}
