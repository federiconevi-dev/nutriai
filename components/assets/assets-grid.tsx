"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Trash2, ImageIcon } from "lucide-react";
import { ImageUploader, type UploadedAsset } from "@/components/create/image-uploader";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";

export function AssetsGrid({ initialAssets }: { initialAssets: UploadedAsset[] }) {
  const [assets, setAssets] = useState<UploadedAsset[]>(initialAssets);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete asset.");
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
    toast.success("Asset deleted");
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <ImageUploader assets={[]} onChange={(uploaded) => setAssets((prev) => [...uploaded, ...prev])} />
      </Card>

      {assets.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No assets yet" description="Upload product photos to reuse them across projects." />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              <Image src={asset.url} alt={asset.filename} fill className="object-cover" unoptimized />
              <button
                onClick={() => handleDelete(asset.id)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
