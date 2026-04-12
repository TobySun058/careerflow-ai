import { parseResume } from "@/lib/tools/parse-resume";

import { makeTraceStep, type AgentContext } from "./shared";

export async function runResumeEvidenceAgent(context: AgentContext) {
  const resumeSources = context.session.sourceManifest.filter(
    (source) => source.kind === "truth"
  );
  const resumeText = resumeSources.map((source) => source.content).join("\n\n");
  const chunks = context.chunks.filter((chunk) => chunk.kind === "truth");
  const { candidateProfile } = await parseResume({ text: resumeText, chunks });

  context.updateTrace(
    makeTraceStep(
      "ResumeEvidenceAgent",
      "Parsed resume and extracted grounded candidate signals.",
      "completed"
    )
  );

  return candidateProfile;
}
