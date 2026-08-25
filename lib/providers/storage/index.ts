import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { RealStorageProvider } from "./real";

export * from "./types";

let instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;
  const configured = !!process.env.STORAGE_URL && !!process.env.STORAGE_KEY;
  instance = configured ? new RealStorageProvider() : new LocalStorageProvider();
  return instance;
}
