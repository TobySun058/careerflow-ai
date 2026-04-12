import { getEnv } from "@/lib/config";

import type { ResumeOptimizationProvider } from "./interface";
import { InternalResumeOptimizationProvider } from "./internal";
import { ResumeOptimizerProProvider } from "./resume-optimizer-pro";

export function getResumeOptimizerProvider(): ResumeOptimizationProvider {
  const env = getEnv();
  return env.resumeOptimizerMode === "resume_optimizer_pro"
    ? new ResumeOptimizerProProvider()
    : new InternalResumeOptimizationProvider();
}
