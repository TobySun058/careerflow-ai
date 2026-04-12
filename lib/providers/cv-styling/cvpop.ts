import type { DraftArtifact } from "@/lib/schemas";

import type { CvStylingProvider } from "./interface";

export class CvPopProvider implements CvStylingProvider {
  async exportStyledResume(_artifacts: DraftArtifact[]): Promise<{
    filename: string;
    mimeType: string;
    content: string;
  } | null> {
    return Promise.reject(
      new Error(
        "cvpop styling is not configured in this MVP. Switch CV_STYLING_MODE=none to keep resume export internal."
      )
    );
  }
}
