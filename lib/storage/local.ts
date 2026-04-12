import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getEnv } from "@/lib/config";
import {
  indexedChunkSchema,
  sessionRecordSchema,
  sourceDocumentSchema,
  type IndexedChunk,
  type SessionRecord,
  type SourceDocument
} from "@/lib/schemas";

import type { StorageAdapter } from "./interface";

function resolveRoot() {
  const env = getEnv();
  return path.resolve(process.cwd(), env.localDataDir);
}

function sessionPath(id: string) {
  return path.join(resolveRoot(), "sessions", `${id}.json`);
}

function sourcesPath(id: string) {
  return path.join(resolveRoot(), "sources", `${id}.json`);
}

function indexPath(id: string) {
  return path.join(resolveRoot(), "indexes", `${id}.json`);
}

async function ensureDirs() {
  const root = resolveRoot();
  await Promise.all([
    mkdir(path.join(root, "sessions"), { recursive: true }),
    mkdir(path.join(root, "sources"), { recursive: true }),
    mkdir(path.join(root, "indexes"), { recursive: true })
  ]);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async saveSession(session: SessionRecord) {
    await ensureDirs();
    await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
  }

  async getSession(id: string) {
    await ensureDirs();
    const raw = await readJson<SessionRecord>(sessionPath(id));
    return raw ? sessionRecordSchema.parse(raw) : null;
  }

  async listSessions() {
    await ensureDirs();
    const files = await readdir(path.join(resolveRoot(), "sessions")).catch(() => []);
    const sessions = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const raw = await readJson<SessionRecord>(
            path.join(resolveRoot(), "sessions", file)
          );
          return raw ? sessionRecordSchema.parse(raw) : null;
        })
    );

    return sessions
      .filter((session): session is SessionRecord => Boolean(session))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveSourceDocuments(sessionId: string, docs: SourceDocument[]) {
    await ensureDirs();
    await writeFile(sourcesPath(sessionId), JSON.stringify(docs, null, 2), "utf8");
  }

  async getSourceDocuments(sessionId: string) {
    await ensureDirs();
    const raw = await readJson<SourceDocument[]>(sourcesPath(sessionId));
    return raw ? raw.map((doc) => sourceDocumentSchema.parse(doc)) : [];
  }

  async saveChunkIndex(sessionId: string, chunks: IndexedChunk[]) {
    await ensureDirs();
    await writeFile(indexPath(sessionId), JSON.stringify(chunks, null, 2), "utf8");
  }

  async getChunkIndex(sessionId: string) {
    await ensureDirs();
    const raw = await readJson<IndexedChunk[]>(indexPath(sessionId));
    return raw ? raw.map((chunk) => indexedChunkSchema.parse(chunk)) : [];
  }
}
