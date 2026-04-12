import type { IndexedChunk, SessionRecord, SourceDocument } from "@/lib/schemas";

export interface StorageAdapter {
  saveSession(session: SessionRecord): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  listSessions(): Promise<SessionRecord[]>;
  saveSourceDocuments(sessionId: string, docs: SourceDocument[]): Promise<void>;
  getSourceDocuments(sessionId: string): Promise<SourceDocument[]>;
  saveChunkIndex(sessionId: string, chunks: IndexedChunk[]): Promise<void>;
  getChunkIndex(sessionId: string): Promise<IndexedChunk[]>;
}
