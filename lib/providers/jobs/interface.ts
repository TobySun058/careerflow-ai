import type { JobSearchResult } from "@/lib/schemas";

export type JobSearchFilters = {
  location?: string;
  remote?: boolean;
};

export interface JobDiscoveryProvider {
  searchJobs(query: string, filters?: JobSearchFilters): Promise<JobSearchResult[]>;
  getJobById(id: string): Promise<JobSearchResult | null>;
}
