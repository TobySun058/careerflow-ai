import type { DraftArtifact } from "@/lib/schemas";

import type { CvStylingProvider } from "./interface";

export class NoCvStylingProvider implements CvStylingProvider {
  async exportStyledResume(_artifacts: DraftArtifact[]) {
    return null;
  }
}
