import { z } from "zod";

export const mcpTransportSchema = z.enum(["http-json", "tool-path", "stdio"]);
export type McpTransport = z.infer<typeof mcpTransportSchema>;

export const mcpStatusSchema = z.object({
  configured: z.boolean(),
  provider: z.string(),
  reason: z.string().optional()
});
export type McpStatus = z.infer<typeof mcpStatusSchema>;

export type McpToolResult<T> = {
  data: T;
  provider: string;
};
