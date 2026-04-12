const env = {
  geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY ?? "",
  geminiModel: process.env.GOOGLE_GEMINI_MODEL ?? "gemini-2.0-flash",
  geminiEmbedModel:
    process.env.GOOGLE_GEMINI_EMBED_MODEL ?? "text-embedding-004",
  storageMode: process.env.STORAGE_MODE ?? "local",
  localDataDir: process.env.LOCAL_DATA_DIR ?? "./data/local",
  jobDiscoveryMode: process.env.JOB_DISCOVERY_MODE ?? "manual",
  resumeOptimizerMode:
    process.env.RESUME_OPTIMIZER_MODE ?? "internal",
  cvStylingMode: process.env.CV_STYLING_MODE ?? "none",
  enableEmbeddings: (process.env.ENABLE_EMBEDDINGS ?? "true") === "true",
  enableJobSearch:
    (process.env.NEXT_PUBLIC_ENABLE_JOB_SEARCH ?? "true") === "true"
} as const;

export function getEnv() {
  return env;
}

export function hasGeminiConfig() {
  return Boolean(env.geminiApiKey);
}
