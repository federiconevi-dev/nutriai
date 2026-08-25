"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, aspectRatioToClass, aspectRatioLabel } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  previewUrl: string;
  aspectRatio: string;
  duration: number;
  featured: boolean;
}

const CATEGORIES = [
  "All",
  "TikTok Ads",
  "Product Ads",
  "Instagram",
  "YouTube",
  "UGC",
  "E-commerce",
  "Real Estate",
  "Food",
  "Fitness",
  "Technology",
];

export function TemplatesGallery({ templates, isAuthenticated }: { templates: Template[]; isAuthenticated: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState("All");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (category === "All" ? templates : templates.filter((t) => t.category === category)),
    [templates, category]
  );

  async function useTemplate(template: Template) {
    if (!isAuthenticated) {
      router.push("/register");
      return;
    }
    setLoadingId(template.id);
    try {
      const res = await fetch(`/api/templates/${template.id}/use`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not use this template.");
        return;
      }
      router.push(`/projects/${data.project.id}/script`);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              category === c ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((t) => (
          <Card key={t.id} className="group overflow-hidden">
            <div className={cn("relative w-full overflow-hidden bg-secondary", aspectRatioToClass(t.aspectRatio))}>
              <Image src={t.previewUrl} alt={t.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" unoptimized />
              {t.featured && (
                <Badge variant="brand" className="absolute left-2 top-2">
                  <Sparkles className="h-3 w-3" /> Featured
                </Badge>
              )}
              <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
                {aspectRatioLabel(t.aspectRatio)} · {t.duration}s
              </span>
            </div>
            <div className="space-y-2 p-4">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => useTemplate(t)}
                disabled={loadingId === t.id}
              >
                {loadingId === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Use template
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
