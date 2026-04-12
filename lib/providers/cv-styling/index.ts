import { getEnv } from "@/lib/config";

import type { CvStylingProvider } from "./interface";
import { CvPopProvider } from "./cvpop";
import { NoCvStylingProvider } from "./none";

export function getCvStylingProvider(): CvStylingProvider {
  const env = getEnv();
  return env.cvStylingMode === "cvpop"
    ? new CvPopProvider()
    : new NoCvStylingProvider();
}
