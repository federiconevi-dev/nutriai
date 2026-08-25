import crypto from "crypto";
import type { StorageProvider, UploadResult } from "./types";

/**
 * Real object-storage provider (S3-compatible / Supabase Storage). Configure:
 *   STORAGE_URL - bucket base URL (e.g. https://<project>.supabase.co/storage/v1/object/public/videos)
 *   STORAGE_KEY - service key / secret, server-side only
 */
export class RealStorageProvider implements StorageProvider {
  readonly id = "real";

  private get baseUrl() {
    return process.env.STORAGE_URL;
  }
  private get key() {
    return process.env.STORAGE_KEY;
  }

  async upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    if (!this.baseUrl || !this.key) {
      throw new Error("STORAGE_URL / STORAGE_KEY are not configured.");
    }
    const key = `${crypto.randomUUID()}-${filename}`;
    const res = await fetch(`${this.baseUrl}/${key}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": mimeType,
      },
      body: buffer,
    });
    if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    return { url: `${this.baseUrl}/${key}`, key };
  }
}
