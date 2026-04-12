import type { SessionRecord } from "@/lib/schemas";
import { getStorage } from "@/lib/storage";

export async function saveSession(session: SessionRecord) {
  const storage = getStorage();
  await storage.saveSession(session);
}

export async function loadSession(sessionId: string) {
  const storage = getStorage();
  return storage.getSession(sessionId);
}
