import { makeId, tokenize, truncate } from "@/lib/utils";
import type { IndexedChunk, SourceDocument } from "@/lib/schemas";

export function chunkDocument(doc: SourceDocument, maxChars = 520) {
  const paragraphs = doc.content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: IndexedChunk[] = [];
  let buffer = "";

  const flush = (chunkIndex: number) => {
    const text = buffer.trim();
    if (!text) {
      return;
    }

    chunks.push({
      id: makeId("chunk"),
      sourceId: doc.id,
      kind: doc.kind,
      text,
      tokenCount: tokenize(text).length,
      metadata: {
        chunkIndex: String(chunkIndex),
        sourceTitle: doc.title,
        preview: truncate(text, 120)
      }
    });
    buffer = "";
  };

  paragraphs.forEach((paragraph, index) => {
    if ((buffer + "\n\n" + paragraph).length > maxChars && buffer) {
      flush(index);
    }

    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  });

  flush(paragraphs.length);

  if (!chunks.length && doc.content.trim()) {
    chunks.push({
      id: makeId("chunk"),
      sourceId: doc.id,
      kind: doc.kind,
      text: doc.content.trim(),
      tokenCount: tokenize(doc.content).length,
      metadata: {
        chunkIndex: "0",
        sourceTitle: doc.title,
        preview: truncate(doc.content.trim(), 120)
      }
    });
  }

  return chunks;
}
