import type { AgentContext } from "@/lib/agents/shared";
import { buildArtifact, makeTraceStep, upsertArtifact } from "@/lib/agents/shared";
import type { DraftArtifact } from "@/lib/schemas";
import { generateText } from "@/lib/tools/model";
import {
  retrieveOpportunityEvidence,
  retrieveTruthEvidence
} from "@/lib/tools/retrieval";
import {
  getActiveResumeSource,
  setActiveResumeSource,
  getSelectedOpportunitySource
} from "@/lib/tools/session-state";

import { ensureParsedSessionState } from "./source-ingest";

function emailFallback(
  context: AgentContext,
  mode: "email" | "connection" | "cover_letter"
) {
  const profile = context.session.parsedResumeProfile;
  const opportunity = context.session.selectedOpportunityProfile;

  if (!profile || !opportunity) {
    return "I need an active resume and a selected opportunity before I can draft grounded outreach.";
  }

  if (mode === "connection") {
    return `Hi [Name], I'm ${profile.name}, a candidate interested in ${opportunity.title} at ${opportunity.company}. I've been building product and AI workflow projects and would love to connect and learn more about the team.`;
  }

  if (mode === "cover_letter") {
    return [
      `Dear Hiring Team,`,
      "",
      `I'm excited to apply for the ${opportunity.title} role at ${opportunity.company}.`,
      `My background includes ${profile.domains.slice(0, 3).join(", ") || "evidence-backed technical work"}, and the role stands out because it aligns with the problems I've been building toward in my recent experience.`,
      `I'd welcome the chance to contribute with the same grounded, product-minded approach reflected in my resume.`,
      "",
      "Sincerely,",
      profile.name
    ].join("\n");
  }

  return [
    `Subject: Interest in ${opportunity.title} at ${opportunity.company}`,
    "",
    "Hi [Name],",
    "",
    `I'm ${profile.name}, and I'm reaching out because the ${opportunity.title} opportunity at ${opportunity.company} stood out to me.`,
    `My background includes ${profile.domains.slice(0, 3).join(", ") || "product-minded technical work"}, and I'd love to learn more about how your team approaches this work.`,
    "",
    "Best,",
    profile.name
  ].join("\n");
}

export async function runEmailConnectAgent(
  context: AgentContext,
  options?: {
    mode?: "email" | "connection" | "cover_letter";
    instruction?: string;
    selectedResumeSourceId?: string | null;
    selectedSourceId?: string | null;
  }
) {
  const mode = options?.mode ?? "email";
  if (options?.selectedResumeSourceId) {
    setActiveResumeSource(context.session, options.selectedResumeSourceId);
  }
  await ensureParsedSessionState(context, {
    preferredResumeSourceId: options?.selectedResumeSourceId,
    preferredOpportunitySourceId: options?.selectedSourceId
  });

  const candidateProfile = context.session.parsedResumeProfile;
  const opportunityProfile = context.session.selectedOpportunityProfile;
  const activeResume = getActiveResumeSource(context.session);
  const selectedOpportunity = getSelectedOpportunitySource(
    context.session,
    options?.selectedSourceId ?? undefined
  );

  if (!candidateProfile || !opportunityProfile || !activeResume || !selectedOpportunity) {
    throw new Error("An active resume and a selected opportunity are required first.");
  }

  const query =
    options?.instruction ??
    (mode === "connection"
      ? "Write a LinkedIn connection message."
      : mode === "cover_letter"
        ? "Write a grounded cover letter."
        : "Write a grounded networking email.");
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

  const prompt = [
    "You are EmailConnectAgent for CareerFlow AI.",
    mode === "connection"
      ? "Draft a short LinkedIn connection note."
      : mode === "cover_letter"
        ? "Draft a concise grounded cover letter."
        : "Draft a concise outreach email.",
    "Rules:",
    "- Use only grounded facts from the truth evidence for the user.",
    "- Use only grounded facts from the opportunity evidence for the role/company.",
    "- Do not invent past interactions, accomplishments, dates, or metrics.",
    "- If something is unknown, keep the language modest.",
    "",
    `Instruction: ${query}`,
    `Candidate profile: ${JSON.stringify(candidateProfile)}`,
    `Selected opportunity: ${JSON.stringify(opportunityProfile)}`,
    "",
    "Truth evidence:",
    ...truthEvidence.map((item) => `- ${item.title}: ${item.text}`),
    "",
    "Opportunity evidence:",
    ...opportunityEvidence.map((item) => `- ${item.title}: ${item.text}`)
  ].join("\n");

  const generated = await generateText(prompt, () => emailFallback(context, mode));
  const artifact = await buildArtifact({
    type:
      mode === "connection"
        ? "connection_message"
        : mode === "cover_letter"
          ? "cover_letter"
          : "email_draft",
    title:
      mode === "connection"
        ? "Connection Message"
        : mode === "cover_letter"
          ? "Cover Letter"
          : "Email Draft",
    content: generated.text,
    chunks: context.chunks,
    session: context.session
  });
  upsertArtifact(context.session.artifacts, artifact);

  context.updateTrace(
    makeTraceStep(
      "EmailConnectAgent",
      mode === "connection"
        ? "Drafted a grounded connection message."
        : mode === "cover_letter"
          ? "Drafted a grounded cover letter."
          : "Drafted a grounded email.",
      "completed",
      [artifact.id],
      [
        "ensureParsedSessionState",
        "retrieveTruthEvidence",
        "retrieveOpportunityEvidence",
        "generateText",
        "buildArtifact"
      ]
    )
  );

  return {
    artifact,
    summary:
      mode === "connection"
        ? "I drafted a grounded connection message using your active resume and the selected opportunity."
        : mode === "cover_letter"
          ? "I drafted a grounded cover letter using your active resume and the selected opportunity."
          : "I drafted a grounded email using your active resume and the selected opportunity."
  };
}
