import { getEnv } from "@/lib/config";
import { truncate } from "@/lib/utils";

import { McpHttpClient } from "../client/base";
import type { DecodoPageResult } from "./types";

function normalizePage(url: string, raw: unknown): DecodoPageResult {
  const candidate = raw as Record<string, unknown> | null;
  const content =
    typeof candidate?.content === "string"
      ? candidate.content
      : typeof candidate?.text === "string"
        ? candidate.text
        : typeof candidate?.body === "string"
          ? candidate.body
          : typeof raw === "string"
            ? raw
            : "";
  const title =
    typeof candidate?.title === "string"
      ? candidate.title
      : typeof candidate?.pageTitle === "string"
        ? candidate.pageTitle
        : url;

  return {
    url,
    title,
    content,
    preview: truncate(content, 320)
  };
}

export class DecodoMcpClient {
  private readonly client = new McpHttpClient({
    provider: "Decodo",
    baseUrl: getEnv().decodoMcpUrl,
    apiKey: getEnv().decodoApiKey,
    enabled: getEnv().enableDecodoMcp
  });

  isConfigured() {
    return this.client.isConfigured();
  }

  getStatus() {
    return this.client.getStatus();
  }

  async fetchPage(url: string, options?: Record<string, unknown>) {
    const payload = await this.client.callTool<unknown>("fetch_page", {
      url,
      options
    });
    return normalizePage(url, payload);
  }

  async extractStructuredText(url: string) {
    const payload = await this.client.callTool<unknown>("extract_structured_text", {
      url
    });
    return normalizePage(url, payload);
  }
}
