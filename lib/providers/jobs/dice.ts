import type { JobSearchResult } from "@/lib/schemas";

import type { JobDiscoveryProvider, JobSearchFilters } from "./interface";

export class DiceJobDiscoveryProvider implements JobDiscoveryProvider {
  async searchJobs(
    _query: string,
    _filters?: JobSearchFilters
  ): Promise<JobSearchResult[]> {
    return Promise.reject(
      new Error(
        "Dice adapter is not configured in this MVP. Set JOB_DISCOVERY_MODE=manual or add a Dice integration."
      )
    );
  }

  async getJobById(_id: string): Promise<JobSearchResult | null> {
    return Promise.reject(
      new Error(
        "Dice adapter is not configured in this MVP. Set JOB_DISCOVERY_MODE=manual or add a Dice integration."
      )
    );
  }
}
