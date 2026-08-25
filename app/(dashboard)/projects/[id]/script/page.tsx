"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Pencil, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";

interface Scene {
  id: string;
  order: number;
  startSec: number;
  endSec: number;
  visualText: string;
  voiceText: string;
  prompt: string;
}

export default function ScriptPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    loadScript(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadScript(regenerate: boolean) {
    regenerate ? setRegenerating(true) : setLoading(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not generate the script.");
        return;
      }
      setScenes(data.scenes);
      setTitle(data.script?.title ?? "");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  async function saveScene(scene: Scene) {
    await fetch(`/api/projects/${params.id}/scenes/${scene.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visualText: scene.visualText, voiceText: scene.voiceText }),
    });
  }

  async function handleContinue() {
    if (editing) {
      await Promise.all(scenes.map((s) => saveScene(s)));
    }
    router.push(`/projects/${params.id}/storyboard`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-2 text-brand-300">
        <Sparkles className="h-4 w-4" />
        <p className="text-sm font-medium">Your AI script</p>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{loading ? "Writing your script…" : title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review the scene-by-scene breakdown before we build the storyboard.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <Card key={scene.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="brand">SCENE {scene.order}</Badge>
                <span className="text-xs text-muted-foreground">
                  {scene.startSec}-{scene.endSec}s ({formatDuration(scene.endSec - scene.startSec)})
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visual</p>
                  {editing ? (
                    <Textarea
                      className="mt-1"
                      value={scene.visualText}
                      onChange={(e) =>
                        setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, visualText: e.target.value } : s)))
                      }
                    />
                  ) : (
                    <p className="mt-1 text-sm">{scene.visualText}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Voice</p>
                  {editing ? (
                    <Textarea
                      className="mt-1"
                      value={scene.voiceText}
                      onChange={(e) =>
                        setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, voiceText: e.target.value } : s)))
                      }
                    />
                  ) : (
                    <p className="mt-1 text-sm italic text-muted-foreground">"{scene.voiceText}"</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadScript(true)} disabled={loading || regenerating}>
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate script
          </Button>
          <Button variant="outline" onClick={() => setEditing((v) => !v)} disabled={loading}>
            <Pencil className="h-4 w-4" /> {editing ? "Done editing" : "Edit script"}
          </Button>
        </div>
        <Button variant="gradient" onClick={handleContinue} disabled={loading || scenes.length === 0}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
