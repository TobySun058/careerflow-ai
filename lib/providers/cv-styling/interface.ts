import type { DraftArtifact } from "@/lib/schemas";

export interface CvStylingProvider {
  exportStyledResume(artifacts: DraftArtifact[]): Promise<{
    filename: string;
    mimeType: string;
    content: string;
  } | null>;
}
