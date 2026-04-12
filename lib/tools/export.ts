import type { SessionRecord } from "@/lib/schemas";

export function exportArtifacts(
  session: SessionRecord,
  format: "json" | "markdown" = "markdown"
) {
  if (format === "json") {
    return {
      filename: `${session.id}-careerflow.json`,
      mimeType: "application/json",
      content: JSON.stringify(session, null, 2)
    };
  }

  const content = [
    "# CareerFlow AI Export",
    "",
    `Session: ${session.id}`,
    `Updated: ${session.updatedAt}`,
    "",
    ...session.artifacts.flatMap((artifact) => [
      `## ${artifact.title}`,
      "",
      artifact.content,
      ""
    ])
  ].join("\n");

  return {
    filename: `${session.id}-careerflow.md`,
    mimeType: "text/markdown",
    content
  };
}
