import type { DraftArtifact } from "@/lib/schemas";
import { compareCandidateToJob } from "@/lib/tools/compare";

import {
  buildArtifact,
  makeTraceStep,
  requireProfiles,
  type AgentContext
} from "./shared";

export async function runMatchAgent(context: AgentContext) {
  const { candidateProfile, jobProfile } = requireProfiles(
    context.session.candidateProfile,
    context.session.jobProfile
  );
  const matchReport = compareCandidateToJob(candidateProfile, jobProfile);

  const content = [
    `Fit score: ${matchReport.fitScore}/100`,
    "",
    "Strengths:",
    ...matchReport.strengths.map((item) => `- ${item}`),
    "",
    "Gaps:",
    ...matchReport.gaps.map((item) => `- ${item}`),
    "",
    "Recommended emphasis:",
    ...matchReport.recommendedEmphasis.map((item) => `- ${item}`),
    "",
    "Priority keywords:",
    ...matchReport.priorityKeywords.map((item) => `- ${item}`)
  ].join("\n");

  const artifact: DraftArtifact = await buildArtifact({
    type: "match",
    title: "Match Analysis",
    content,
    chunks: context.chunks,
    session: context.session
  });

  context.updateTrace(
    makeTraceStep(
      "MatchAgent",
      "Compared candidate evidence to role requirements and scored fit.",
      "completed",
      [artifact.id]
    )
  );

  return {
    matchReport,
    artifact
  };
}
