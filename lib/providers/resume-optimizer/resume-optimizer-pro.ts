import type {
  CandidateProfile,
  DraftArtifact,
  JobProfile
} from "@/lib/schemas";

import type { ResumeOptimizationProvider } from "./interface";

export class ResumeOptimizerProProvider implements ResumeOptimizationProvider {
  async optimizeResume(
    _candidateProfile: CandidateProfile,
    _jobProfile: JobProfile,
    currentDraft: DraftArtifact
  ) {
    return currentDraft;
  }

  async exportAtsDocx(_artifacts: DraftArtifact[]): Promise<{
    filename: string;
    mimeType: string;
    content: string;
  } | null> {
    return Promise.reject(
      new Error(
        "resume_optimizer_pro is not configured in this MVP. Switch RESUME_OPTIMIZER_MODE=internal to keep export local."
      )
    );
  }
}
