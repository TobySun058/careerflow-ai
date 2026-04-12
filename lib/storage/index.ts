import { getEnv } from "@/lib/config";

import type { StorageAdapter } from "./interface";
import { FirebaseStorageAdapter } from "./firebase";
import { LocalStorageAdapter } from "./local";

let storageSingleton: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!storageSingleton) {
    const env = getEnv();
    storageSingleton =
      env.storageMode === "firebase"
        ? new FirebaseStorageAdapter()
        : new LocalStorageAdapter();
  }

  return storageSingleton;
}
