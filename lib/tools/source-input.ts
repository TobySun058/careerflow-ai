import type { SourceDocument, SourceKind, SourceType } from "@/lib/schemas";

import { fetchAndCleanJobUrl } from "./fetch-job-url";
import { extractTextFromUpload } from "./parse-resume";
import { buildSourceDocument, inferSourceKind } from "./session-state";

function coerceSourceType(value: string | null, fallback: SourceType): SourceType {
  const candidate = (value ?? "").trim() as SourceType;
  if (
    [
      "resume",
      "job_description",
      "pasted_text",
      "url",
      "notes",
      "uploaded_document",
      "supporting_doc",
      "saved_bullet",
      "interview_story",
      "user_note",
      "job_url",
      "company_page",
      "job_search"
    ].includes(candidate)
  ) {
    return candidate;
  }

  return fallback;
}

export function deriveUrlSourceTitle(url: string, sourceType: SourceType, title?: string) {
  if (title?.trim()) {
    return title.trim();
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    const pathSegment = parsedUrl.pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      ?.replace(/[-_]+/g, " ");

    if (sourceType === "job_description") {
      return pathSegment ? `Job posting from ${hostname}: ${pathSegment}` : `Job posting from ${hostname}`;
    }

    return pathSegment ? `${hostname}: ${pathSegment}` : `Source from ${hostname}`;
  } catch {
    return title?.trim() || "URL source";
  }
}

export async function parseSourceFromFormData(
  formData: FormData,
  options?: {
    fallbackType?: SourceType;
    fallbackKind?: SourceKind;
    forceActive?: boolean;
    resolveUrl?: (
      url: string,
      sourceType: SourceType,
      title?: string
    ) => Promise<{
      title?: string;
      content: string;
      preview?: string;
      metadata?: SourceDocument["metadata"];
      notes?: string[];
    } | null>;
  }
): Promise<{ source: SourceDocument | null; notes: string[] }> {
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const rawCorpusType = String(formData.get("corpusType") ?? "").trim();
  const corpusType = (rawCorpusType === "truth" || rawCorpusType === "opportunity"
    ? rawCorpusType
    : undefined) as SourceKind | undefined;
  const entry = formData.get("file");
  const sourceType = coerceSourceType(
    String(formData.get("sourceType") ?? ""),
    options?.fallbackType ?? "uploaded_document"
  );
  const notes: string[] = [];

  if (entry instanceof File) {
    const parsed = await extractTextFromUpload(entry);
    if (!parsed.text.trim()) {
      return { source: null, notes };
    }

    const inferredType = sourceType === "uploaded_document" ? sourceType : sourceType;
    return {
      source: buildSourceDocument({
        title: title || parsed.filename || "Uploaded source",
        type: inferredType,
        kind: inferSourceKind(inferredType, options?.fallbackKind ?? corpusType),
        content: parsed.text,
        metadata: {
          filename: parsed.filename,
          mimeType: parsed.mimeType
        },
        active: options?.forceActive ?? sourceType === "resume"
      }),
      notes
    };
  }

  if (url) {
    if (options?.resolveUrl) {
      const resolved = await options.resolveUrl(url, sourceType, title);
      if (resolved?.content.trim()) {
        notes.push(...(resolved.notes ?? []));
        return {
          source: buildSourceDocument({
            title: resolved.title ?? deriveUrlSourceTitle(url, sourceType, title),
            type: sourceType === "url" ? "url" : sourceType,
            kind: inferSourceKind(sourceType, options?.fallbackKind ?? corpusType),
            content: resolved.content,
            preview: resolved.preview,
            metadata: {
              url,
              ...resolved.metadata
            },
            active: options?.forceActive ?? false
          }),
          notes
        };
      }
    }

    const fetched = await fetchAndCleanJobUrl(url);
    if (!fetched.content.trim()) {
      if ("error" in fetched) {
        notes.push(`URL fetch fallback: ${fetched.error}`);
      }
      return { source: null, notes };
    }

    return {
      source: buildSourceDocument({
        title: deriveUrlSourceTitle(url, sourceType, title),
        type: sourceType === "url" ? "url" : sourceType,
        kind: inferSourceKind(sourceType, options?.fallbackKind ?? corpusType),
        content: fetched.content,
        preview: fetched.preview,
        metadata: {
          url
        },
        active: options?.forceActive ?? false
      }),
      notes
    };
  }

  if (text) {
    return {
      source: buildSourceDocument({
        title:
          title ||
          (sourceType === "notes"
            ? "Notes"
            : sourceType === "resume"
              ? "Pasted resume"
              : "Pasted source"),
        type: sourceType,
        kind: inferSourceKind(sourceType, options?.fallbackKind ?? corpusType),
        content: text,
        active: options?.forceActive ?? sourceType === "resume"
      }),
      notes
    };
  }

  return { source: null, notes };
}
