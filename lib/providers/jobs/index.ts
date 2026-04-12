import { getEnv } from "@/lib/config";

import type { JobDiscoveryProvider } from "./interface";
import { DiceJobDiscoveryProvider } from "./dice";
import { ManualJobDiscoveryProvider } from "./manual";

export function getJobDiscoveryProvider(): JobDiscoveryProvider {
  const env = getEnv();
  return env.jobDiscoveryMode === "dice"
    ? new DiceJobDiscoveryProvider()
    : new ManualJobDiscoveryProvider();
}
