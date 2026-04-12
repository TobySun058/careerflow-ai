import { getEnv } from "@/lib/config";
import {
  candidateProfileSchema,
  type CandidateProfile,
  type JobProfile
} from "@/lib/schemas";

import { McpHttpClient } from "../client/base";
import type {
  ResumeOptimizerOptimizeOptions,
  ResumeOptimizerOptimizeResult,
  ResumeOptimizerParseInput,
  ResumeOptimizerParseResult,
  ResumeOptimizerScoreResult
} from "./types";

function normalizeCandidateProfile(raw: unknown): CandidateProfile | null {
  const candidate = raw as Partial<CandidateProfile> | undefined;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  try {
    return candidateProfileSchema.parse({
      name: candidate.name ?? "Candidate",
      summary: candidate.summary ?? "",
      education: candidate.education ?? [],
      skills: candidate.skills ?? [],
      experience: candidate.experience ?? [],
      projects: candidate.projects ?? [],
      domains: candidate.domains ?? [],
      evidenceRefs: candidate.evidenceRefs ?? []
    });
  } catch {
    return null;
  }
}

export class ResumeOptimizerProMcpClient {
  private readonly client = new McpHttpClient({
    provider: "Resume Optimizer Pro",
    baseUrl: getEnv().resumeOptimizerProMcpUrl,
    apiKey: getEnv().resumeOptimizerProApiKey,
    enabled: getEnv().enableResumeOptimizerProMcp
  });

  isConfigured() {
    return this.client.isConfigured();
  }

  getStatus() {
    return this.client.getStatus();
  }

  async parseResume(input: ResumeOptimizerParseInput): Promise<ResumeOptimizerParseResult> {
    const payload = await this.client.callTool<Record<string, unknown>>("parse_resume", input);
    return {
      candidateProfile: normalizeCandidateProfile(
        payload.candidateProfile ?? payload.profile ?? payload.resumeProfile ?? payload
      ),
      summary:
        typeof payload.summary === "string"
          ? payload.summary
          : typeof payload.resumeSummary === "string"
            ? payload.resumeSummary
            : undefined,
      atsScore:
        typeof payload.atsScore === "number"
          ? payload.atsScore
          : typeof payload.score === "number"
            ? payload.score
            : undefined,
      raw: payload
    };
  }

  async scoreResumeAgainstJob(input: {
    resumeText: string;
    jobText: string;
    candidateProfile?: CandidateProfile | null;
    jobProfile?: JobProfile | null;
  }): Promise<ResumeOptimizerScoreResult> {
    const payload = await this.client.callTool<Record<string, unknown>>(
      "score_resume_against_job",
      input
    );

    return {
      score:
        typeof payload.score === "number"
          ? payload.score
          : typeof payload.matchScore === "number"
            ? payload.matchScore
            : typeof payload.atsScore === "number"
              ? payload.atsScore
              : undefined,
      strengths: Array.isArray(payload.strengths)
        ? payload.strengths.filter((item): item is string => typeof item === "string")
        : [],
      gaps: Array.isArray(payload.gaps)
        ? payload.gaps.filter((item): item is string => typeof item === "string")
        : [],
      missingKeywords: Array.isArray(payload.missingKeywords)
        ? payload.missingKeywords.filter((item): item is string => typeof item === "string")
        : Array.isArray(payload.keywords)
          ? payload.keywords.filter((item): item is string => typeof item === "string")
          : [],
      summary:
        typeof payload.summary === "string"
          ? payload.summary
          : typeof payload.recommendation === "string"
            ? payload.recommendation
            : undefined,
      raw: payload
    };
  }

  async optimizeResume(input: {
    resumeText: string;
    jobText: string;
    candidateProfile?: CandidateProfile | null;
    jobProfile?: JobProfile | null;
    options?: ResumeOptimizerOptimizeOptions;
  }): Promise<ResumeOptimizerOptimizeResult> {
    const payload = await this.client.callTool<Record<string, unknown>>("optimize_resume", input);
    return {
      optimizedResume:
        typeof payload.optimizedResume === "string"
          ? payload.optimizedResume
          : typeof payload.resume === "string"
            ? payload.resume
            : typeof payload.content === "string"
              ? payload.content
              : "",
      summary:
        typeof payload.summary === "string"
          ? payload.summary
          : typeof payload.notes === "string"
            ? payload.notes
            : undefined,
      raw: payload
    };
  }
}
