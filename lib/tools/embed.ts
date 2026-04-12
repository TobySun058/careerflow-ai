import { getEnv, hasGeminiConfig } from "@/lib/config";
import type { IndexedChunk } from "@/lib/schemas";

async function embedText(text: string) {
  const env = getEnv();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiEmbedModel}:embedContent?key=${env.geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    embedding?: { values?: number[] };
  };

  return payload.embedding?.values ?? [];
}

export async function embedChunks(chunks: IndexedChunk[]) {
  const env = getEnv();
  if (!env.enableEmbeddings || !hasGeminiConfig()) {
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
  if (!env.enableEmbeddings || !hasGeminiConfig()) {
    return null;
  }

  try {
    return await embedText(query);
  } catch {
    return null;
  }
}
