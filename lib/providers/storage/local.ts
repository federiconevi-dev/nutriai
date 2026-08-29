import crypto from "crypto";
import path from "path";
import type { StorageProvider, UploadResult } from "./types";

/**
 * Zero-config default storage: encodes the file as a data: URI and stores
 * it directly in the database (see Asset.url). This is the safe default
 * because writing to local disk (the more "obvious" fallback) does not
 * reliably persist on serverless hosts like Vercel - each invocation can
 * run in a fresh, ephemeral filesystem, so a file written during an upload
 * request may simply not exist by the time it's read back.
 *
 * This works everywhere with no setup, at the cost of larger database rows
 * and API payloads. For production traffic beyond a small/demo scale,
 * configure STORAGE_URL / STORAGE_KEY to switch to RealStorageProvider
 * (S3-compatible / Supabase Storage) instead.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = "local";

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const ext = path.extname(filename) || guessExt(mimeType);
    const key = `${crypto.randomUUID()}${ext}`;
    const url = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return { url, key };
  }
}

function guessExt(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}
