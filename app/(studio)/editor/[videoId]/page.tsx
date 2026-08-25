"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clapperboard,
  Type,
  Captions,
  Mic,
  Music2,
  ImageIcon,
  Wand2,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportDialog } from "@/components/editor/export-dialog";
import { cn, aspectRatioToClass, formatDuration } from "@/lib/utils";
import { pickDemoThumbnail, MUSIC_LIBRARY } from "@/lib/demo/media";
import { CAPTION_STYLES, VOICE_GENDERS, VOICE_TONES } from "@/lib/video-options";

type Tool = "scenes" | "text" | "captions" | "voice" | "music" | "images" | "effects";

const TOOLS: { id: Tool; label: string; icon: typeof Clapperboard }[] = [
  { id: "scenes", label: "Scenes", icon: Clapperboard },
  { id: "text", label: "Text", icon: Type },
  { id: "captions", label: "Captions", icon: Captions },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "music", label: "Music", icon: Music2 },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "effects", label: "Effects", icon: Wand2 },
];

export default function EditorPage({ params }: { params: { videoId: string } }) {
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [tool, setTool] = useState<Tool>("scenes");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [effects, setEffects] = useState({ grayscale: false, vignette: false, zoom: false });

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/videos/${params.videoId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not load this video.");
        return;
      }
      setVideo(data.video);
      setScenes(data.video.project.scenes);
      setSelectedSceneId(data.video.project.scenes[0]?.id ?? null);
      setLoading(false);
    })();
  }, [params.videoId]);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) ?? scenes[0];

  async function patchVideo(data: Record<string, unknown>) {
    setVideo((v: any) => ({ ...v, ...data }));
    setSaving(true);
    try {
      await fetch(`/api/videos/${params.videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } finally {
      setSaving(false);
    }
  }

  async function patchScene(sceneId: string, data: Record<string, unknown>) {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...data } : s)));
    setSaving(true);
    try {
      await fetch(`/api/projects/${video.projectId}/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !video) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewFilter = cn(
    effects.grayscale && "grayscale",
    effects.zoom && "scale-105"
  );

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 px-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/videos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <input
            value={video.title}
            onChange={(e) => patchVideo({ title: e.target.value })}
            className="w-full max-w-sm truncate bg-transparent text-sm font-medium outline-none"
          />
        </div>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
        <Badge variant={video.status === "COMPLETED" ? "success" : "secondary"}>{video.status}</Badge>
        <Button variant="gradient" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4" /> Export video
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left tools */}
        <div className="flex w-20 shrink-0 flex-col items-center gap-1 border-r border-white/5 py-4">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={cn(
                "flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] transition-colors",
                tool === t.id ? "bg-brand-500/15 text-brand-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Center preview */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-black/30 p-6">
          <div className={cn("relative max-h-full overflow-hidden rounded-2xl bg-black shadow-2xl", aspectRatioToClass(video.aspectRatio), "h-full")}>
            <video
              key={selectedScene?.videoUrl || video.videoUrl}
              src={selectedScene?.videoUrl || video.videoUrl}
              controls
              className={cn("h-full w-full object-cover transition-all duration-300", previewFilter)}
            />
            {effects.vignette && (
              <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_60px_rgba(0,0,0,0.7)]" />
            )}
            {tool === "captions" && (
              <div className="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center px-6">
                <span
                  className={cn(
                    "rounded-md px-3 py-1 text-center text-sm font-semibold text-white",
                    video.captionsStyle === "bold" && "bg-black/70 text-lg uppercase",
                    video.captionsStyle === "minimal" && "text-white/90",
                    video.captionsStyle === "tiktok" && "bg-black/60 text-brand-300",
                    video.captionsStyle === "highlight" && "bg-brand-500 text-white",
                    video.captionsStyle === "classic" && "bg-black/50"
                  )}
                >
                  {selectedScene?.voiceText ?? "Your captions preview"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right properties */}
        <div className="w-80 shrink-0 overflow-y-auto border-l border-white/5 p-5">
          <PropertiesPanel
            tool={tool}
            video={video}
            scene={selectedScene}
            scenes={scenes}
            onPatchVideo={patchVideo}
            onPatchScene={patchScene}
            effects={effects}
            setEffects={setEffects}
          />
        </div>
      </div>

      {/* Bottom timeline */}
      <div className="flex h-32 shrink-0 items-center gap-3 overflow-x-auto border-t border-white/5 px-4 no-scrollbar">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => setSelectedSceneId(scene.id)}
            className={cn(
              "relative flex h-24 w-16 shrink-0 flex-col overflow-hidden rounded-lg ring-2 transition-all",
              selectedSceneId === scene.id ? "ring-brand-500" : "ring-transparent hover:ring-white/20"
            )}
          >
            <div className="relative flex-1">
              <Image src={scene.imageUrl || pickDemoThumbnail(scene.id)} alt="" fill className="object-cover" unoptimized />
            </div>
            <span className="bg-black/70 py-0.5 text-[10px] text-white">
              {formatDuration(scene.endSec - scene.startSec)}
            </span>
          </button>
        ))}
      </div>

      <ExportDialog
        videoId={video.id}
        defaultAspectRatio={video.aspectRatio}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </div>
  );
}

