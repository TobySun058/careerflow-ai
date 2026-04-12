import type { CandidateProfile, DraftArtifact, JobProfile } from "@/lib/schemas";

export interface ResumeOptimizationProvider {
  optimizeResume(
    candidateProfile: CandidateProfile,
    jobProfile: JobProfile,
    currentDraft: DraftArtifact
  ): Promise<DraftArtifact>;
  exportAtsDocx(artifacts: DraftArtifact[]): Promise<{
    filename: string;
    mimeType: string;
    content: string;
  } | null>;
}
