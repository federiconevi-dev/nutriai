"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface UploadedAsset {
  id: string;
  url: string;
  filename: string;
}

export function ImageUploader({
  assets,
  onChange,
}: {
  assets: UploadedAsset[];
  onChange: (assets: UploadedAsset[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: UploadedAsset[] = [];
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          toast.error(`${file.name} is not a supported image type.`);
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 8MB.`);
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "PRODUCT_IMAGE");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? `Failed to upload ${file.name}`);
          continue;
        }
        uploaded.push({ id: data.asset.id, url: data.asset.url, filename: data.asset.filename });
      }
      if (uploaded.length) onChange([...assets, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragActive ? "border-brand-500 bg-brand-500/5" : "border-border hover:border-brand-500/40 hover:bg-white/[0.02]"
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">Upload your product</p>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WEBP, up to 8MB. Drop files or click to browse.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </div>

      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              <Image src={asset.url} alt={asset.filename} fill className="object-cover" unoptimized />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(assets.filter((a) => a.id !== asset.id));
                }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
