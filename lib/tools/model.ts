import { getEnv, hasGeminiConfig } from "@/lib/config";

type JsonResult<T> = {
  data: T;
  usedModel: boolean;
};

function extractResponseText(payload: unknown) {
  const candidate = (payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  })?.candidates?.[0];

  const parts = candidate?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

async function invokeGemini(
  prompt: string,
  options?: { json?: boolean; temperature?: number }
) {
  const env = getEnv();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.3,
          responseMimeType: options?.json ? "application/json" : "text/plain"
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as unknown;
  return extractResponseText(json);
}

export async function generateJson<T>(
  prompt: string,
  fallback: () => T
): Promise<JsonResult<T>> {
  if (!hasGeminiConfig()) {
    return { data: fallback(), usedModel: false };
  }

  try {
    const raw = await invokeGemini(prompt, { json: true });
    const parsed = JSON.parse(raw) as T;
    return { data: parsed, usedModel: true };
  } catch (error) {
    console.warn("Gemini JSON fallback:", error);
    return { data: fallback(), usedModel: false };
  }
}

export async function generateText(
  prompt: string,
  fallback: () => string
): Promise<{ text: string; usedModel: boolean }> {
  if (!hasGeminiConfig()) {
    return { text: fallback(), usedModel: false };
  }

  try {
    const raw = await invokeGemini(prompt, { json: false });
    return { text: raw, usedModel: true };
  } catch (error) {
    console.warn("Gemini text fallback:", error);
    return { text: fallback(), usedModel: false };
  }
}
