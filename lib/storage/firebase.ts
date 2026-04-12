import type { IndexedChunk, SessionRecord, SourceDocument } from "@/lib/schemas";

import type { StorageAdapter } from "./interface";

function notConfigured(): never {
  throw new Error(
    "Firebase storage mode is not configured in this hackathon starter. Switch STORAGE_MODE=local or add Firebase credentials before enabling it."
  );
}

export class FirebaseStorageAdapter implements StorageAdapter {
  async saveSession(_session: SessionRecord): Promise<void> {
    return notConfigured();
  }

  async getSession(_id: string): Promise<SessionRecord | null> {
    return notConfigured();
  }

  async listSessions(): Promise<SessionRecord[]> {
    return notConfigured();
  }

  async saveSourceDocuments(
    _sessionId: string,
    _docs: SourceDocument[]
  ): Promise<void> {
    return notConfigured();
  }

  async getSourceDocuments(_sessionId: string): Promise<SourceDocument[]> {
    return notConfigured();
  }

  async saveChunkIndex(
    _sessionId: string,
    _chunks: IndexedChunk[]
  ): Promise<void> {
    return notConfigured();
  }

  async getChunkIndex(_sessionId: string): Promise<IndexedChunk[]> {
    return notConfigured();
  }
}
