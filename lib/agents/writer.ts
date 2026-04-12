import type { DraftArtifact } from "@/lib/schemas";
import { buildWriterPrompt } from "@/lib/prompts/agent-prompts";
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

type WriterPayload = {
  rewrittenBullets: string[];
  outreach: string;
  linkedInNote: string;
  coverLetterSnippet: string;
  whyThisRole: string;
  atsVersion: string;
};

type WriterArtifactFocus =
  | "resume_rewrite"
  | "outreach"
  | "linkedin_note"
  | "cover_letter"
  | "why_this_role"
  | "ats_resume";

function fallbackWriterPayload(matchKeywords: string[]) {
  return {
    rewrittenBullets: [
      `Built evidence-first AI workflow tooling with focus on ${matchKeywords[0] ?? "retrieval quality"} and transparent source grounding.`,
      `Shipped full-stack product features in React and TypeScript while collaborating closely with product and design partners.`,
      `Designed experiments and iteration loops that improved user-facing workflow clarity and quality.`
    ],
    outreach:
      "Hi [Name], I’m a WashU CS student who has been building grounded AI workflow products for career and interview use cases. Your Applied AI internship stood out because it combines product engineering, retrieval quality, and student impact. I’d love to learn more about how the team thinks about shipping trustworthy AI experiences.",
    linkedInNote:
      "WashU CS student building grounded AI workflow products. Would love to connect and learn more about the Applied AI team.",
    coverLetterSnippet:
      "I’m excited by the chance to contribute to a student-facing AI workflow product where strong UX, grounding, and shipping velocity all matter. My recent projects have centered on retrieval-backed assistants, transparent source citations, and product-minded iteration.",
    whyThisRole:
      "This role sits at the intersection of product engineering, grounded AI, and student outcomes, which matches the work I’ve already been pursuing through internships and side projects.",
    atsVersion:
      "Grounded AI product builder with React, Next.js, TypeScript, Firebase, and retrieval-backed workflow experience."
  };
}

export async function runApplicationWriterAgent(
  context: AgentContext,
  options?: {
    instruction?: string;
    mode?: "default" | "ats";
    focus?: WriterArtifactFocus[];
  }
) {
  const { candidateProfile, jobProfile, matchReport } = requireProfiles(
    context.session.candidateProfile,
    context.session.jobProfile,
    context.session.matchReport
  );

  const query = options?.instruction ?? jobProfile.title;
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

  const prompt = buildWriterPrompt({
    candidate: candidateProfile,
    job: jobProfile,
    truthEvidence,
    opportunityEvidence,
    instruction: options?.instruction,
    mode: options?.mode
  });

  const result = await generateJson<WriterPayload>(prompt, () =>
    fallbackWriterPayload(matchReport?.priorityKeywords ?? jobProfile.keywords)
  );

  const payload = {
    ...fallbackWriterPayload(matchReport?.priorityKeywords ?? jobProfile.keywords),
    ...result.data
  };

  const builtArtifacts: DraftArtifact[] = [
    await buildArtifact({
      type: options?.mode === "ats" ? "ats_resume" : "resume_rewrite",
      title: options?.mode === "ats" ? "Final ATS Version" : "Resume Rewrite",
      content:
        options?.mode === "ats"
          ? payload.atsVersion
          : payload.rewrittenBullets.map((item) => `- ${item}`).join("\n"),
      chunks: context.chunks,
      session: context.session
    }),
    await buildArtifact({
      type: "outreach",
      title: "Networking Outreach",
      content: payload.outreach,
      chunks: context.chunks,
      session: context.session
    }),
    await buildArtifact({
      type: "linkedin_note",
      title: "LinkedIn Note",
      content: payload.linkedInNote,
      chunks: context.chunks,
      session: context.session
    }),
    await buildArtifact({
      type: "cover_letter",
      title: "Cover Letter Snippet",
      content: payload.coverLetterSnippet,
      chunks: context.chunks,
      session: context.session
    }),
    await buildArtifact({
      type: "why_this_role",
      title: "Why This Role",
      content: payload.whyThisRole,
      chunks: context.chunks,
      session: context.session
    })
  ];

  const isWriterArtifactFocus = (type: DraftArtifact["type"]): type is WriterArtifactFocus =>
    [
      "resume_rewrite",
      "outreach",
      "linkedin_note",
      "cover_letter",
      "why_this_role",
      "ats_resume"
    ].includes(type as WriterArtifactFocus);

  const artifacts =
    options?.focus?.length
      ? builtArtifacts.filter(
          (artifact) =>
            isWriterArtifactFocus(artifact.type) &&
            options.focus?.includes(artifact.type)
        )
      : builtArtifacts;

  context.updateTrace(
    makeTraceStep(
      "ApplicationWriterAgent",
      "Drafted grounded resume, outreach, and application copy.",
      "completed",
      artifacts.map((artifact) => artifact.id)
    )
  );

  return artifacts;
}
