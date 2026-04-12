import type {
  CandidateProfile,
  DraftArtifact,
  JobProfile
} from "@/lib/schemas";

import type { ResumeOptimizationProvider } from "./interface";

export class InternalResumeOptimizationProvider
  implements ResumeOptimizationProvider
{
  async optimizeResume(
    _candidateProfile: CandidateProfile,
    _jobProfile: JobProfile,
    currentDraft: DraftArtifact
  ) {
    return currentDraft;
  }

  async exportAtsDocx(artifacts: DraftArtifact[]) {
    const content = artifacts
      .filter(
        (artifact) =>
          artifact.type === "resume_rewrite" || artifact.type === "ats_resume"
      )
      .map((artifact) => `# ${artifact.title}\n\n${artifact.content}`)
      .join("\n\n");

    return {
      filename: "careerflow-ats-export.txt",
      mimeType: "text/plain",
      content
    };
  }
}
