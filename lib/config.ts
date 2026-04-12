const env = {
  mcpTransport: process.env.MCP_TRANSPORT ?? "http-json",
  featherlessApiKey: process.env.FEATHERLESS_API_KEY ?? "",
  featherlessBaseUrl:
    process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1",
  featherlessModel:
    process.env.FEATHERLESS_MODEL ?? "Qwen/Qwen2.5-7B-Instruct",
  featherlessEmbedModel: process.env.FEATHERLESS_EMBED_MODEL ?? "",
  enableResumakeMcp: (process.env.ENABLE_RESUMAKE_MCP ?? "false") === "true",
  resumakeMcpCommand: process.env.RESUMAKE_MCP_COMMAND ?? "",
  resumakeMcpArgs: process.env.RESUMAKE_MCP_ARGS ?? "[]",
  resumakeMcpCwd: process.env.RESUMAKE_MCP_CWD ?? "",
  resumakeTemplateNumber: Number(process.env.RESUMAKE_TEMPLATE_NUMBER ?? "1"),
  enableJobSpyMcp: (process.env.ENABLE_JOBSPY_MCP ?? "false") === "true",
  jobSpyMcpCommand: process.env.JOBSPY_MCP_COMMAND ?? "",
  jobSpyMcpArgs: process.env.JOBSPY_MCP_ARGS ?? "[]",
  jobSpyMcpCwd: process.env.JOBSPY_MCP_CWD ?? "",
  jobSpySiteNames: process.env.JOBSPY_SITE_NAMES ?? "indeed,linkedin,glassdoor",
  jobSpyCountryIndeed: process.env.JOBSPY_COUNTRY_INDEED ?? "USA",
  jobSpyFetchLinkedinDescription:
    (process.env.JOBSPY_FETCH_LINKEDIN_DESCRIPTION ?? "false") === "true",
  enableDecodoMcp: (process.env.ENABLE_DECODO_MCP ?? "false") === "true",
  decodoApiKey: process.env.DECODO_API_KEY ?? "",
  decodoMcpUrl: process.env.DECODO_MCP_URL ?? "",
  enableCrewAiBridge: (process.env.ENABLE_CREWAI_BRIDGE ?? "false") === "true",
  crewaiBridgeUrl: process.env.CREWAI_BRIDGE_URL ?? "",
  crewaiBridgeTimeoutMs: Number(process.env.CREWAI_BRIDGE_TIMEOUT_MS ?? "12000"),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  storageMode: process.env.STORAGE_MODE ?? "local",
  localDataDir: process.env.LOCAL_DATA_DIR ?? "./data/local",
  enableEmbeddings: (process.env.ENABLE_EMBEDDINGS ?? "true") === "true",
  enableJobSearch:
    (process.env.NEXT_PUBLIC_ENABLE_JOB_SEARCH ?? "true") === "true"
} as const;

export function getEnv() {
  return env;
}

export function hasModelConfig() {
  return Boolean(env.featherlessApiKey);
}
