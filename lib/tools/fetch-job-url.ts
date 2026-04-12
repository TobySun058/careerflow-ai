import { stripHtml, truncate } from "@/lib/utils";

export async function fetchAndCleanJobUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CareerFlow AI/0.1"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const html = await response.text();
    const cleaned = stripHtml(html);

    return {
      url,
      content: cleaned,
      preview: truncate(cleaned, 320)
    };
  } catch (error) {
    return {
      url,
      content: "",
      preview: "",
      error:
        error instanceof Error
          ? error.message
          : "Unable to fetch or clean the job URL."
    };
  }
}
