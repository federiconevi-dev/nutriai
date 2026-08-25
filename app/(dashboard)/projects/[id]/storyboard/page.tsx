"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  RefreshCw,
  Pencil,
  Check,
  Loader2,
  Music2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration } from "@/lib/utils";
import { pickDemoThumbnail } from "@/lib/demo/media";
import { MUSIC_LIBRARY } from "@/lib/demo/media";

interface Scene {
  id: string;
  order: number;
  startSec: number;
  endSec: number;
  visualText: string;
  voiceText: string;
  prompt: string;
  imageUrl: string | null;
  videoUrl: string | null;
  musicId: string | null;
}

export default function StoryboardPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not load storyboard.");
        return;
      }
      setScenes(data.project.scenes);
      const isBlankSlate = data.project.scenes.every((s: Scene) => !s.visualText && !s.voiceText);
      if (isBlankSlate && data.project.scenes[0]) {
        setEditingId(data.project.scenes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id: string, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function saveScene(scene: Scene) {
    await fetch(`/api/projects/${params.id}/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visualText: scene.visualText,
        voiceText: scene.voiceText,
        prompt: scene.prompt,
        musicId: scene.musicId,
      }),
    });
  }

  async function handleDelete(id: string) {
    if (scenes.length <= 1) {
      toast.error("A video needs at least one scene.");
      return;
    }
    const res = await fetch(`/api/projects/${params.id}/scenes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }
    setScenes((prev) => prev.filter((s) => s.id !== id));
    toast.success("Scene removed");
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/projects/${params.id}/scenes/${id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }
    await load();
    toast.success("Scene duplicated");
  }

  async function handleRegenerate(id: string) {
    setRegeneratingId(id);
    try {
      const res = await fetch(`/api/projects/${params.id}/scenes/${id}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not regenerate this scene.");
        return;
      }
      updateLocal(id, { videoUrl: data.scene.videoUrl, imageUrl: data.scene.imageUrl });
      toast.success("Scene regenerated");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= scenes.length) return;
    const reordered = [...scenes];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setScenes(reordered);
    await fetch(`/api/projects/${params.id}/scenes/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneIds: reordered.map((s) => s.id) }),
    });
  }

  async function handleGenerate() {
    setSubmitting(true);
    try {
      if (editingId) {
        const scene = scenes.find((s) => s.id === editingId);
        if (scene) await saveScene(scene);
      }
      const res = await fetch(`/api/projects/${params.id}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not start generation.");
        return;
      }
      router.push(`/projects/${params.id}/generate?generationId=${data.generation.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-2 text-brand-300">
        <Sparkles className="h-4 w-4" />
        <p className="text-sm font-medium">Storyboard</p>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Review your storyboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fine-tune each scene — visuals, voice, prompt and music — before generating the final video.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene, index) => {
            const isEditing = editingId === scene.id;
            const isRegenerating = regeneratingId === scene.id;
            return (
              <Card key={scene.id} className="overflow-hidden">
                <div className="grid gap-4 p-5 sm:grid-cols-[140px_1fr]">
                  <div className="relative aspect-[9/16] w-full max-w-[140px] overflow-hidden rounded-xl bg-secondary">
                    <Image
                      src={scene.imageUrl || pickDemoThumbnail(scene.id)}
                      alt={`Scene ${scene.order}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {isRegenerating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="brand">SCENE {scene.order}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {scene.startSec}-{scene.endSec}s · {formatDuration(scene.endSec - scene.startSec)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconButton onClick={() => move(index, -1)} disabled={index === 0} label="Move up">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton onClick={() => move(index, 1)} disabled={index === scenes.length - 1} label="Move down">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton onClick={() => handleDuplicate(scene.id)} label="Duplicate">
                          <Copy className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton onClick={() => handleRegenerate(scene.id)} disabled={isRegenerating} label="Regenerate">
                          <RefreshCw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                        </IconButton>
                        <IconButton
                          onClick={async () => {
                            if (isEditing) await saveScene(scene);
                            setEditingId(isEditing ? null : scene.id);
                          }}
                          label={isEditing ? "Done" : "Edit"}
                        >
                          {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </IconButton>
                        <IconButton onClick={() => handleDelete(scene.id)} label="Delete" destructive>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={scene.visualText}
                          onChange={(e) => updateLocal(scene.id, { visualText: e.target.value })}
                          placeholder="Visual description"
                        />
                        <Textarea
                          value={scene.voiceText}
                          onChange={(e) => updateLocal(scene.id, { voiceText: e.target.value })}
                          placeholder="Voice line"
                        />
                        <Textarea
                          value={scene.prompt}
                          onChange={(e) => updateLocal(scene.id, { prompt: e.target.value })}
                          placeholder="Generation prompt"
                          className="text-xs"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5 text-sm">
                        {scene.visualText || scene.voiceText ? (
                          <>
                            <p><span className="text-muted-foreground">Visual: </span>{scene.visualText}</p>
                            <p className="italic text-muted-foreground">"{scene.voiceText}"</p>
                            <p className="truncate text-xs text-muted-foreground/70">Prompt: {scene.prompt}</p>
                          </>
                        ) : (
                          <p className="italic text-muted-foreground">
                            Empty scene — tap <Pencil className="inline h-3 w-3" /> Edit to write what happens and what's said.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Music2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select
                        value={scene.musicId ?? "none"}
                        onValueChange={(v) => {
                          const musicId = v === "none" ? null : v;
                          updateLocal(scene.id, { musicId });
                          fetch(`/api/projects/${params.id}/scenes/${scene.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ musicId }),
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="No music" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No music</SelectItem>
                          {MUSIC_LIBRARY.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name} · {m.category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button variant="gradient" size="lg" onClick={handleGenerate} disabled={loading || submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Generate video <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 ${
        destructive ? "hover:border-destructive/50 hover:text-destructive" : "hover:border-brand-500/40"
      }`}
    >
      {children}
    </button>
  );
}
