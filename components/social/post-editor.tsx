"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Loader2, Plus, Send, Trash2, Upload, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatLongDay, toLocalInput } from "@/lib/social/dates";
import {
  NETWORKS,
  NETWORK_META,
  POST_STATUSES,
  STATUS_META,
  type PostData,
  type SocialItem,
} from "@/lib/social/types";
import { NetworkBadge, NetworkIcon } from "./icons";
import { PostImage, StatusBadge } from "./ui";
import { postJSON, useSocial } from "./use-social";

const field = "text-base sm:text-sm bg-white/[0.03] border-white/10";

function emptyPost(date: Date): PostData {
  const d = new Date(date);
  const now = new Date();
  d.setHours(d.toDateString() === now.toDateString() ? Math.min(now.getHours() + 1, 23) : 18, 0, 0, 0);
  return { title: "", caption: "", network: "instagram", status: "draft", scheduledAt: d.toISOString(), imageUrl: "" };
}

/**
 * Side panel for one calendar day: lists that day's posts and lets you create
 * a new one or edit an existing one.
 */
export function PostEditorSheet({
  open,
  onOpenChange,
  date,
  dayPosts,
  initialPostId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  dayPosts: SocialItem<"POST">[];
  /** Post to open directly, or "new" to jump straight to the create form. */
  initialPostId?: string | "new" | null;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  useEffect(() => {
    if (open) setEditing(initialPostId ?? (dayPosts.length ? null : "new"));
    // Only reset when the panel opens or the selected day changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date?.getTime(), initialPostId]);

  const current = editing && editing !== "new" ? dayPosts.find((p) => p.id === editing) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <div className="border-b border-white/[0.07] px-6 pb-4 pt-4 sm:pt-6">
          <p className="eyebrow">{editing ? (editing === "new" ? "Nuevo post" : "Editar post") : "Día seleccionado"}</p>
          <SheetTitle className="mt-1 pr-8 text-xl font-semibold tracking-tight">
            {date ? formatLongDay(date) : "Post"}
          </SheetTitle>
          <SheetDescription className="sr-only">Crear o editar publicaciones del día</SheetDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {editing === null ? (
            <DayList posts={dayPosts} onSelect={setEditing} />
          ) : (
            <PostForm
              key={editing}
              post={current}
              date={date ?? new Date()}
              onBack={dayPosts.length ? () => setEditing(null) : undefined}
              onDone={() => (dayPosts.length > 1 || editing === "new" ? setEditing(null) : onOpenChange(false))}
              onDeleted={() => (dayPosts.length > 1 ? setEditing(null) : onOpenChange(false))}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DayList({ posts, onSelect }: { posts: SocialItem<"POST">[]; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No hay nada programado para este día.</p>
        </div>
      )}
      {posts.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5 text-left transition-colors hover:bg-white/[0.06]"
        >
          <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl">
            <PostImage src={p.data.imageUrl} alt={p.data.title} className="h-full w-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.data.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(p.data.scheduledAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
              {NETWORK_META[p.data.network].label}
            </p>
            <StatusBadge status={p.data.status} className="mt-1.5" />
          </div>
          <NetworkBadge network={p.data.network} size="sm" />
        </button>
      ))}
      <Button variant="gradient" className="w-full" onClick={() => onSelect("new")}>
        <Plus /> Crear post nuevo
      </Button>
    </div>
  );
}

function PostForm({
  post,
  date,
  onBack,
  onDone,
  onDeleted,
}: {
  post?: SocialItem<"POST">;
  date: Date;
  onBack?: () => void;
  onDone: () => void;
  onDeleted: () => void;
}) {
  const { create, update, remove, carousels, replaceItem } = useSocial();
  const [publishing, setPublishing] = useState(false);
  const [data, setData] = useState<PostData>(() => post?.data ?? emptyPost(date));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carousel = data.carouselId ? carousels.find((c) => c.id === data.carouselId) : undefined;
  const set = <K extends keyof PostData>(k: K, v: PostData[K]) => setData((d) => ({ ...d, [k]: v }));
  const metrics = data.metrics ?? { views: 0, likes: 0, comments: 0, shares: 0 };

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo subir la imagen");
      set("imageUrl", json.asset.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!data.title.trim()) {
      toast.error("Poné un título para el post");
      return;
    }
    setSaving(true);
    const payload: PostData = {
      ...data,
      title: data.title.trim(),
      metrics: data.status === "published" ? metrics : undefined,
    };
    const ok = post ? await update<"POST">(post.id, payload) : await create("POST", payload);
    setSaving(false);
    if (ok) {
      toast.success(post ? "Post actualizado" : "Post programado");
      onDone();
    }
  }

  async function publishNow() {
    if (!post) return;
    setPublishing(true);
    try {
      // Save pending edits first so Instagram gets the latest caption.
      await update<"POST">(post.id, { ...data, title: data.title.trim() || post.data.title });
      const res = await postJSON<{ item: SocialItem<"POST"> | null }>(`/api/social/${post.id}/publish`, {});
      if (res.item) {
        replaceItem(res.item);
        setData(res.item.data);
        if (res.item.data.ig?.mediaId) toast.success("¡Publicado en Instagram!");
        else toast.message(res.item.data.ig?.error ?? "Instagram está procesando el post");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function del() {
    if (!post) return;
    if (await remove(post.id)) {
      toast.success("Post eliminado");
      onDeleted();
    }
  }

  return (
    <div className="space-y-5">
      {onBack && (
        <button onClick={onBack} className="-mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Volver al día
        </button>
      )}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10"
      >
        <PostImage src={data.imageUrl} alt="Imagen del post" className="h-full w-full" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Subiendo…" : "Subir imagen"}
          </span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Input
        className={field}
        placeholder="…o pegá el link de una imagen"
        value={data.imageUrl ?? ""}
        onChange={(e) => set("imageUrl", e.target.value)}
      />

      <Field label="Título">
        <Input className={field} value={data.title} onChange={(e) => set("title", e.target.value)} placeholder="¿De qué trata el post?" autoFocus={!post} />
      </Field>

      <Field label="Red social">
        <div className="grid grid-cols-3 gap-2">
          {NETWORKS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set("network", n)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition-all",
                data.network === n ? "border-transparent text-white shadow-lg" : "border-white/10 text-muted-foreground hover:bg-white/5"
              )}
              style={data.network === n ? { background: NETWORK_META[n].color } : undefined}
            >
              <NetworkIcon network={n} className="h-5 w-5" />
              {NETWORK_META[n].label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Estado">
        <div className="grid grid-cols-3 gap-2">
          {POST_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("status", s)}
              className={cn(
                "rounded-xl px-2 py-2.5 text-xs font-semibold ring-1 ring-inset transition-all",
                data.status === s ? STATUS_META[s].className : "text-muted-foreground ring-white/10 hover:bg-white/5"
              )}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Fecha y hora">
        <Input
          type="datetime-local"
          className={cn(field, "[color-scheme:dark]")}
          value={toLocalInput(new Date(data.scheduledAt))}
          onChange={(e) => e.target.value && set("scheduledAt", new Date(e.target.value).toISOString())}
        />
      </Field>

      <Field label="Texto / caption">
        <Textarea className={field} rows={4} value={data.caption ?? ""} onChange={(e) => set("caption", e.target.value)} placeholder="Escribí el copy del post…" />
      </Field>

      {data.network === "instagram" && (
        <Field label="Publicación en Instagram">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            {carousel ? (
              <p className="text-xs text-muted-foreground">
                📎 Se publica el carrusel <b className="text-foreground">{carousel.data.title}</b> ({carousel.data.slides.length} filminas)
              </p>
            ) : (
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Video del reel (link público a un .mp4) — opcional; si no, se usa la imagen</span>
                <Input className={cn(field, "mt-1")} value={data.videoUrl ?? ""} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://…/mi-reel.mp4" />
              </label>
            )}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Publicar solo en la fecha programada</span>
              <input
                type="checkbox"
                checked={!!data.autoPublish}
                onChange={(e) => set("autoPublish", e.target.checked)}
                className="h-5 w-5 accent-emerald-500"
              />
            </label>
            {data.autoPublish && data.status !== "ready" && !data.ig?.mediaId && (
              <p className="text-[11px] text-amber-300">Para que se publique solo, poné el estado en «Listo».</p>
            )}
            {data.ig?.permalink ? (
              <a href={data.ig.permalink} target="_blank" rel="noreferrer" className="block text-xs font-medium text-emerald-400 underline">
                ✓ Publicado — ver en Instagram
              </a>
            ) : data.ig?.mediaId ? (
              <p className="text-xs font-medium text-emerald-400">✓ Publicado en Instagram</p>
            ) : (
              <>
                {data.ig?.error && <p className="text-xs text-red-400">Último intento: {data.ig.error}</p>}
                {post && (
                  <Button variant="outline" className="w-full border-white/10" onClick={publishNow} disabled={publishing}>
                    {publishing ? <Loader2 className="animate-spin" /> : <Send />} Publicar ahora en Instagram
                  </Button>
                )}
              </>
            )}
          </div>
        </Field>
      )}

      {data.status === "published" && (
        <Field label="Resultados">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["views", "Visualizaciones"],
                ["likes", "Me gusta"],
                ["comments", "Comentarios"],
                ["shares", "Compartidos"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="block text-[11px] text-muted-foreground">{label}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="w-full bg-transparent text-base font-semibold tabular-nums outline-none sm:text-sm"
                  value={metrics[k] || ""}
                  placeholder="0"
                  onChange={(e) => set("metrics", { ...metrics, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                />
              </label>
            ))}
          </div>
        </Field>
      )}

      <div className="flex gap-2 pt-2">
        {post && (
          <Button variant="outline" size="icon" onClick={del} aria-label="Eliminar post" className="shrink-0 border-white/10 text-red-400 hover:text-red-300">
            <Trash2 />
          </Button>
        )}
        <Button variant="gradient" className="flex-1" onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {post ? "Guardar cambios" : "Programar post"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
