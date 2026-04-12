import { getEnv, hasModelConfig } from "@/lib/config";
import type { IndexedChunk } from "@/lib/schemas";

async function embedText(text: string) {
  const env = getEnv();
  const response = await fetch(
    `${env.featherlessBaseUrl}/embeddings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.featherlessApiKey}`,
        "HTTP-Referer": env.appUrl,
        "X-Title": "CareerFlow AI"
      },
      body: JSON.stringify({
        model: env.featherlessEmbedModel,
        input: text
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  return payload.data?.[0]?.embedding ?? [];
}

export async function embedChunks(chunks: IndexedChunk[]) {
  const env = getEnv();
  if (!env.enableEmbeddings || !hasModelConfig() || !env.featherlessEmbedModel) {
    return chunks;
  }

  const enriched: IndexedChunk[] = [];
  for (const chunk of chunks) {
    try {
      const embedding = await embedText(chunk.text);
      enriched.push({ ...chunk, embedding });
    } catch (error) {
      console.warn("Embedding fallback:", error);
      enriched.push(chunk);
    }
  }

  return enriched;
}

export async function embedQuery(query: string) {
  const env = getEnv();
  if (!env.enableEmbeddings || !hasModelConfig() || !env.featherlessEmbedModel) {
    return null;
  }

  try {
    return await embedText(query);
  } catch {
    return null;
  }
}
