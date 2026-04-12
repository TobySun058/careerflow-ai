import { parseJobDescription } from "@/lib/tools/parse-job";

import { makeTraceStep, type AgentContext } from "./shared";

export async function runRoleResearchAgent(context: AgentContext) {
  const opportunitySources = context.session.sourceManifest.filter(
    (source) => source.kind === "opportunity"
  );
  const opportunityText = opportunitySources.map((source) => source.content).join("\n\n");
  const chunks = context.chunks.filter((chunk) => chunk.kind === "opportunity");
  const { jobProfile } = await parseJobDescription({ text: opportunityText, chunks });

  context.updateTrace(
    makeTraceStep(
      "RoleResearchAgent",
      "Parsed job sources and distilled role requirements.",
      "completed"
    )
  );

  return jobProfile;
}
