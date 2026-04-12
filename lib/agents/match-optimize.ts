import type { AgentContext } from "@/lib/agents/shared";
import { buildArtifact, makeTraceStep, upsertArtifact } from "@/lib/agents/shared";
import { ResumeOptimizerProMcpClient } from "@/lib/mcp/resume-optimizer-pro/client";
import type { DraftArtifact } from "@/lib/schemas";
import { compareCandidateToJob } from "@/lib/tools/compare";
import { generateText } from "@/lib/tools/model";
import {
  retrieveOpportunityEvidence,
  retrieveTruthEvidence
} from "@/lib/tools/retrieval";
import {
  appendMatchReportSnapshot,
  getActiveResumeSource,
  getSelectedOpportunitySource,
  setActiveResumeSource
} from "@/lib/tools/session-state";

import { ensureParsedSessionState } from "./parse-ingest";

function buildMatchArtifactContent(input: {
  localScore: number;
  strengths: string[];
  gaps: string[];
  recommendedEmphasis: string[];
  priorityKeywords: string[];
  mcpScore?: number;
  mcpSummary?: string;
  missingKeywords?: string[];
}) {
  return [
    `Local grounded score: ${input.localScore}/100`,
    input.mcpScore !== undefined ? `Resume Optimizer Pro MCP score: ${input.mcpScore}/100` : "",
    input.mcpSummary ? `MCP summary: ${input.mcpSummary}` : "",
    "",
    "Strengths:",
    ...input.strengths.map((item) => `- ${item}`),
    "",
    "Gaps:",
    ...input.gaps.map((item) => `- ${item}`),
    "",
    "Missing keywords:",
    ...(input.missingKeywords?.length
      ? input.missingKeywords.map((item) => `- ${item}`)
      : input.priorityKeywords.slice(0, 6).map((item) => `- ${item}`)),
    "",
    "Recommended emphasis:",
    ...input.recommendedEmphasis.map((item) => `- ${item}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLocalOptimizationFallback(context: AgentContext) {
  const activeResume = getActiveResumeSource(context.session);
  if (!activeResume?.content.trim()) {
    return "No grounded optimized resume is available yet.";
  }

  const structured = buildStructuredResumeFallback(context);
  return structured.trim() || activeResume.content.trim();
}

function countNonEmptyLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function countResumeSections(text: string) {
  const sectionPatterns = [
    /\beducation\b/i,
    /\bexperience\b/i,
    /\bwork experience\b/i,
    /\bprojects?\b/i,
    /\bresearch\b/i,
    /\bskills?\b/i,
    /\btechnical skills\b/i
  ];

  return sectionPatterns.filter((pattern) => pattern.test(text)).length;
}

function hasResumeMetaFraming(text: string) {
  const normalized = text.toLowerCase();
  return [
    "here's a rewritten version",
    "here is a rewritten version",
    "using only the provided evidence",
    "concise ats-friendly format",
    "i've only included information"
  ].some((phrase) => normalized.includes(phrase));
}

function cleanResumeArtifacts(text: string) {
  return text
    .replace(/[鈻■▪•●]/g, "-")
    .replace(/[鈥–—]/g, "-")
    .replace(/[脳×]/g, "x")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractHeaderBlock(text: string) {
  const lines = cleanResumeArtifacts(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const educationIndex = lines.findIndex((line) => /^EDUCATION$/i.test(line));
  const headerLines = (educationIndex === -1 ? lines.slice(0, 2) : lines.slice(0, educationIndex))
    .slice(0, 3)
    .filter(Boolean);

  return headerLines.join("\n");
}

function formatExperienceEntry(entry: NonNullable<AgentContext["session"]["parsedResumeProfile"]>["experience"][number]) {
  const header = [entry.company, entry.title, entry.date].filter(Boolean).join(" | ");
  return [
    header || entry.title,
    ...entry.bullets.map((bullet) => `- ${bullet}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStructuredResumeFallback(context: AgentContext) {
  const activeResume = getActiveResumeSource(context.session);
  const profile = context.session.parsedResumeProfile;

  if (!activeResume?.content.trim()) {
    return "No grounded optimized resume is available yet.";
  }

  if (!profile) {
    return cleanResumeArtifacts(activeResume.content);
  }

  const headerBlock = extractHeaderBlock(activeResume.content);
  const educationEntries = profile.education.map((item) =>
    [
      [item.school, item.degree, item.date].filter(Boolean).join(" | "),
      ...item.highlights.map((highlight) => `- ${highlight}`)
    ]
      .filter(Boolean)
      .join("\n")
  );
  const experienceEntries = profile.experience.map(formatExperienceEntry);
  const projectEntries = profile.projects.map((project) =>
    [
      project.name,
      ...project.description.map((line) => `- ${line}`),
      project.technologies.length
        ? `Technologies: ${project.technologies.join(", ")}`
        : ""
    ]
      .filter(Boolean)
      .join("\n")
  );
  const skillsLine = profile.skills.length
    ? profile.skills.join(", ")
    : "";

  return cleanResumeArtifacts(
    [
      headerBlock,
      "EDUCATION",
      ...educationEntries,
      experienceEntries.length ? "EXPERIENCE" : "",
      ...experienceEntries,
      projectEntries.length ? "PROJECTS" : "",
      ...projectEntries,
      skillsLine ? "SKILLS" : "",
      skillsLine
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

function isOverCompressedResume(originalResume: string, candidateResume: string) {
  const original = originalResume.trim();
  const candidate = candidateResume.trim();

  if (!original || !candidate) {
    return true;
  }

  const originalLineCount = countNonEmptyLines(original);
  const candidateLineCount = countNonEmptyLines(candidate);
  const originalCharCount = original.replace(/\s+/g, " ").length;
  const candidateCharCount = candidate.replace(/\s+/g, " ").length;
  const originalSectionCount = countResumeSections(original);
  const candidateSectionCount = countResumeSections(candidate);

  return (
    hasResumeMetaFraming(candidate) ||
    candidateLineCount < Math.max(12, Math.floor(originalLineCount * 0.6)) ||
    candidateCharCount < Math.max(700, Math.floor(originalCharCount * 0.55)) ||
    (originalSectionCount >= 3 && candidateSectionCount < Math.max(2, originalSectionCount - 1))
  );
}

function hasExpectedRoleCoverage(
  profile: AgentContext["session"]["parsedResumeProfile"],
  candidateResume: string
) {
  if (!profile) {
    return true;
  }

  const normalized = cleanResumeArtifacts(candidateResume).toLowerCase();
  const signals = profile.experience
    .flatMap((entry) => [entry.company, entry.title])
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index);

  if (!signals.length) {
    return true;
  }

  const matchedCount = signals.filter((signal) =>
    normalized.includes(signal.toLowerCase())
  ).length;

  return matchedCount >= Math.max(2, Math.floor(signals.length * 0.5));
}

function buildStructurePreservingOptimizationPrompt(input: {
  resumeText: string;
  candidateProfile: AgentContext["session"]["parsedResumeProfile"];
  jobProfile: AgentContext["session"]["selectedOpportunityProfile"];
  truthEvidence: Awaited<ReturnType<typeof retrieveTruthEvidence>>;
  opportunityEvidence: Awaited<ReturnType<typeof retrieveOpportunityEvidence>>;
  instruction?: string;
  priorDraft?: string;
}) {
  const originalLineCount = countNonEmptyLines(input.resumeText);
  const minimumLineTarget = Math.max(12, Math.floor(originalLineCount * 0.8));

  return [
    "You are MatchOptimizeAgent for CareerFlow AI.",
    "Rewrite the resume into a full ATS-ready one-page resume using only grounded evidence.",
    "This is a structure-preserving rewrite, not a summary.",
    "Rules:",
    "- Preserve the overall section coverage and density of the original resume unless the user explicitly asked to shorten it.",
    `- Target at least ${minimumLineTarget} non-empty lines so the result stays comparable to the original one-page resume.`,
    "- Keep Education, Experience, Projects, and Skills content when it is supported by evidence.",
    "- Preserve a clear header for every internship, research role, or major position using company, title, and date whenever supported.",
    "- Preserve multiple bullets for major roles and projects instead of collapsing everything into one short list.",
    "- Improve phrasing, ordering, and keyword alignment, but do not invent tools, metrics, dates, awards, roles, or claims.",
    "- Use job keywords only when they are already supported by the truth evidence.",
    "- Return resume text only. No intro sentence, no explanation, no markdown fence, and no meta commentary.",
    "",
    `Instruction: ${input.instruction ?? "Optimize my resume for this job while keeping the full one-page structure."}`,
    "",
    "Original resume text:",
    input.resumeText,
    "",
    input.priorDraft ? "Compressed draft to improve:" : "",
    input.priorDraft ?? "",
    input.priorDraft ? "" : "",
    `Candidate profile: ${JSON.stringify(input.candidateProfile)}`,
    `Job profile: ${JSON.stringify(input.jobProfile)}`,
    "",
    "Truth evidence:",
    ...input.truthEvidence.map((item) => `- ${item.title}: ${item.text}`),
    "",
    "Opportunity evidence:",
    ...input.opportunityEvidence.map((item) => `- ${item.title}: ${item.text}`)
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runMatchOptimizeAgent(
  context: AgentContext,
  options?: {
    mode?: "match" | "optimize";
    instruction?: string;
    selectedResumeSourceId?: string | null;
    selectedSourceId?: string | null;
  }
) {
  const mode = options?.mode ?? "match";
  if (options?.selectedResumeSourceId) {
    setActiveResumeSource(context.session, options.selectedResumeSourceId);
  }
  await ensureParsedSessionState(context, {
    preferredResumeSourceId: options?.selectedResumeSourceId,
    preferredOpportunitySourceId: options?.selectedSourceId
  });

  const candidateProfile = context.session.parsedResumeProfile;
  const jobProfile = context.session.selectedOpportunityProfile;
  const activeResume = getActiveResumeSource(context.session);
  const selectedOpportunity = getSelectedOpportunitySource(
    context.session,
    options?.selectedSourceId ?? undefined
  );

  if (!candidateProfile || !jobProfile || !activeResume || !selectedOpportunity) {
    throw new Error("An active resume and a selected opportunity are required first.");
  }

  const localMatch = compareCandidateToJob(candidateProfile, jobProfile);
  context.session.matchReport = localMatch;
  appendMatchReportSnapshot(context.session, localMatch);

  const resumeOptimizer = new ResumeOptimizerProMcpClient();
  let mcpScore: number | undefined;
  let mcpSummary: string | undefined;
  let mcpMissingKeywords: string[] = [];

  if (resumeOptimizer.isConfigured()) {
    try {
      const scored = await resumeOptimizer.scoreResumeAgainstJob({
        resumeText: activeResume.content,
        jobText: selectedOpportunity.content,
        candidateProfile,
        jobProfile
      });
      mcpScore = scored.score;
      mcpSummary = scored.summary;
      mcpMissingKeywords = scored.missingKeywords;
    } catch (error) {
      context.session.notes = [
        ...context.session.notes,
        error instanceof Error
          ? `Resume Optimizer Pro scoring fallback: ${error.message}`
          : "Resume Optimizer Pro scoring fallback triggered."
      ].slice(-6);
    }
  }

  const matchArtifact = await buildArtifact({
    type: "match_report",
    title: "Match Report",
    content: buildMatchArtifactContent({
      localScore: localMatch.fitScore,
      strengths: localMatch.strengths,
      gaps: localMatch.gaps,
      recommendedEmphasis: localMatch.recommendedEmphasis,
      priorityKeywords: localMatch.priorityKeywords,
      mcpScore,
      mcpSummary,
      missingKeywords: mcpMissingKeywords
    }),
    editable: false,
    chunks: context.chunks,
    session: context.session
  });
  upsertArtifact(context.session.artifacts, matchArtifact);

  const artifacts: DraftArtifact[] = [matchArtifact];
  const summaryParts = [
    `Your local grounded fit is ${localMatch.fitScore}/100.`,
    mcpScore !== undefined
      ? `Resume Optimizer Pro MCP returned ${mcpScore}/100.`
      : "",
    localMatch.gaps[0] ? `Biggest grounded gap: ${localMatch.gaps[0]}` : ""
  ].filter(Boolean);

  if (mode === "optimize") {
    let optimizedResume = "";
    let optimizerLabel = "original resume preserved";

    if (resumeOptimizer.isConfigured()) {
      try {
        const optimized = await resumeOptimizer.optimizeResume({
          resumeText: activeResume.content,
          jobText: selectedOpportunity.content,
          candidateProfile,
          jobProfile,
          options: {
            target: jobProfile.title,
            tone: options?.instruction
          }
        });
        if (optimized.optimizedResume.trim()) {
          optimizedResume = cleanResumeArtifacts(optimized.optimizedResume);
          optimizerLabel = "Resume Optimizer Pro MCP";
        }
      } catch (error) {
        context.session.notes = [
          ...context.session.notes,
          error instanceof Error
            ? `Resume Optimizer Pro optimization fallback: ${error.message}`
            : "Resume Optimizer Pro optimization fallback triggered."
        ].slice(-6);
      }
    }

    const truthEvidence = await retrieveTruthEvidence(
      options?.instruction ?? jobProfile.title,
      context.chunks,
      context.session.sourceManifest,
      6
    );
    const opportunityEvidence = await retrieveOpportunityEvidence(
      options?.instruction ?? jobProfile.title,
      context.chunks,
      context.session.sourceManifest,
      6
    );

    const needsStructurePreservingRewrite = isOverCompressedResume(
      activeResume.content,
      optimizedResume
    );

    if (needsStructurePreservingRewrite) {
      const prompt = buildStructurePreservingOptimizationPrompt({
        resumeText: activeResume.content,
        candidateProfile,
        jobProfile,
        truthEvidence,
        opportunityEvidence,
        instruction: options?.instruction,
        priorDraft: optimizedResume.trim() ? optimizedResume : undefined
      });
      const generated = await generateText(prompt, () => buildLocalOptimizationFallback(context));
      optimizedResume = cleanResumeArtifacts(generated.text);
      optimizerLabel =
        generated.usedModel
          ? optimizedResume.trim() && resumeOptimizer.isConfigured()
            ? "Featherless structure-preserving rewrite"
            : "Featherless structure-preserving rewrite"
          : "original resume preserved";
    }

    if (
      isOverCompressedResume(activeResume.content, optimizedResume) ||
      !hasExpectedRoleCoverage(candidateProfile, optimizedResume)
    ) {
      optimizedResume = buildLocalOptimizationFallback(context);
      optimizerLabel = "original resume preserved";
    }

    const optimizedArtifact = await buildArtifact({
      type: "optimized_resume",
      title: "Optimized Resume",
      content: optimizedResume,
      chunks: context.chunks,
      session: context.session
    });
    upsertArtifact(context.session.artifacts, optimizedArtifact);
    artifacts.push(optimizedArtifact);
    summaryParts.push(
      optimizerLabel === "original resume preserved"
        ? "I preserved your original resume structure because a reliable full-length rewrite was not available."
        : `I created an optimized resume using ${optimizerLabel}.`
    );
  }

  context.updateTrace(
    makeTraceStep(
      "MatchOptimizeAgent",
      mode === "optimize"
        ? "Compared the active resume to the selected opportunity and generated an optimized resume."
        : "Compared the active resume to the selected opportunity and produced a grounded match report.",
      "completed",
      artifacts.map((artifact) => artifact.id),
      [
        "ensureParsedSessionState",
        "compareCandidateToJob",
        "ResumeOptimizerProMcp.scoreResumeAgainstJob",
        ...(mode === "optimize"
          ? ["ResumeOptimizerProMcp.optimizeResume", "generateText"]
          : []),
        "buildArtifact"
      ]
    )
  );

  return {
    matchReport: localMatch,
    artifacts,
    summary: summaryParts.join(" ")
  };
}
