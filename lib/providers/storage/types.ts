export interface UploadResult {
  url: string;
  key: string;
}

/** StorageProvider abstracts where uploaded files (product photos, logos, exports) live. */
export interface StorageProvider {
  readonly id: string;
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
}
