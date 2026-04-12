import { getEnv } from "@/lib/config";

import { McpHttpClient, parseMcpCommandArgs } from "../client/base";
import type { ResumakeGenerateResult, ResumakeResumeData } from "./types";

function extractPdfPath(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const match = value.match(/([A-Za-z]:\\[^"'`\r\n]+\.pdf|\/[^"'`\r\n]+\.pdf|[^"'`\r\n]+\.pdf)/);
    return match?.[1];
  }

  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const directKeys = ["filePath", "path", "outputPath", "pdfPath", "file"];
    for (const key of directKeys) {
      if (typeof candidate[key] === "string" && candidate[key]?.toLowerCase().endsWith(".pdf")) {
        return candidate[key] as string;
      }
    }

    for (const nested of Object.values(candidate)) {
      const nestedPath = extractPdfPath(nested);
      if (nestedPath) {
        return nestedPath;
      }
    }
  }

  return undefined;
}

function extractSummary(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const summary =
      candidate.summary ??
      candidate.message ??
      candidate.result ??
      candidate.output;

    return typeof summary === "string" ? summary : undefined;
  }

  return undefined;
}

export class ResumakeMcpClient {
  private readonly client = new McpHttpClient({
    provider: "Resumake",
    baseUrl: "",
    enabled: getEnv().enableResumakeMcp,
    transport: "stdio",
    command: getEnv().resumakeMcpCommand,
    args: parseMcpCommandArgs(getEnv().resumakeMcpArgs),
    cwd: getEnv().resumakeMcpCwd
  });

  isConfigured() {
    return this.client.isConfigured();
  }

  getStatus() {
    return this.client.getStatus();
  }

  async generateResume(input: {
    resumeData: ResumakeResumeData;
    filename?: string;
    folderPath?: string;
  }): Promise<ResumakeGenerateResult> {
    const payload = await this.client.callTool<unknown>("generate_resume", input);
    const filePath = extractPdfPath(payload);
    const filename =
      typeof payload === "object" && payload && "filename" in (payload as Record<string, unknown>)
        ? String((payload as Record<string, unknown>).filename ?? "")
        : input.filename;

    return {
      filePath,
      filename: filename || filePath?.split(/[\\/]/).pop(),
      summary: extractSummary(payload),
      raw: payload
    };
  }
}
