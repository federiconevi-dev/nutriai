"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GalleryHorizontalEnd,
  Loader2,
  Minus,
  Plus,
  Send,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CAROUSEL_STYLES, SLIDE_H, SLIDE_W, drawSlide, getStyle, renderSlideBlob, slugify } from "@/lib/social/carousel-render";
import type { CarouselData, CarouselSlide, SocialItem } from "@/lib/social/types";
import { PageHeader } from "./ui";
import { postJSON, useSocial } from "./use-social";

const KIND_LABEL: Record<CarouselSlide["kind"], string> = { hook: "Gancho", content: "Desarrollo", cta: "Cierre + CTA" };

function SlideCanvas({
  slide,
  index,
  total,
  styleId,
  handle,
  cta,
  className,
}: {
  slide: CarouselSlide;
  index: number;
  total: number;
  styleId: string;
  handle: string;
  cta?: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      const ctx = ref.current?.getContext("2d");
      if (ctx && !cancelled) drawSlide(ctx, slide, index, total, getStyle(styleId), handle, cta);
    };
    draw();
    document.fonts?.ready.then(draw);
    return () => {
      cancelled = true;
    };
  }, [slide, index, total, styleId, handle, cta]);
  return <canvas ref={ref} width={SLIDE_W} height={SLIDE_H} className={cn("block h-auto w-full", className)} />;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function CarouselView() {
  const { carousels, profile, create, update, remove } = useSocial();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [count, setCount] = useState(7);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<CarouselData | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState(0);
  const [source, setSource] = useState<"ai" | "demo" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tema");
    if (t) setTopic(t);
  }, []);

  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>(`[data-slide="${active}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  async function generate() {
    if (topic.trim().length < 3) {
      toast.error("Escribí el tema del carrusel");
      return;
    }
    setLoading(true);
    try {
      const res = await postJSON<{ title: string; slides: CarouselSlide[]; caption: string; cta: string; source: "ai" | "demo" }>("/api/social/ai/carousel", {
        topic: topic.trim(),
        audience: audience.trim() || undefined,
        slideCount: count,
      });
      setDraft((d) => ({
        topic: topic.trim(),
        title: res.title,
        slides: res.slides,
        caption: res.caption,
        cta: res.cta,
        styleId: d?.styleId ?? "noche",
        handle: d?.handle ?? (profile.handle === "tumarca" ? "federicomarketingg" : profile.handle),
      }));
      setSource(res.source);
      setSavedId(null);
      setDirty(true);
      setActive(0);
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const edit = (patch: Partial<CarouselData>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  const editSlide = (i: number, patch: Partial<CarouselSlide>) =>
    draft && edit({ slides: draft.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  function moveSlide(i: number, dir: -1 | 1) {
    if (!draft) return;
    const j = i + dir;
    if (j < 0 || j >= draft.slides.length) return;
    const slides = [...draft.slides];
    [slides[i], slides[j]] = [slides[j], slides[i]];
    edit({ slides });
    setActive(j);
  }

  function addSlide() {
    if (!draft || draft.slides.length >= 20) return;
    const at = Math.max(1, Math.min(active + 1, draft.slides.length - 1));
    const slides = [...draft.slides];
    slides.splice(at, 0, { kind: "content", title: "Nueva idea", body: "Escribí el desarrollo de esta filmina." });
    edit({ slides });
    setActive(at);
  }

  function deleteSlide(i: number) {
    if (!draft || draft.slides.length <= 2) return;
    edit({ slides: draft.slides.filter((_, j) => j !== i) });
    setActive((a) => Math.max(0, Math.min(a, draft.slides.length - 2)));
  }

  async function save() {
    if (!draft) return;
    if (savedId) {
      if (await update<"CAROUSEL">(savedId, draft)) {
        setDirty(false);
        toast.success("Carrusel actualizado");
      }
    } else {
      const item = await create("CAROUSEL", draft);
      if (item) {
        setSavedId(item.id);
        setDirty(false);
        toast.success("Carrusel guardado");
      }
    }
  }

  async function scheduleOnInstagram() {
    if (!draft) return;
    if (draft.slides.length > 10) {
      toast.error("Instagram permite máximo 10 filminas por carrusel");
      return;
    }
    setScheduling(true);
    let id = savedId;
    if (!id || dirty) {
      const item = id ? await update<"CAROUSEL">(id, draft) : await create("CAROUSEL", draft);
      if (!item) {
        setScheduling(false);
        return;
      }
      id = item.id;
      setSavedId(item.id);
      setDirty(false);
    }
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(18, 0, 0, 0);
    const post = await create("POST", {
      title: draft.title,
      caption: draft.caption ?? "",
      network: "instagram",
      status: "ready",
      scheduledAt: when.toISOString(),
      carouselId: id,
      autoPublish: true,
    });
    setScheduling(false);
    if (post) toast.success("Programado para mañana a las 18:00", { description: "Se publica solo en Instagram. Podés cambiar la fecha en el calendario." });
  }

  async function downloadAll() {
    if (!draft) return;
    setExporting(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const style = getStyle(draft.styleId);
      for (let i = 0; i < draft.slides.length; i++) {
        const blob = await renderSlideBlob(draft.slides[i], i, draft.slides.length, style, draft.handle, draft.cta);
        zip.file(`${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${slugify(draft.title)}.zip`);
      toast.success(`${draft.slides.length} filminas descargadas`);
    } catch (e) {
      toast.error((e as Error).message || "No se pudo descargar");
    } finally {
      setExporting(false);
    }
  }

  async function downloadOne() {
    if (!draft) return;
    const blob = await renderSlideBlob(draft.slides[active], active, draft.slides.length, getStyle(draft.styleId), draft.handle, draft.cta);
    downloadBlob(blob, `${slugify(draft.title)}-${String(active + 1).padStart(2, "0")}.png`);
  }

  function openSaved(c: SocialItem<"CAROUSEL">) {
    setDraft(c.data);
    setSavedId(c.id);
    setDirty(false);
    setSource(null);
    setActive(0);
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const slide = draft?.slides[active];

  return (
    <div>
      <PageHeader
        eyebrow="Inteligencia artificial"
        title="Creador de carruseles"
        description="Escribí el tema y la IA arma todas las filminas: gancho, desarrollo y cierre con llamada a la acción. Elegí un estilo, editá y descargá."
      />

      {/* Generator */}
      <section className="surface overflow-clip p-5 motion-safe:animate-rise-in sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <label className="block">
              <span className="text-sm font-medium">Tema del carrusel</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generate()}
                placeholder="Ej: 5 errores que frenan tu crecimiento en Instagram"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none placeholder:text-muted-foreground focus:border-brand-400/60 sm:text-[15px]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-muted-foreground">Audiencia (opcional)</span>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ej: emprendedores"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base outline-none placeholder:text-muted-foreground focus:border-brand-400/60 sm:text-[15px]"
              />
            </label>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Filminas</span>
              <div className="mt-2 flex h-12 items-center rounded-2xl border border-white/10 bg-black/20">
                <button className="flex h-full w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={() => setCount((c) => Math.max(2, c - 1))} disabled={count <= 2} aria-label="Menos filminas">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center font-semibold tabular-nums">{count}</span>
                <button className="flex h-full w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" onClick={() => setCount((c) => Math.min(10, c + 1))} disabled={count >= 10} aria-label="Más filminas">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button variant="gradient" size="lg" className="h-12 flex-1 lg:flex-none" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {loading ? "Creando…" : "Generar carrusel"}
            </Button>
          </div>
        </div>
      </section>

      {/* Style picker */}
      <section className="mt-4">
        <p className="eyebrow mb-3">Estilo visual</p>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
          {CAROUSEL_STYLES.map((s) => {
            const selected = (draft?.styleId ?? "noche") === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => (draft ? edit({ styleId: s.id }) : toast.info("Primero generá un carrusel"))}
                className={cn(
                  "group w-32 shrink-0 overflow-hidden rounded-2xl text-left ring-2 transition-all sm:w-auto",
                  selected ? "ring-white" : "ring-transparent hover:ring-white/30"
                )}
              >
                <div
                  className="relative flex aspect-[4/3] flex-col justify-end p-3"
                  style={{ background: `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[s.bg.length - 1]})` }}
                >
                  <span className="absolute right-2.5 top-2.5 h-3 w-3 rounded-full" style={{ background: s.accent }} />
                  <span
                    className="text-2xl font-extrabold leading-none"
                    style={{ color: s.text, fontFamily: s.serif ? "Georgia, serif" : undefined }}
                  >
                    Aa
                  </span>
                  <span className="mt-2 h-1.5 w-10 rounded-full" style={{ background: s.accent }} />
                  {selected && (
                    <span className="absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-zinc-900">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="bg-white/[0.04] px-3 py-2 text-xs font-medium">{s.name}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Editor */}
      <div ref={editorRef} className="scroll-mt-24">
        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="surface mx-auto aspect-[4/5] w-full max-w-[520px] animate-pulse" />
            <div className="surface h-80 animate-pulse" />
          </div>
        ) : draft && slide ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* Preview */}
            <section className="min-w-0">
              <div className="relative mx-auto max-w-[520px]">
                <div key={`${draft.styleId}-${active}`} className="overflow-hidden rounded-3xl shadow-2xl shadow-black/60 ring-1 ring-white/10 motion-safe:animate-fade-in">
                  <SlideCanvas slide={slide} index={active} total={draft.slides.length} styleId={draft.styleId} handle={draft.handle} cta={draft.cta} />
                </div>
                <button
                  onClick={() => setActive((a) => Math.max(0, a - 1))}
                  disabled={active === 0}
                  aria-label="Filmina anterior"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-0 sm:-left-5"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setActive((a) => Math.min(draft.slides.length - 1, a + 1))}
                  disabled={active === draft.slides.length - 1}
                  aria-label="Filmina siguiente"
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-0 sm:-right-5"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div ref={stripRef} className="no-scrollbar mx-auto mt-4 flex max-w-[640px] gap-2 overflow-x-auto px-1 py-1">
                {draft.slides.map((s, i) => (
                  <button
                    key={i}
                    data-slide={i}
                    onClick={() => setActive(i)}
                    className={cn(
                      "w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition-all sm:w-20",
                      i === active ? "ring-white" : "opacity-60 ring-transparent hover:opacity-100"
                    )}
                    aria-label={`Filmina ${i + 1}`}
                  >
                    <SlideCanvas slide={s} index={i} total={draft.slides.length} styleId={draft.styleId} handle={draft.handle} cta={draft.cta} />
                  </button>
                ))}
                <button
                  onClick={addSlide}
                  disabled={draft.slides.length >= 20}
                  className="flex aspect-[4/5] w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 text-muted-foreground hover:text-foreground sm:w-20"
                  aria-label="Agregar filmina"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </section>

            {/* Slide editor */}
            <aside className="surface h-fit p-5 motion-safe:animate-rise-in sm:p-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">
                    Filmina {active + 1} de {draft.slides.length}
                  </p>
                  <p className="mt-1 font-semibold">{KIND_LABEL[slide.kind]}</p>
                </div>
                <div className="flex gap-1">
                  <IconBtn label="Mover antes" onClick={() => moveSlide(active, -1)} disabled={active === 0}>
                    <ArrowUp className="h-4 w-4 -rotate-90 lg:rotate-0" />
                  </IconBtn>
                  <IconBtn label="Mover después" onClick={() => moveSlide(active, 1)} disabled={active === draft.slides.length - 1}>
                    <ArrowDown className="h-4 w-4 -rotate-90 lg:rotate-0" />
                  </IconBtn>
                  <IconBtn label="Eliminar filmina" onClick={() => deleteSlide(active)} disabled={draft.slides.length <= 2} danger>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>

              <div className="mt-4 flex gap-1.5">
                {(["hook", "content", "cta"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => editSlide(active, { kind: k })}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ring-1 transition-all",
                      slide.kind === k ? "bg-white text-zinc-900 ring-white" : "text-muted-foreground ring-white/10 hover:text-foreground"
                    )}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[11px] text-muted-foreground">Tip: poné palabras entre **asteriscos** para resaltarlas en color.</p>
              <label className="mt-2 block">
                <span className="text-xs font-medium text-muted-foreground">Título</span>
                <textarea
                  value={slide.title}
                  onChange={(e) => editSlide(active, { title: e.target.value })}
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-base font-semibold outline-none focus:border-brand-400/60 sm:text-sm"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-muted-foreground">Texto</span>
                <textarea
                  value={slide.body}
                  onChange={(e) => editSlide(active, { body: e.target.value })}
                  rows={5}
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-base leading-relaxed outline-none focus:border-brand-400/60 sm:text-sm"
                />
              </label>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Usuario</span>
                  <div className="mt-1.5 flex h-10 items-center rounded-xl border border-white/10 bg-black/20 px-3">
                    <span className="text-muted-foreground">@</span>
                    <input
                      value={draft.handle}
                      onChange={(e) => edit({ handle: e.target.value.replace(/^@/, "") })}
                      className="w-full bg-transparent pl-0.5 text-base outline-none sm:text-sm"
                    />
                  </div>
                </label>
                <label className="col-span-2 block">
                  <span className="text-xs font-medium text-muted-foreground">Botón de la última filmina</span>
                  <input
                    value={draft.cta ?? ""}
                    onChange={(e) => edit({ cta: e.target.value })}
                    placeholder="Comentá INFO"
                    className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base outline-none sm:text-sm"
                  />
                </label>
                <label className="col-span-2 block">
                  <span className="text-xs font-medium text-muted-foreground">Nombre</span>
                  <input
                    value={draft.title}
                    onChange={(e) => edit({ title: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-base outline-none sm:text-sm"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-xs font-medium text-muted-foreground">Caption del post</span>
                <textarea
                  value={draft.caption ?? ""}
                  onChange={(e) => edit({ caption: e.target.value })}
                  rows={4}
                  placeholder="Texto que acompaña al carrusel en Instagram"
                  className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-base leading-relaxed outline-none focus:border-brand-400/60 sm:text-sm"
                />
              </label>

              {source === "demo" && (
                <p className="mt-3 text-[11px] text-amber-300/90">
                  Modo demo: configurá AI_API_KEY para textos generados por un modelo de IA real.
                </p>
              )}

              <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-5">
                <Button variant="gradient" className="w-full" onClick={scheduleOnInstagram} disabled={scheduling}>
                  {scheduling ? <Loader2 className="animate-spin" /> : <Send />}
                  Programar en Instagram
                </Button>
                <Button variant="outline" className="w-full border-white/10" onClick={downloadAll} disabled={exporting}>
                  {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                  {exporting ? "Preparando…" : `Descargar todo (${draft.slides.length} PNG)`}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="border-white/10" onClick={downloadOne}>
                    <Download /> Esta filmina
                  </Button>
                  <Button variant="outline" className="border-white/10" onClick={save} disabled={!!savedId && !dirty}>
                    {savedId && !dirty ? <Check /> : <BookmarkPlus />}
                    {savedId && !dirty ? "Guardado" : "Guardar"}
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="surface mt-6 flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/30 to-brand-500/20 ring-1 ring-white/10">
              <GalleryHorizontalEnd className="h-6 w-6 text-fuchsia-200" />
            </span>
            <p className="mt-4 font-medium">Tu carrusel aparece acá</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Vas a ver la vista previa de cada filmina tal cual se va a descargar, lista para subir a Instagram (1080 × 1350).
            </p>
          </div>
        )}
      </div>

      {/* Library */}
      {carousels.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Tus carruseles</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {carousels.map((c, i) => (
              <div key={c.id} className="surface surface-hover group overflow-hidden motion-safe:animate-rise-in" style={{ animationDelay: `${i * 40}ms` }}>
                <button onClick={() => openSaved(c)} className="block w-full text-left">
                  <SlideCanvas slide={c.data.slides[0]} index={0} total={c.data.slides.length} styleId={c.data.styleId} handle={c.data.handle} cta={c.data.cta} />
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium">{c.data.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.data.slides.length} filminas · {getStyle(c.data.styleId).name}
                    </p>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    if (await remove(c.id)) {
                      if (savedId === c.id) setSavedId(null);
                      toast.success("Carrusel eliminado");
                    }
                  }}
                  aria-label="Eliminar carrusel"
                  className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white opacity-100 backdrop-blur transition hover:bg-red-500/80 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30",
        danger && "hover:bg-red-500/10 hover:text-red-400"
      )}
    >
      {children}
    </button>
  );
}
