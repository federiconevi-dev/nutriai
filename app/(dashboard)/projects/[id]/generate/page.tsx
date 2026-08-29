"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  ANALYZING_PROMPT: "Analyzing prompt…",
  CREATING_SCRIPT: "Creating script…",
  CREATING_STORYBOARD: "Creating storyboard…",
  GENERATING_SCENES: "Generating scenes…",
  CREATING_VOICE: "Creating voice…",
  ADDING_SUBTITLES: "Adding subtitles…",
  RENDERING_VIDEO: "Rendering video…",
  FINALIZING: "Finalizing…",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const STAGE_ORDER = [
  "ANALYZING_PROMPT",
  "CREATING_SCRIPT",
  "CREATING_STORYBOARD",
  "GENERATING_SCENES",
  "CREATING_VOICE",
  "ADDING_SUBTITLES",
  "RENDERING_VIDEO",
  "FINALIZING",
];

export default function GeneratePage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <GenerateFlow projectId={params.id} />
    </Suspense>
  );
}

function GenerateFlow({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [generationId, setGenerationId] = useState<string | null>(searchParams.get("generationId"));
  const [generation, setGeneration] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveGenerationId() {
      if (generationId) return;
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      const latest = data.project?.generations?.[0];
      if (!cancelled && latest) setGenerationId(latest.id);
    }
    resolveGenerationId();
    return () => {
      cancelled = true;
    };
  }, [projectId, generationId]);

  useEffect(() => {
    if (!generationId) return;
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/generations/${generationId}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Could not load generation status.");
        return;
      }
      setGeneration(data.generation);

      if (data.generation.stage === "COMPLETED" && data.video && !redirected.current) {
        redirected.current = true;
        toast.success("Your video is ready!");
        router.push(`/editor/${data.video.id}`);
        return;
      }
      if (!["COMPLETED", "FAILED", "CANCELLED"].includes(data.generation.stage)) {
        setTimeout(poll, 800);
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [generationId, router]);

  async function handleCancel() {
    if (!generationId) return;
    const res = await fetch(`/api/generations/${generationId}/cancel`, { method: "POST" });
    if (res.ok) {
      toast.info("Generation cancelled. Credits refunded.");
      router.push(`/projects/${projectId}/storyboard`);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-4 font-medium">{error}</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push(`/projects/${projectId}/storyboard`)}>
          Back to storyboard
        </Button>
      </div>
    );
  }

  if (generation?.stage === "FAILED") {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Generation failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {generation.errorMessage || "Something went wrong while generating your video. Please try again."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Your credits have been refunded.</p>
        <Button className="mt-6" variant="gradient" onClick={() => router.push(`/projects/${projectId}/storyboard`)}>
          Back to storyboard
        </Button>
      </div>
    );
  }

  const currentIndex = generation ? STAGE_ORDER.indexOf(generation.stage) : -1;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15">
        <Sparkles className="h-7 w-7 animate-pulse text-brand-400" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generating your video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Feel free to leave this page — we'll keep working and you can check progress any time from "My Videos".
        </p>
      </div>

      <Card className="space-y-5 p-6 text-left">
        <Progress value={generation?.progress ?? 3} />
        <ul className="space-y-2.5">
          {STAGE_ORDER.map((stage, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li key={stage} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    done && "bg-emerald-500/20 text-emerald-400",
                    active && "bg-brand-500/20 text-brand-300",
                    !done && !active && "bg-secondary text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                </span>
                <span className={cn(done && "text-muted-foreground line-through", active && "font-medium")}>
                  {STAGE_LABELS[stage]}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {generation && !["COMPLETED", "FAILED", "CANCELLED"].includes(generation.stage) && (
        <Button variant="outline" onClick={handleCancel}>
          <X className="h-4 w-4" /> Cancel generation
        </Button>
      )}
    </div>
  );
}
