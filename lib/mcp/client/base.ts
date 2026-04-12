import { getEnv } from "@/lib/config";
import type { McpStatus, McpTransport } from "@/lib/schemas/mcp";
import { spawn } from "child_process";

type McpClientOptions = {
  provider: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  transport?: McpTransport;
  command?: string;
  args?: string[];
  cwd?: string;
};

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function parseMcpCommandArgs(value: string) {
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fall back to a simple whitespace split when the env var is not JSON.
  }

  return value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeToolPayload<T>(payload: unknown) {
  const candidate = payload as {
    result?: T;
    data?: T;
    output?: T;
  };

  return candidate?.result ?? candidate?.data ?? candidate?.output ?? (payload as T);
}

function normalizeStdioToolPayload<T>(payload: unknown) {
  const normalized = normalizeToolPayload<unknown>(payload);
  const candidate = normalized as
    | {
        content?: Array<{
          type?: string;
          text?: string;
          resource?: unknown;
        }>;
      }
    | undefined;

  if (Array.isArray(candidate?.content)) {
    const textBlocks = candidate.content
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text?.trim())
      .filter(Boolean) as string[];

    if (textBlocks.length === 1) {
      try {
        return normalizeToolPayload<T>(JSON.parse(textBlocks[0]));
      } catch {
        return textBlocks[0] as T;
      }
    }

    if (textBlocks.length > 1) {
      return textBlocks.join("\n") as T;
    }

    const resourcePayload = candidate.content.find((item) => item.resource)?.resource;
    if (resourcePayload) {
      return normalizeToolPayload<T>(resourcePayload);
    }
  }

  return normalized as T;
}

export class McpHttpClient {
  private readonly provider: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;
  private readonly transport: McpTransport;
  private readonly command: string;
  private readonly args: string[];
  private readonly cwd: string;

  constructor(options: McpClientOptions) {
    const env = getEnv();
    this.provider = options.provider;
    this.baseUrl = stripTrailingSlash(options.baseUrl);
    this.apiKey = options.apiKey ?? "";
    this.enabled = options.enabled;
    this.transport = options.transport ?? (env.mcpTransport as McpTransport);
    this.command = options.command ?? "";
    this.args = options.args ?? [];
    this.cwd = options.cwd ?? process.cwd();
  }

  getStatus(): McpStatus {
    if (!this.enabled) {
      return {
        configured: false,
        provider: this.provider,
        reason: `${this.provider} MCP is disabled by environment flag.`
      };
    }

    if (this.transport === "stdio") {
      if (!this.command) {
        return {
          configured: false,
          provider: this.provider,
          reason: `${this.provider} MCP command is missing.`
        };
      }

      return {
        configured: true,
        provider: this.provider
      };
    }

    if (!this.baseUrl) {
      return {
        configured: false,
        provider: this.provider,
        reason: `${this.provider} MCP URL is missing.`
      };
    }

    return {
      configured: true,
      provider: this.provider
    };
  }

  isConfigured() {
    return this.getStatus().configured;
  }

  async callTool<T>(tool: string, input: unknown): Promise<T> {
    if (this.transport === "stdio") {
      return this.callToolOverStdio<T>(tool, input);
    }

    const status = this.getStatus();
    if (!status.configured) {
      throw new Error(status.reason ?? `${this.provider} MCP is not configured.`);
    }

    const endpoint =
      this.transport === "tool-path" ? `${this.baseUrl}/${tool}` : this.baseUrl;
    const body =
      this.transport === "tool-path"
        ? input
        : {
            tool,
            input
          };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey
          ? {
              Authorization: `Bearer ${this.apiKey}`,
              "X-API-Key": this.apiKey
            }
          : {})
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const rawText = await response.text();
    let payload: unknown = rawText;

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = rawText;
    }

    if (!response.ok) {
      throw new Error(
        `${this.provider} MCP request failed (${response.status}): ${
          typeof payload === "string" ? payload : JSON.stringify(payload)
        }`
      );
    }

    return normalizeToolPayload<T>(payload);
  }

  private async callToolOverStdio<T>(tool: string, input: unknown): Promise<T> {
    const status = this.getStatus();
    if (!status.configured) {
      throw new Error(status.reason ?? `${this.provider} MCP is not configured.`);
    }

    const child = spawn(this.command, this.args, {
      cwd: this.cwd || process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const stderrChunks: string[] = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });

    let buffer = "";
    const pending = new Map<
      number,
      {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
      }
    >();
    let nextId = 1;
    let exited = false;
    let finished = false;

    const failAll = (error: Error) => {
      pending.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(error);
      });
      pending.clear();
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        try {
          const message = JSON.parse(trimmed) as {
            id?: number;
            result?: unknown;
            error?: { message?: string };
          };
          if (typeof message.id === "number" && pending.has(message.id)) {
            const entry = pending.get(message.id);
            if (!entry) {
              continue;
            }

            clearTimeout(entry.timeout);
            pending.delete(message.id);

            if (message.error) {
              entry.reject(
                new Error(
                  `${this.provider} MCP error: ${message.error.message ?? JSON.stringify(message.error)}`
                )
              );
            } else {
              entry.resolve(message.result);
            }
          }
        } catch {
          // Ignore non-JSON stdout lines. MCP servers should avoid this, but we do not want to crash.
        }
      }
    });

    const exitPromise = new Promise<never>((_, reject) => {
      child.once("exit", (code) => {
        if (finished) {
          return;
        }
        exited = true;
        const stderr = stderrChunks.join("").trim();
        failAll(
          new Error(
            `${this.provider} MCP exited before completing the request${
              code != null ? ` (code ${code})` : ""
            }${stderr ? `: ${stderr}` : "."}`
          )
        );
        reject(
          new Error(
            `${this.provider} MCP exited before completing the request${
              code != null ? ` (code ${code})` : ""
            }${stderr ? `: ${stderr}` : "."}`
          )
        );
      });
      child.once("error", (error) => {
        if (finished) {
          return;
        }
        failAll(error instanceof Error ? error : new Error(String(error)));
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });

    const request = (method: string, params: unknown) =>
      new Promise<unknown>((resolve, reject) => {
        const id = nextId++;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${this.provider} MCP request timed out for ${method}.`));
        }, 30000);

        pending.set(id, { resolve, reject, timeout });
        child.stdin.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id,
            method,
            params
          })}\n`
        );
      });

    const notify = (method: string, params: unknown) => {
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          method,
          params
        })}\n`
      );
    };

    try {
      await Promise.race([
        request("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "CareerFlow AI",
            version: "0.1.0"
          }
        }),
        exitPromise
      ]);

      notify("notifications/initialized", {});

      const result = await Promise.race([
        request("tools/call", {
          name: tool,
          arguments: input
        }),
        exitPromise
      ]);

      finished = true;
      return normalizeStdioToolPayload<T>(result);
    } finally {
      finished = true;
      if (!exited) {
        child.kill();
      }
    }
  }
}