function PropertiesPanel({
  tool,
  video,
  scene,
  scenes,
  onPatchVideo,
  onPatchScene,
  effects,
  setEffects,
}: {
  tool: Tool;
  video: any;
  scene: any;
  scenes: any[];
  onPatchVideo: (data: Record<string, unknown>) => void;
  onPatchScene: (sceneId: string, data: Record<string, unknown>) => void;
  effects: { grayscale: boolean; vignette: boolean; zoom: boolean };
  setEffects: (fn: any) => void;
}) {
  if (tool === "scenes" || tool === "text") {
    if (!scene) return <EmptyPanel />;
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Scene {scene.order}</p>
        <div className="space-y-1.5">
          <Label className="text-xs">On-screen / visual</Label>
          <Textarea
            value={scene.visualText}
            onChange={(e) => onPatchScene(scene.id, { visualText: e.target.value })}
            rows={4}
          />
        </div>
        {tool === "scenes" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Voice line</Label>
            <Textarea
              value={scene.voiceText}
              onChange={(e) => onPatchScene(scene.id, { voiceText: e.target.value })}
              rows={3}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Duration: {formatDuration(scene.endSec - scene.startSec)} ({scene.startSec}s–{scene.endSec}s)
        </p>
      </div>
    );
  }

  if (tool === "captions") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Caption style</p>
        <div className="grid grid-cols-2 gap-2">
          {CAPTION_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => onPatchVideo({ captionsStyle: s })}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                video.captionsStyle === s ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Preview updates live on the canvas.</p>
      </div>
    );
  }

  if (tool === "voice") {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs">Gender</Label>
          <div className="flex gap-2">
            {VOICE_GENDERS.map((g) => (
              <button
                key={g}
                onClick={() => onPatchVideo({ voiceGender: g })}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize",
                  video.voiceGender === g ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Tone</Label>
          <div className="grid grid-cols-2 gap-2">
            {VOICE_TONES.map((t) => (
              <button
                key={t}
                onClick={() => onPatchVideo({ voiceStyle: t })}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs capitalize",
                  video.voiceStyle === t ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Speed: {video.voiceSpeed}x</Label>
          <Slider
            min={0.8}
            max={1.2}
            step={0.2}
            value={[video.voiceSpeed]}
            onValueChange={([v]) => onPatchVideo({ voiceSpeed: v })}
          />
        </div>
      </div>
    );
  }

  if (tool === "music") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Music</p>
        <button
          onClick={() => onPatchVideo({ musicId: null })}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-left text-sm",
            !video.musicId ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
          )}
        >
          No music
        </button>
        <div className="space-y-1.5">
          {MUSIC_LIBRARY.map((m) => (
            <button
              key={m.id}
              onClick={() => onPatchVideo({ musicId: m.id })}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                video.musicId === m.id ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
              )}
            >
              <span>{m.name}</span>
              <span className="text-xs opacity-70">{m.category}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (tool === "images") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">Scene images</p>
        <div className="grid grid-cols-2 gap-2">
          {scenes.map((s) => (
            <div key={s.id} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-secondary">
              <Image src={s.imageUrl || pickDemoThumbnail(s.id)} alt="" fill className="object-cover" unoptimized />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Manage source photos from the <Link href="/assets" className="text-brand-400 hover:underline">Assets</Link> page.
        </p>
      </div>
    );
  }

  // effects
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Effects</p>
      {(
        [
          ["grayscale", "Black & white"],
          ["vignette", "Vignette"],
          ["zoom", "Subtle zoom"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setEffects((prev: any) => ({ ...prev, [key]: !prev[key] }))}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm",
            effects[key] ? "border-brand-500 bg-brand-500/15 text-brand-300" : "border-border text-muted-foreground"
          )}
        >
          {label}
          <span className={cn("h-2 w-2 rounded-full", effects[key] ? "bg-brand-400" : "bg-white/20")} />
        </button>
      ))}
      <p className="text-xs text-muted-foreground">Effects preview live on the canvas.</p>
    </div>
  );
}

function EmptyPanel() {
  return <p className="text-sm text-muted-foreground">Select a scene from the timeline.</p>;
}
