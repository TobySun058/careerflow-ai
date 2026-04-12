import type { IndexedChunk, SourceDocument, SourceKind } from "@/lib/schemas";
import { cosineSimilarity, scoreLexicalMatch, truncate } from "@/lib/utils";

import { embedQuery } from "./embed";

export type RetrievedEvidence = {
  chunkId: string;
  sourceId: string;
  kind: SourceKind;
  title: string;
  excerpt: string;
  text: string;
  score: number;
};

type RetrievalInput = {
  query: string;
  kind: SourceKind;
  chunks: IndexedChunk[];
  sources: SourceDocument[];
  topK?: number;
};

export async function retrieveEvidence({
  query,
  kind,
  chunks,
  sources,
  topK = 6
}: RetrievalInput) {
  const relevantChunks = chunks.filter((chunk) => chunk.kind === kind);
  const queryEmbedding = await embedQuery(query);

  const scored = relevantChunks
    .map((chunk) => {
      const lexical = scoreLexicalMatch(query, chunk.text);
      const semantic =
        queryEmbedding && chunk.embedding
          ? cosineSimilarity(queryEmbedding, chunk.embedding)
          : 0;
      const score = semantic ? semantic * 0.72 + lexical * 0.28 : lexical;
      const source = sources.find((item) => item.id === chunk.sourceId);
      return {
        chunkId: chunk.id,
        sourceId: chunk.sourceId,
        kind: chunk.kind,
        title: source?.title ?? chunk.metadata.sourceTitle ?? "Source",
        excerpt: truncate(chunk.text, 180),
        text: chunk.text,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.filter((item) => item.score > 0 || scored.length <= topK);
}

export async function retrieveTruthEvidence(
  query: string,
  chunks: IndexedChunk[],
  sources: SourceDocument[],
  topK?: number
) {
  return retrieveEvidence({ query, kind: "truth", chunks, sources, topK });
}

export async function retrieveOpportunityEvidence(
  query: string,
  chunks: IndexedChunk[],
  sources: SourceDocument[],
  topK?: number
) {
  return retrieveEvidence({ query, kind: "opportunity", chunks, sources, topK });
}
