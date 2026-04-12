import type { CandidateProfile, JobProfile, MatchReport } from "@/lib/schemas";

function normalize(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((item) => item.toLowerCase().trim())
        .filter(Boolean)
    )
  );
}

export function compareCandidateToJob(
  candidate: CandidateProfile,
  job: JobProfile
): MatchReport {
  const candidateSignals = normalize([
    ...candidate.skills,
    ...candidate.domains,
    ...candidate.experience.flatMap((item) => [
      item.title,
      item.company ?? "",
      ...item.bullets
    ]),
    ...candidate.projects.flatMap((project) => [
      project.name,
      ...project.description,
      ...project.technologies
    ])
  ]);

  const required = normalize(job.requiredSkills);
  const preferred = normalize(job.preferredSkills);
  const keywords = normalize(job.keywords);
  const responsibilities = normalize(job.responsibilities);

  const hit = (signal: string) =>
    candidateSignals.some((candidateSignal) => candidateSignal.includes(signal));

  const requiredHits = required.filter(hit);
  const preferredHits = preferred.filter(hit);
  const keywordHits = keywords.filter(hit);

  const requiredScore = required.length
    ? requiredHits.length / required.length
    : 0.65;
  const preferredScore = preferred.length
    ? preferredHits.length / preferred.length
    : 0.5;
  const keywordScore = keywords.length ? keywordHits.length / keywords.length : 0.5;
  const responsibilityScore = responsibilities.length
    ? responsibilities.filter(hit).length / responsibilities.length
    : 0.5;

  const fitScore = Math.round(
    Math.min(
      100,
      (requiredScore * 0.45 +
        preferredScore * 0.15 +
        keywordScore * 0.2 +
        responsibilityScore * 0.2) *
        100
    )
  );

  const strengths = [
    ...requiredHits.slice(0, 3).map((item) => `Strong evidence for ${item}.`),
    ...keywordHits
      .slice(0, 2)
      .map((item) => `Resume language already aligns with ${item}.`)
  ];

  const missing = required.filter((item) => !requiredHits.includes(item));
  const softGaps = preferred.filter((item) => !preferredHits.includes(item));

  return {
    fitScore,
    strengths: strengths.length
      ? strengths
      : ["Relevant product engineering and AI workflow experience."],
    gaps: [
      ...missing
        .slice(0, 4)
        .map((item) => `No strong truth-store evidence yet for ${item}.`),
      ...softGaps
        .slice(0, 2)
        .map(
          (item) =>
            `Preferred signal ${item} may need to be positioned as adjacent experience.`
        )
    ],
    recommendedEmphasis: [
      ...requiredHits
        .slice(0, 3)
        .map((item) => `Lead with evidence that demonstrates ${item}.`),
      ...responsibilities
        .slice(0, 2)
        .map((item) => `Highlight work connected to: ${item}.`)
    ],
    priorityKeywords: Array.from(
      new Set([...required.slice(0, 6), ...keywords.slice(0, 6)])
    ).slice(0, 8),
    sourceRefs: [...candidate.evidenceRefs.slice(0, 3), ...job.sourceRefs.slice(0, 3)]
  };
}
