import { getEnv } from "@/lib/config";

import { McpHttpClient } from "../client/base";
import type { DiceJobDetails, DiceSearchFilters } from "./types";

function normalizeDiceJob(raw: unknown): DiceJobDetails | null {
  const candidate = raw as Record<string, unknown> | null;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const idCandidate =
    candidate.id ??
    candidate.jobId ??
    candidate.externalId ??
    candidate.slug;
  const titleCandidate = candidate.title ?? candidate.jobTitle;
  const companyCandidate = candidate.company ?? candidate.companyName;
  const locationCandidate = candidate.location ?? candidate.city ?? candidate.region;
  const summaryCandidate =
    candidate.summary ?? candidate.snippet ?? candidate.description ?? candidate.teaser;

  if (
    typeof idCandidate !== "string" ||
    typeof titleCandidate !== "string" ||
    typeof companyCandidate !== "string"
  ) {
    return null;
  }

  return {
    id: idCandidate,
    title: titleCandidate,
    company: companyCandidate,
    location: typeof locationCandidate === "string" ? locationCandidate : "Remote",
    summary: typeof summaryCandidate === "string" ? summaryCandidate : "",
    url:
      typeof candidate.url === "string"
        ? candidate.url
        : typeof candidate.link === "string"
          ? candidate.link
          : undefined,
    description:
      typeof candidate.description === "string" ? candidate.description : undefined,
    keywords: Array.isArray(candidate.keywords)
      ? candidate.keywords.filter((item): item is string => typeof item === "string")
      : [],
    provider: "dice_mcp"
  };
}

export class DiceMcpClient {
  private readonly client = new McpHttpClient({
    provider: "Dice",
    baseUrl: getEnv().diceMcpUrl,
    apiKey: getEnv().diceApiKey,
    enabled: getEnv().enableDiceMcp
  });

  isConfigured() {
    return this.client.isConfigured();
  }

  getStatus() {
    return this.client.getStatus();
  }

  async searchJobs(query: string, filters?: DiceSearchFilters) {
    const payload = await this.client.callTool<unknown>("search_jobs", {
      query,
      filters
    });
    const items = Array.isArray(payload)
      ? payload
      : ((payload as { jobs?: unknown[]; results?: unknown[]; items?: unknown[] })?.jobs ??
        (payload as { jobs?: unknown[]; results?: unknown[]; items?: unknown[] })?.results ??
        (payload as { jobs?: unknown[]; results?: unknown[]; items?: unknown[] })?.items ??
        []);

    return items
      .map(normalizeDiceJob)
      .filter((item): item is DiceJobDetails => Boolean(item));
  }

  async getJobDetails(idOrLink: string) {
    const payload = await this.client.callTool<unknown>("get_job_details", {
      id: idOrLink,
      link: idOrLink
    });
    return normalizeDiceJob(payload);
  }
}
