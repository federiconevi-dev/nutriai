"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASPECT_RATIOS } from "@/lib/video-options";

type Stage = "idle" | "rendering" | "processing" | "exporting" | "done";

export function ExportDialog({
  videoId,
  defaultAspectRatio,
  open,
  onOpenChange,
}: {
  videoId: string;
  defaultAspectRatio: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [quality, setQuality] = useState<"720p" | "1080p">("1080p");
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [stage, setStage] = useState<Stage>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function handleExport() {
    setStage("rendering");
    try {
      await tick(setStage, "processing", 500);
      await tick(setStage, "exporting", 500);
      const res = await fetch(`/api/videos/${videoId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality, format: "mp4", aspectRatio }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Export failed. Please try again.");
        setStage("idle");
        return;
      }
      setDownloadUrl(data.downloadUrl);
      setStage("done");
    } catch {
      toast.error("Export failed. Please try again.");
      setStage("idle");
    }
  }

  function reset() {
    setStage("idle");
    setDownloadUrl(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>Choose your export settings for the final MP4.</DialogDescription>
        </DialogHeader>

        {stage === "idle" && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Quality</p>
              <div className="flex gap-2">
                {(["720p", "1080p"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                      quality === q ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Aspect ratio</p>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setAspectRatio(r.value)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                      aspectRatio === r.value ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Format: MP4</p>
          </div>
        )}

        {(stage === "rendering" || stage === "processing" || stage === "exporting") && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
            <p className="text-sm font-medium">
              {stage === "rendering" && "Rendering…"}
              {stage === "processing" && "Processing…"}
              {stage === "exporting" && "Exporting…"}
            </p>
          </div>
        )}

        {stage === "done" && downloadUrl && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <Film className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">Your video is ready</p>
            <Button variant="gradient" asChild>
              <a href={downloadUrl} target="_blank" rel="noreferrer" download>
                <Download className="h-4 w-4" /> Download video
              </a>
            </Button>
          </div>
        )}

        {stage === "idle" && (
          <DialogFooter>
            <Button variant="gradient" onClick={handleExport}>
              Export video
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function tick(setStage: (s: Stage) => void, stage: Stage, ms: number) {
  setStage(stage);
  await new Promise((r) => setTimeout(r, ms));
}
