import type { AgentContext } from "@/lib/agents/shared";
import { buildArtifact, makeTraceStep, upsertArtifact } from "@/lib/agents/shared";
import type {
  CandidateProfile,
  DraftArtifact,
  ExperienceItem,
  JobProfile,
  MatchReport,
  ProjectItem
} from "@/lib/schemas";
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
import { tokenize, truncate } from "@/lib/utils";

import { ensureParsedSessionState } from "./source-ingest";

function buildMatchArtifactContent(input: {
  localScore: number;
  strengths: string[];
  gaps: string[];
  recommendedEmphasis: string[];
  priorityKeywords: string[];
}) {
  return [
    `Local grounded score: ${input.localScore}/100`,
    "",
    "Strengths:",
    ...input.strengths.map((item) => `- ${item}`),
    "",
    "Gaps:",
    ...input.gaps.map((item) => `- ${item}`),
    "",
    "Missing keywords:",
    ...input.priorityKeywords.slice(0, 6).map((item) => `- ${item}`),
    "",
    "Recommended emphasis:",
    ...input.recommendedEmphasis.map((item) => `- ${item}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanText(text: string) {
  return text
    .replace(/[閳烩枲鈻€⑩棌]/g, "-")
    .replace(/[閳モ€撯€擼]/g, "-")
    .replace(/[鑴趁梋]/g, "x")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scoreEntryAgainstKeywords(text: string, keywords: string[]) {
  const entryTokens = new Set(tokenize(text));
  if (!entryTokens.size || !keywords.length) {
    return 0;
  }

  return keywords.reduce((score, keyword) => {
    const keywordTokens = tokenize(keyword);
    if (!keywordTokens.length) {
      return score;
    }

    const matches = keywordTokens.filter((token) => entryTokens.has(token)).length;
    return score + matches / keywordTokens.length;
  }, 0);
}

function experienceHeader(entry: ExperienceItem) {
  return [entry.company, entry.title, entry.date].filter(Boolean).join(" | ") || entry.title;
}

function projectHeader(project: ProjectItem) {
  return project.name;
}

function rankExperienceEntries(
  candidateProfile: CandidateProfile,
  jobProfile: JobProfile,
  keywords: string[],
  limit = 3
) {
  const targetSignals = [
    ...jobProfile.requiredSkills,
    ...jobProfile.preferredSkills,
    ...jobProfile.keywords,
    ...jobProfile.responsibilities,
    ...keywords
  ].filter(Boolean);

  return candidateProfile.experience
    .map((entry) => {
      const entryText = [entry.title, entry.company ?? "", ...entry.bullets].join(" ");
      const matchedKeywords = targetSignals.filter(
        (signal) => scoreEntryAgainstKeywords(entryText, [signal]) >= 0.5
      );
      return {
        entry,
        matchedKeywords,
        score: scoreEntryAgainstKeywords(entryText, targetSignals)
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function rankProjectEntries(
  candidateProfile: CandidateProfile,
  jobProfile: JobProfile,
  keywords: string[],
  limit = 2
) {
  const targetSignals = [
    ...jobProfile.requiredSkills,
    ...jobProfile.preferredSkills,
    ...jobProfile.keywords,
    ...jobProfile.responsibilities,
    ...keywords
  ].filter(Boolean);

  return candidateProfile.projects
    .map((project) => {
      const projectText = [project.name, ...project.description, ...project.technologies].join(" ");
      const matchedKeywords = targetSignals.filter(
        (signal) => scoreEntryAgainstKeywords(projectText, [signal]) >= 0.5
      );
      return {
        project,
        matchedKeywords,
        score: scoreEntryAgainstKeywords(projectText, targetSignals)
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function buildResumeEditGuideFallback(input: {
  candidateProfile: CandidateProfile;
  jobProfile: JobProfile;
  matchReport: MatchReport;
}) {
  const relevantExperience = rankExperienceEntries(
    input.candidateProfile,
    input.jobProfile,
    input.matchReport.priorityKeywords
  );
  const relevantProjects = rankProjectEntries(
    input.candidateProfile,
    input.jobProfile,
    input.matchReport.priorityKeywords
  );
  const education = input.candidateProfile.education[0];
  const keywordList = Array.from(
    new Set(input.matchReport.priorityKeywords)
  ).slice(0, 8);

  return cleanText(
    [
      "Use this as an edit guide for your current resume. Keep the existing one-page structure and update only the sections below.",
      "",
      "Overall positioning:",
      `- Target role: ${input.jobProfile.title} at ${input.jobProfile.company}.`,
      `- Local grounded fit: ${input.matchReport.fitScore}/100.`,
      ...input.matchReport.recommendedEmphasis
        .slice(0, 3)
        .map((item) => `- ${item}`),
      "",
      "Where to change:",
      "1. Education / top-of-resume positioning",
      education
        ? `- Keep ${[education.school, education.degree, education.date]
            .filter(Boolean)
            .join(" | ")} visible near the top.`
        : "- Keep your strongest education signal visible near the top.",
      "- If coursework is already listed, move the most role-relevant items earlier instead of adding new ones.",
      "",
      "2. Skills section",
      keywordList.length
        ? `- Bring these already-supported keywords higher if they are genuinely covered elsewhere in the resume: ${keywordList.join(", ")}.`
        : "- Bring the most role-relevant technical keywords higher in the skills section only when they are already supported.",
      "- Remove weak filler before removing strong technical evidence.",
      "",
      ...relevantExperience.flatMap(({ entry, matchedKeywords }, index) => [
        `${index + 3}. ${experienceHeader(entry)}`,
        `- Keep: ${truncate(entry.bullets[0] ?? entry.title, 180)}.`,
        matchedKeywords.length
          ? `- Change: move the bullet(s) tied to ${matchedKeywords.slice(0, 3).join(", ")} higher in this role and tighten them for ATS scanning.`
          : "- Change: make the first bullet in this role more directly relevant to the target job and cut lower-signal details.",
        entry.bullets[1]
          ? `- Candidate focus: ${truncate(entry.bullets[1], 180)}.`
          : "- Candidate focus: keep the strongest quantified or systems-heavy bullet near the top."
      ]),
      ...relevantProjects.flatMap(({ project, matchedKeywords }, index) => [
        `${relevantExperience.length + index + 3}. ${projectHeader(project)}`,
        `- Keep: ${truncate(project.description[0] ?? project.name, 180)}.`,
        matchedKeywords.length
          ? `- Change: explicitly foreground the project parts connected to ${matchedKeywords.slice(0, 3).join(", ")}.`
          : "- Change: only keep this project if it helps the target role more than another stronger section."
      ]),
      "",
      "Keywords to weave in:",
      ...(keywordList.length
        ? keywordList.map((item) => `- ${item}`)
        : ["- Use only keywords that are already supported by your resume evidence."]),
      "",
      "Gaps to address honestly:",
      ...input.matchReport.gaps.slice(0, 3).map((item) => `- ${item}`),
      "",
      "Do not invent or overstate:",
      "- Do not add tools, leadership claims, dates, metrics, or coursework unless they are already true and grounded in the resume.",
      "- Do not replace strong quantified bullets with vague summaries."
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function buildResumeEditGuidePrompt(input: {
  candidateProfile: CandidateProfile;
  jobProfile: JobProfile;
  matchReport: MatchReport;
  activeResumeText: string;
  truthEvidence: Awaited<ReturnType<typeof retrieveTruthEvidence>>;
  opportunityEvidence: Awaited<ReturnType<typeof retrieveOpportunityEvidence>>;
  instruction?: string;
}) {
  const relevantExperience = rankExperienceEntries(
    input.candidateProfile,
    input.jobProfile,
    input.matchReport.priorityKeywords,
    4
  ).map(({ entry, matchedKeywords }) => ({
    header: experienceHeader(entry),
    bullets: entry.bullets.slice(0, 3),
    matchedKeywords
  }));
  const relevantProjects = rankProjectEntries(
    input.candidateProfile,
    input.jobProfile,
    input.matchReport.priorityKeywords,
    2
  ).map(({ project, matchedKeywords }) => ({
    header: projectHeader(project),
    bullets: project.description.slice(0, 2),
    matchedKeywords
  }));

  return [
    "You are MatchOptimizeAgent for CareerFlow AI.",
    "Do not rewrite the entire resume.",
    "Produce a targeted resume edit guide that tells the user exactly where to change their current resume for the selected role.",
    "Rules:",
    "- Use only grounded evidence from the resume truth store and the selected opportunity.",
    "- Keep the user's existing one-page structure; do not produce a replacement resume.",
    "- Reference specific existing sections or role headers when possible.",
    "- For each recommended change, say what to edit, what to emphasize, and why it matters for the role.",
    "- Only suggest keywords that are already supported by truth evidence. If a keyword is unsupported, say not to add it unless true.",
    "- Keep the response concise, structured, and copy-editable.",
    "- Return plain text only with these sections: Overall positioning, Where to change, Keywords to weave in, Gaps to address honestly, Do not invent.",
    "",
    `Instruction: ${input.instruction ?? "Tell me where to change this resume for the selected job."}`,
    "",
    "Current resume text:",
    input.activeResumeText,
    "",
    `Candidate profile: ${JSON.stringify(input.candidateProfile)}`,
    `Job profile: ${JSON.stringify(input.jobProfile)}`,
    `Match report: ${JSON.stringify(input.matchReport)}`,
    `Relevant experience blocks: ${JSON.stringify(relevantExperience)}`,
    `Relevant projects: ${JSON.stringify(relevantProjects)}`,
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

  const matchArtifact = await buildArtifact({
    type: "match_report",
    title: "Match Report",
    content: buildMatchArtifactContent({
      localScore: localMatch.fitScore,
      strengths: localMatch.strengths,
      gaps: localMatch.gaps,
      recommendedEmphasis: localMatch.recommendedEmphasis,
      priorityKeywords: localMatch.priorityKeywords
    }),
    editable: false,
    chunks: context.chunks,
    session: context.session
  });
  upsertArtifact(context.session.artifacts, matchArtifact);

  const artifacts: DraftArtifact[] = [matchArtifact];
  const summaryParts = [
    `Your local grounded fit is ${localMatch.fitScore}/100.`,
    localMatch.gaps[0] ? `Biggest grounded gap: ${localMatch.gaps[0]}` : ""
  ].filter(Boolean);

  if (mode === "optimize") {
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

    const generated = await generateText(
      buildResumeEditGuidePrompt({
        candidateProfile,
        jobProfile,
        matchReport: localMatch,
        activeResumeText: activeResume.content,
        truthEvidence,
        opportunityEvidence,
        instruction: options?.instruction
      }),
      () =>
        buildResumeEditGuideFallback({
          candidateProfile,
          jobProfile,
          matchReport: localMatch
        })
    );

    const editGuide =
      cleanText(generated.text) ||
      buildResumeEditGuideFallback({
        candidateProfile,
        jobProfile,
        matchReport: localMatch
      });

    context.session.artifacts = context.session.artifacts.filter(
      (artifact) => artifact.type !== "optimized_resume"
    );

    const guidanceArtifact = await buildArtifact({
      type: "resume_edit_guide",
      title: "Resume Edit Guide",
      content: editGuide,
      chunks: context.chunks,
      session: context.session
    });
    upsertArtifact(context.session.artifacts, guidanceArtifact);
    artifacts.push(guidanceArtifact);
    summaryParts.push(
      "I created a section-by-section resume edit guide based on your current resume and the selected role, instead of rewriting the whole resume."
    );
  }

  context.updateTrace(
    makeTraceStep(
      "MatchOptimizeAgent",
      mode === "optimize"
        ? "Compared the active resume to the selected opportunity and produced targeted resume edit guidance."
        : "Compared the active resume to the selected opportunity and produced a grounded match report.",
      "completed",
      artifacts.map((artifact) => artifact.id),
      [
        "ensureParsedSessionState",
        "compareCandidateToJob",
        ...(mode === "optimize"
          ? ["retrieveTruthEvidence", "retrieveOpportunityEvidence", "generateText"]
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
