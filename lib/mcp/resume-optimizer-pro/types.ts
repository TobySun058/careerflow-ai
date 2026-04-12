import type { CandidateProfile } from "@/lib/schemas";

export type ResumeOptimizerParseInput = {
  text: string;
  title?: string;
};

export type ResumeOptimizerParseResult = {
  candidateProfile: CandidateProfile | null;
  summary?: string;
  atsScore?: number;
  raw?: unknown;
};

export type ResumeOptimizerScoreResult = {
  score?: number;
  strengths: string[];
  gaps: string[];
  missingKeywords: string[];
  summary?: string;
  raw?: unknown;
};

export type ResumeOptimizerOptimizeOptions = {
  tone?: string;
  target?: string;
};

export type ResumeOptimizerOptimizeResult = {
  optimizedResume: string;
  summary?: string;
  raw?: unknown;
};
