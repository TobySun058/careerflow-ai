import type {
  ClaimMapEntry,
  DraftArtifact,
  EvidenceRef,
  IndexedChunk,
  SourceDocument
} from "@/lib/schemas";
import { makeId, splitIntoSentences } from "@/lib/utils";

import { retrieveEvidence } from "./retrieval";

function splitIntoClaimUnits(content: string) {
  const lineBased = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lineBased.length > 1) {
    return lineBased;
  }

  return splitIntoSentences(content);
}

export async function generateClaimMap(
  content: string,
  chunks: IndexedChunk[],
  sources: SourceDocument[]
) {
  const claims = splitIntoClaimUnits(content);
  const entries: ClaimMapEntry[] = [];

  for (const claim of claims) {
    const truthEvidence = await retrieveEvidence({
      query: claim,
      kind: "truth",
      chunks,
      sources,
      topK: 2
    });
    const opportunityEvidence = await retrieveEvidence({
      query: claim,
      kind: "opportunity",
      chunks,
      sources,
      topK: 2
    });

    const combined = [...truthEvidence, ...opportunityEvidence].sort(
      (a, b) => b.score - a.score
    );
    const best = combined[0];

    entries.push({
      id: makeId("claim"),
      text: claim,
      supportingChunkIds: combined.slice(0, 2).map((item) => item.chunkId),
      sourceType: best?.kind ?? "truth",
      confidence: best ? Number(best.score.toFixed(2)) : 0,
      status:
        !best || best.score < 0.14
          ? claim.match(/\b(consider|could|might|try|suggest)\b/i)
            ? "suggested"
            : "unsupported"
          : "supported"
    });
  }

  return entries;
}

export function verifyClaims(
  content: string,
  claimMap: ClaimMapEntry[]
): Pick<DraftArtifact, "content" | "claimMap" | "sourceRefs"> {
  const rejected = new Set(
    claimMap.filter((claim) => claim.status === "unsupported").map((claim) => claim.text)
  );
  const preservedLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/[:#]$/.test(line) || /^\d+\./.test(line)) {
        return true;
      }

      return !rejected.has(line);
    });

  const refs = claimMap
    .filter((claim) => claim.status !== "unsupported")
    .flatMap((claim) =>
      claim.supportingChunkIds.map((chunkId) => ({
        chunkId,
        sourceId: "",
        kind: claim.sourceType,
        title: "Grounding source",
        excerpt: claim.text
      }))
    );

  return {
    content: preservedLines.length ? preservedLines.join("\n") : content,
    claimMap,
    sourceRefs: refs
  };
}

export function finalizeSourceRefs(
  claimMap: ClaimMapEntry[],
  chunks: IndexedChunk[],
  sources: SourceDocument[]
) {
  const refs: EvidenceRef[] = [];

  claimMap.forEach((claim) => {
    claim.supportingChunkIds.forEach((chunkId) => {
      const chunk = chunks.find((item) => item.id === chunkId);
      const source = sources.find((item) => item.id === chunk?.sourceId);
      if (!chunk || !source) {
        return;
      }

      refs.push({
        chunkId: chunk.id,
        sourceId: chunk.sourceId,
        kind: chunk.kind,
        title: source.title,
        excerpt: chunk.text.slice(0, 140)
      });
    });
  });

  return refs.filter(
    (ref, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.chunkId === ref.chunkId && candidate.sourceId === ref.sourceId
      ) === index
  );
}
