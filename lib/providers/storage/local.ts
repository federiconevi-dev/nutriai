import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { StorageProvider, UploadResult } from "./types";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Local-disk storage used in development/demo. Files are written to
 * /public/uploads and served directly by Next.js. Not suitable for
 * production on serverless/ephemeral filesystems - configure STORAGE_URL /
 * STORAGE_KEY to switch to RealStorageProvider (S3/Supabase Storage).
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = "local";

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(filename) || guessExt(mimeType);
    const key = `${crypto.randomUUID()}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, key), buffer);
    return { url: `/uploads/${key}`, key };
  }
}

function guessExt(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}
