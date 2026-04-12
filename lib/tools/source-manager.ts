import type { SessionRecord, SourceDocument } from "@/lib/schemas";
import { getStorage } from "@/lib/storage";

import { chunkDocument } from "./chunk";
import { embedChunks } from "./embed";
import {
  clearDerivedSessionState,
  ensureActiveResume,
  setSessionSources
} from "./session-state";

export async function rebuildSessionSourceState(
  session: SessionRecord,
  options?: { resetDerived?: boolean; note?: string }
) {
  const sources: SourceDocument[] = ensureActiveResume(getSessionSources(session)).map(
    (source) => ({
      ...source,
      chunkIds: [],
      metadata: {
        ...source.metadata,
        chunkCount: 0
      }
    })
  );

  const chunks = sources.flatMap((source) => {
    const sourceChunks = chunkDocument(source);
    source.chunkIds = sourceChunks.map((chunk) => chunk.id);
    source.metadata.chunkCount = sourceChunks.length;
    return sourceChunks;
  });

  const embeddedChunks = await embedChunks(chunks);
  setSessionSources(session, sources);

  if (options?.resetDerived) {
    clearDerivedSessionState(session, options.note);
  } else {
    session.updatedAt = new Date().toISOString();
  }

  const storage = getStorage();
  await storage.saveSourceDocuments(session.id, sources);
  await storage.saveChunkIndex(session.id, embeddedChunks);
  await storage.saveSession(session);

  return {
    session,
    sources,
    chunks: embeddedChunks
  };
}

export function getSessionSources(session: SessionRecord): SourceDocument[] {
  return session.sources.length ? session.sources : session.sourceManifest;
}
