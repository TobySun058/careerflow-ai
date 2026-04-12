import { getEnv, hasModelConfig } from "@/lib/config";

type JsonResult<T> = {
  data: T;
  usedModel: boolean;
  errorMessage?: string;
};

function extractResponseText(payload: unknown) {
  const candidate = (payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  })?.choices?.[0];

  const content = candidate?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  return (content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

async function invokeFeatherless(
  prompt: string,
  options?: { json?: boolean; temperature?: number }
) {
  const env = getEnv();
  const response = await fetch(
    `${env.featherlessBaseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.featherlessApiKey}`,
        "HTTP-Referer": env.appUrl,
        "X-Title": "CareerFlow AI"
      },
      body: JSON.stringify({
        model: env.featherlessModel,
        temperature: options?.temperature ?? 0.2,
        messages: [
          {
            role: "system",
            content: options?.json
              ? "Return only valid JSON with no markdown fences or extra commentary."
              : "You are a precise, grounded assistant for an evidence-first career workflow product."
          },
          {
            role: "user",
            content: prompt
          },
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Featherless request failed: ${response.status} ${errorText}`
    );
  }

  const json = (await response.json()) as unknown;
  return extractResponseText(json);
}

export async function generateJson<T>(
  prompt: string,
  fallback: () => T
): Promise<JsonResult<T>> {
  if (!hasModelConfig()) {
    return { data: fallback(), usedModel: false, errorMessage: "Missing FEATHERLESS_API_KEY." };
  }

  try {
    const raw = await invokeFeatherless(prompt, { json: true });
    const parsed = JSON.parse(raw) as T;
    return { data: parsed, usedModel: true };
  } catch (error) {
    console.warn("Featherless JSON fallback:", error);
    return {
      data: fallback(),
      usedModel: false,
      errorMessage: error instanceof Error ? error.message : "Unknown Featherless JSON error."
    };
  }
}

export async function generateText(
  prompt: string,
  fallback: () => string
): Promise<{ text: string; usedModel: boolean; errorMessage?: string }> {
  if (!hasModelConfig()) {
    return {
      text: fallback(),
      usedModel: false,
      errorMessage: "Missing FEATHERLESS_API_KEY."
    };
  }

  try {
    const raw = await invokeFeatherless(prompt, { json: false });
    return { text: raw, usedModel: true };
  } catch (error) {
    console.warn("Featherless text fallback:", error);
    return {
      text: fallback(),
      usedModel: false,
      errorMessage: error instanceof Error ? error.message : "Unknown Featherless text error."
    };
  }
}
