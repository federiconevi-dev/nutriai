"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BrandKitData {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  companyName: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
}

const FONTS = ["Inter", "Poppins", "Montserrat", "Playfair Display", "Space Grotesk"];

export function BrandKitForm({ initial }: { initial: BrandKitData | null }) {
  const [form, setForm] = useState<BrandKitData>(
    initial ?? {
      name: "My Brand",
      logoUrl: null,
      primaryColor: "#7C4DFF",
      secondaryColor: "#101014",
      fontFamily: "Inter",
      companyName: "",
      website: "",
      instagram: "",
      tiktok: "",
      youtube: "",
    }
  );
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  function update<K extends keyof BrandKitData>(key: K, value: BrandKitData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "LOGO");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not upload logo.");
        return;
      }
      update("logoUrl", data.asset.url);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save brand kit.");
        return;
      }
      toast.success("Brand kit saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <Label>Logo</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-secondary">
            {form.logoUrl ? (
              <Image src={form.logoUrl} alt="Logo" width={64} height={64} className="h-full w-full object-cover" unoptimized />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex h-9 items-center rounded-lg border border-input px-3 text-sm hover:bg-accent">
              {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload logo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Brand kit name</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Company name</Label>
          <Input value={form.companyName ?? ""} onChange={(e) => update("companyName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="h-9 w-9 cursor-pointer rounded-lg border border-input bg-transparent"
            />
            <Input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Secondary color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.secondaryColor}
              onChange={(e) => update("secondaryColor", e.target.value)}
              className="h-9 w-9 cursor-pointer rounded-lg border border-input bg-transparent"
            />
            <Input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Font</Label>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <button
                key={f}
                onClick={() => update("fontFamily", f)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  form.fontFamily === f ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Website</Label>
          <Input value={form.website ?? ""} onChange={(e) => update("website", e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-1.5">
          <Label>Instagram</Label>
          <Input value={form.instagram ?? ""} onChange={(e) => update("instagram", e.target.value)} placeholder="@handle" />
        </div>
        <div className="space-y-1.5">
          <Label>TikTok</Label>
          <Input value={form.tiktok ?? ""} onChange={(e) => update("tiktok", e.target.value)} placeholder="@handle" />
        </div>
        <div className="space-y-1.5">
          <Label>YouTube</Label>
          <Input value={form.youtube ?? ""} onChange={(e) => update("youtube", e.target.value)} placeholder="@channel" />
        </div>
      </div>

      <Button variant="gradient" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save brand kit
      </Button>
    </Card>
  );
}
