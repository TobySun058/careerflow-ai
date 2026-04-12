import { getEnv } from "@/lib/config";
import { makeId } from "@/lib/utils";

import { McpHttpClient, parseMcpCommandArgs } from "../client/base";
import type { JobSpyJobDetails, JobSpySearchFilters } from "./types";

function normalizeJobSpyJob(raw: unknown): JobSpyJobDetails | null {
  const candidate = raw as Record<string, unknown> | null;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const titleCandidate = candidate.title ?? candidate.job_title ?? candidate.position;
  const companyCandidate =
    candidate.company ?? candidate.company_name ?? candidate.organization;
  const locationCandidate =
    candidate.location ?? candidate.job_location ?? candidate.city ?? candidate.region;
  const summaryCandidate =
    candidate.summary ??
    candidate.description ??
    candidate.job_description ??
    candidate.snippet;
  const urlCandidate =
    candidate.url ?? candidate.job_url ?? candidate.link ?? candidate.job_link;
  const siteCandidate = candidate.site ?? candidate.site_name ?? candidate.source;
  const idCandidate =
    candidate.id ??
    candidate.job_id ??
    candidate.uuid ??
    (typeof urlCandidate === "string" ? urlCandidate : undefined);

  if (typeof titleCandidate !== "string" || typeof companyCandidate !== "string") {
    return null;
  }

  return {
    id:
      typeof idCandidate === "string"
        ? idCandidate
        : makeId(`jobspy_${titleCandidate.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
    title: titleCandidate,
    company: companyCandidate,
    location: typeof locationCandidate === "string" ? locationCandidate : "Remote",
    summary: typeof summaryCandidate === "string" ? summaryCandidate : "",
    url: typeof urlCandidate === "string" ? urlCandidate : undefined,
    description:
      typeof candidate.description === "string"
        ? candidate.description
        : typeof candidate.job_description === "string"
          ? candidate.job_description
          : undefined,
    keywords: Array.isArray(candidate.keywords)
      ? candidate.keywords.filter((item): item is string => typeof item === "string")
      : [],
    provider:
      typeof siteCandidate === "string" && siteCandidate.trim()
        ? `jobspy_${siteCandidate}`
        : "jobspy_mcp"
  };
}

function extractResultItems(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === "object" && payload) {
    const candidate = payload as Record<string, unknown>;
    const listCandidate =
      candidate.jobs ??
      candidate.results ??
      candidate.data ??
      candidate.items ??
      candidate.output;

    if (Array.isArray(listCandidate)) {
      return listCandidate;
    }

    if (typeof listCandidate === "string") {
      try {
        const parsed = JSON.parse(listCandidate) as unknown;
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        return [];
      }
    }
  }

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function buildSearchTerm(query: string, filters?: JobSpySearchFilters) {
  return [query.trim(), filters?.employmentType?.trim(), filters?.remote ? "remote" : ""]
    .filter(Boolean)
    .join(" ");
}

export class JobSpyMcpClient {
  private readonly client = new McpHttpClient({
    provider: "JobSpy",
    baseUrl: "",
    enabled: getEnv().enableJobSpyMcp,
    transport: "stdio",
    command: getEnv().jobSpyMcpCommand,
    args: parseMcpCommandArgs(getEnv().jobSpyMcpArgs),
    cwd: getEnv().jobSpyMcpCwd
  });

  isConfigured() {
    return this.client.isConfigured();
  }

  getStatus() {
    return this.client.getStatus();
  }

  async searchJobs(query: string, filters?: JobSpySearchFilters) {
    const payload = await this.client.callTool<unknown>("search_jobs", {
      search_term: buildSearchTerm(query, filters),
      location: filters?.remote ? "Remote" : (filters?.location ?? ""),
      site_names:
        filters?.siteNames?.trim() || getEnv().jobSpySiteNames || "indeed,linkedin,glassdoor",
      results_wanted: filters?.limit ?? 10,
      hours_old: filters?.hoursOld ?? 168,
      country_indeed:
        filters?.countryIndeed ?? getEnv().jobSpyCountryIndeed ?? "USA",
      linkedin_fetch_description:
        filters?.linkedinFetchDescription ?? getEnv().jobSpyFetchLinkedinDescription,
      format: "json",
      output: "careerflow_jobs"
    });

    return extractResultItems(payload)
      .map(normalizeJobSpyJob)
      .filter((item): item is JobSpyJobDetails => Boolean(item));
  }
}
