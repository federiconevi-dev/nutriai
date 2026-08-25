"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { StepIndicator } from "@/components/create/step-indicator";
import { ImageUploader, type UploadedAsset } from "@/components/create/image-uploader";
import { cn } from "@/lib/utils";
import {
  VIDEO_TYPES,
  DURATIONS,
  ASPECT_RATIOS,
  STYLES,
  LANGUAGES,
  typeParamToVideoType,
} from "@/lib/video-options";

const STEPS = ["Describe", "Upload product", "Review"];

export default function CreatePage() {
  return (
    <Suspense>
      <CreateFlow />
    </Suspense>
  );
}

const UPLOAD_MODES = [
  { value: "product_only", label: "Product only" },
  { value: "product_background", label: "Product + background" },
  { value: "product_lifestyle", label: "Product photos + lifestyle" },
];

function CreateFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [videoType, setVideoType] = useState<string>(typeParamToVideoType(searchParams.get("type")));
  const [duration, setDuration] = useState<number>(20);
  const [aspectRatio, setAspectRatio] = useState("RATIO_9_16");
  const [style, setStyle] = useState("CINEMATIC");
  const [language, setLanguage] = useState("es");
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [uploadMode, setUploadMode] = useState("product_only");
  const [submitting, setSubmitting] = useState(false);

  function goNext() {
    if (step === 1 && prompt.trim().length < 10) {
      toast.error("Describe your video with a bit more detail (at least 10 characters).");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          videoType,
          style,
          aspectRatio,
          duration,
          language,
          assetIds: assets.map((a) => a.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong creating your project.");
        return;
      }
      router.push(`/projects/${data.project.id}/script`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">New project</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Create video</h1>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {step === 1 && (
        <Card className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-base">Describe your video</Label>
            <Textarea
              id="prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='Create a premium advertisement for a hydroponic gardening kit.'
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">{prompt.length}/2000</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Video type</Label>
              <Select value={videoType} onValueChange={setVideoType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIDEO_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      duration === d ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setAspectRatio(r.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    aspectRatio === r.value ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs opacity-70">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-6 p-6">
          <div>
            <Label className="text-base">Upload your product</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional — add product photos so scenes can reference them. Skip this step to generate from text only.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {UPLOAD_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setUploadMode(m.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  uploadMode === m.value ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <ImageUploader assets={assets} onChange={setAssets} />
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-2 text-brand-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm font-medium">Ready to generate your script</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Info label="Video type" value={VIDEO_TYPES.find((t) => t.value === videoType)?.label} />
            <Info label="Style" value={STYLES.find((s) => s.value === style)?.label} />
            <Info label="Duration" value={`${duration}s`} />
            <Info label="Aspect ratio" value={ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label} />
            <Info label="Language" value={LANGUAGES.find((l) => l.value === language)?.label} />
            <Info label="Product photos" value={`${assets.length} uploaded`} />
          </dl>
          <div className="rounded-xl bg-secondary/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">Your idea</p>
            <p className="mt-1 text-sm">{prompt}</p>
          </div>
          <p className="text-xs text-muted-foreground">This will use 5 credits to generate your script.</p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < 3 ? (
          <Button variant="gradient" onClick={goNext}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate script <Sparkles className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
