"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Clock,
  Copy,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
  Flag,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FORMAT_META, NETWORKS, NETWORK_META, SCRIPT_FORMATS, type Network, type ScriptData, type SocialItem } from "@/lib/social/types";
import { NetworkIcon } from "./icons";
import { PageHeader } from "./ui";
import { postJSON, useSocial } from "./use-social";

export function formatDuration(sec: number) {
  if (sec < 90) return `${sec} s`;
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function scriptToText(s: ScriptData) {
  return [
    s.title.toUpperCase(),
    `Formato: ${FORMAT_META[s.format].label} · Duración sugerida: ${formatDuration(s.durationSec)}`,
    "",
    "GANCHO",
    s.hook,
    ...(s.hookOnScreen ? [`En pantalla: ${s.hookOnScreen}`] : []),
    "",
    "DESARROLLO",
    ...s.points.map((p, i) => `${i + 1}. ${p.title}\n${p.detail}${p.onScreen ? `\nEn pantalla: ${p.onScreen}` : ""}`),
    "",
    "CIERRE",
    s.closing,
    "",
    "LLAMADA A LA ACCIÓN",
    s.cta,
    ...(s.caption || s.hashtags?.length ? ["", "CAPTION", [s.caption, s.hashtags?.join(" ")].filter(Boolean).join("\n")] : []),
  ].join("\n");
}

export function ScriptsView() {
  const { scripts, create, update, remove } = useSocial();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [network, setNetwork] = useState<Network | undefined>();
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ScriptData | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [source, setSource] = useState<"ai" | "demo" | null>(null);
  const [query, setQuery] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tema");
    if (t) setTopic(t);
  }, []);

  async function generate() {
    if (topic.trim().length < 3) {
      toast.error("Contame el tema del video");
      return;
    }
    setLoading(true);
    try {
      const res = await postJSON<{ script: ScriptData; source: "ai" | "demo" }>("/api/social/ai/script", {
        topic: topic.trim(),
        audience: audience.trim() || undefined,
        network,
      });
      setDraft(res.script);
      setSource(res.source);
      setSavedId(null);
      setDirty(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (savedId) {
      if (await update<"SCRIPT">(savedId, draft)) {
        toast.success("Guion actualizado");
        setDirty(false);
      }
    } else {
      const item = await create("SCRIPT", draft);
      if (item) {
        setSavedId(item.id);
        setDirty(false);
        toast.success("Guardado en tu biblioteca");
      }
    }
  }

  function openSaved(s: SocialItem<"SCRIPT">) {
    setDraft(s.data);
    setSavedId(s.id);
    setDirty(false);
    setSource(null);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scripts.filter((s) => !q || s.data.title.toLowerCase().includes(q) || s.data.topic.toLowerCase().includes(q));
  }, [scripts, query]);

  const edit = (patch: Partial<ScriptData>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Inteligencia artificial"
        title="Creador de guiones"
        description="Decime el tema del video y te armo el guion completo: gancho, puntos clave y cierre con llamada a la acción."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {/* Generator */}
          <section className="surface overflow-clip p-5 motion-safe:animate-rise-in sm:p-6">
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
            <label className="relative block">
              <span className="text-sm font-medium">¿De qué trata el video?</span>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
                }}
                rows={3}
                placeholder="Ej: cómo conseguir tus primeros 1.000 seguidores"
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-400/60 sm:text-[15px]"
              />
            </label>
            <div className="relative mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Audiencia (opcional): emprendedores, mamás…"
                className="h-10 rounded-xl border border-white/10 bg-black/20 px-3.5 text-base outline-none placeholder:text-muted-foreground focus:border-brand-400/60 sm:text-sm"
              />
              <div className="flex gap-1.5">
                {NETWORKS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNetwork(network === n ? undefined : n)}
                    aria-pressed={network === n}
                    className={cn(
                      "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium ring-1 transition-all",
                      network === n ? "text-white ring-transparent" : "text-muted-foreground ring-white/10 hover:text-foreground"
                    )}
                    style={network === n ? { background: NETWORK_META[n].color } : undefined}
                  >
                    <NetworkIcon network={n} className="h-4 w-4" />
                    <span>{NETWORK_META[n].label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button variant="gradient" size="lg" className="relative mt-4 w-full" onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {loading ? "Escribiendo tu guion…" : draft && !savedId ? "Generar otra versión" : "Generar guion"}
            </Button>
          </section>

          {/* Result */}
          <div ref={resultRef} className="scroll-mt-24">
            {loading ? (
              <ScriptSkeleton />
            ) : draft ? (
              <ScriptEditor
                script={draft}
                source={source}
                saved={!!savedId && !dirty}
                onChange={edit}
                onSave={save}
                onRegenerate={generate}
                onClose={() => {
                  setDraft(null);
                  setSavedId(null);
                }}
              />
            ) : (
              <div className="surface flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400/30 to-fuchsia-500/20 ring-1 ring-white/10">
                  <Sparkles className="h-6 w-6 text-brand-200" />
                </span>
                <p className="mt-4 font-medium">Tu próximo guion empieza acá</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Te sugiero también la duración ideal y si conviene un reel corto, un video largo o una historia.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Library */}
        <aside className="surface h-fit p-5 motion-safe:animate-rise-in lg:sticky lg:top-24" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Biblioteca</h2>
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-xs text-muted-foreground">{scripts.length}</span>
          </div>
          {scripts.length > 3 && (
            <label className="mt-3 flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/[0.07]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar guiones…"
                className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
              />
            </label>
          )}
          <div className="mt-3 space-y-2 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
            {library.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {scripts.length ? "Ningún guion coincide." : "Los guiones que guardes van a aparecer acá."}
              </p>
            )}
            {library.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-start gap-3 rounded-2xl p-3 ring-1 transition-colors",
                  savedId === s.id ? "bg-brand-500/10 ring-brand-400/30" : "ring-white/[0.06] hover:bg-white/[0.04]"
                )}
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => openSaved(s)}>
                  <p className="line-clamp-2 text-sm font-medium">{s.data.title}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{FORMAT_META[s.data.format].short}</span>·<span>{formatDuration(s.data.durationSec)}</span>·
                    <span>{new Date(s.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
                  </p>
                </button>
                <button
                  onClick={async () => {
                    if (await remove(s.id)) {
                      if (savedId === s.id) setSavedId(null);
                      toast.success("Guion eliminado");
                    }
                  }}
                  aria-label="Eliminar guion"
                  className="rounded-lg p-1.5 text-muted-foreground opacity-100 transition hover:bg-red-500/10 hover:text-red-400 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function AutoTextarea({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full resize-none overflow-hidden rounded-lg bg-transparent outline-none transition-colors hover:bg-white/[0.03] focus:bg-white/[0.05] focus:ring-1 focus:ring-white/10",
        className
      )}
    />
  );
}

function ScriptEditor({
  script,
  source,
  saved,
  onChange,
  onSave,
  onRegenerate,
  onClose,
}: {
  script: ScriptData;
  source: "ai" | "demo" | null;
  saved: boolean;
  onChange: (p: Partial<ScriptData>) => void;
  onSave: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(scriptToText(script));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="surface overflow-hidden motion-safe:animate-rise-in">
      <header className="border-b border-white/[0.06] p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-semibold text-brand-200">
            <FileText className="h-3.5 w-3.5" /> {FORMAT_META[script.format].label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" /> {formatDuration(script.durationSec)}
          </span>
          {source === "demo" && (
            <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300" title="Configurá AI_API_KEY para usar un modelo de IA real">
              Modo demo
            </span>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-white/10" aria-label="Cerrar guion">
            <X className="h-4 w-4" />
          </button>
        </div>
        <AutoTextarea value={script.title} onChange={(v) => onChange({ title: v })} className="-mx-2 px-2 py-1 text-xl font-semibold tracking-tight sm:text-2xl" />

        <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
          <p className="eyebrow">Formato recomendado</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SCRIPT_FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => onChange({ format: f })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all",
                  script.format === f ? "bg-white text-zinc-900 ring-white" : "text-muted-foreground ring-white/10 hover:text-foreground"
                )}
              >
                {FORMAT_META[f].label}
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-sm text-muted-foreground">{script.formatReason}</p>
        </div>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        <Block icon={Zap} color="text-amber-300 bg-amber-400/10" title="Gancho inicial" hint="primeros 3 segundos">
          <AutoTextarea value={script.hook} onChange={(v) => onChange({ hook: v })} className="-mx-2 px-2 py-1 text-[17px] font-medium leading-relaxed" />
          <OnScreen value={script.hookOnScreen ?? ""} onChange={(v) => onChange({ hookOnScreen: v })} />
        </Block>

        <Block icon={Sparkles} color="text-brand-200 bg-brand-500/15" title="Puntos clave" hint={`${script.points.length} puntos`}>
          <ol className="space-y-3">
            {script.points.map((p, i) => (
              <li key={i} className="group relative flex gap-3 rounded-2xl bg-white/[0.025] p-3 ring-1 ring-white/[0.05]">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <AutoTextarea
                    value={p.title}
                    onChange={(v) => onChange({ points: script.points.map((x, j) => (j === i ? { ...x, title: v } : x)) })}
                    className="-mx-2 px-2 py-0.5 font-semibold"
                  />
                  <AutoTextarea
                    value={p.detail}
                    onChange={(v) => onChange({ points: script.points.map((x, j) => (j === i ? { ...x, detail: v } : x)) })}
                    className="-mx-2 px-2 py-0.5 text-sm leading-relaxed text-muted-foreground"
                  />
                  <OnScreen
                    value={p.onScreen ?? ""}
                    onChange={(v) => onChange({ points: script.points.map((x, j) => (j === i ? { ...x, onScreen: v } : x)) })}
                  />
                </div>
                {script.points.length > 1 && (
                  <button
                    onClick={() => onChange({ points: script.points.filter((_, j) => j !== i) })}
                    aria-label="Quitar punto"
                    className="h-fit rounded-lg p-1 text-muted-foreground opacity-100 transition hover:bg-white/10 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ol>
          {script.points.length < 12 && (
            <button
              onClick={() => onChange({ points: [...script.points, { title: "Nuevo punto", detail: "Qué querés decir acá…" }] })}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar punto
            </button>
          )}
        </Block>

        <Block icon={Flag} color="text-cyan-300 bg-cyan-400/10" title="Cierre">
          <AutoTextarea value={script.closing} onChange={(v) => onChange({ closing: v })} className="-mx-2 px-2 py-1 leading-relaxed" />
        </Block>

        <Block icon={Megaphone} color="text-emerald-300 bg-emerald-400/10" title="Llamada a la acción">
          <AutoTextarea value={script.cta} onChange={(v) => onChange({ cta: v })} className="-mx-2 px-2 py-1 font-medium leading-relaxed" />
        </Block>

        {!!script.altHooks?.length && (
          <Block icon={Zap} color="text-amber-300 bg-amber-400/10" title="Ganchos alternativos" hint="para testear">
            <ul className="space-y-1.5">
              {script.altHooks.map((h, i) => (
                <li key={i}>
                  <button
                    onClick={() => onChange({ hook: h, altHooks: script.altHooks!.map((x, j) => (j === i ? script.hook : x)) })}
                    className="w-full rounded-xl bg-white/[0.03] px-3 py-2 text-left text-sm ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06]"
                    title="Usar este gancho"
                  >
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {(script.caption || script.hashtags?.length) && (
          <Block icon={FileText} color="text-pink-300 bg-pink-400/10" title="Caption y hashtags">
            <AutoTextarea value={script.caption ?? ""} onChange={(v) => onChange({ caption: v })} className="-mx-2 px-2 py-1 text-sm leading-relaxed" />
            {!!script.hashtags?.length && <p className="mt-1 text-sm text-brand-300">{script.hashtags.join(" ")}</p>}
          </Block>
        )}

        {script.whyShare && (
          <p className="rounded-2xl bg-white/[0.03] p-3 text-xs text-muted-foreground ring-1 ring-white/[0.06]">
            <b className="text-foreground">Por qué lo van a guardar o compartir:</b> {script.whyShare}
          </p>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-white/[0.06] p-5 sm:flex-row sm:p-6">
        <Button variant="gradient" className="sm:flex-1" onClick={onSave} disabled={saved}>
          {saved ? <Check /> : <BookmarkPlus />}
          {saved ? "Guardado en la biblioteca" : "Guardar en la biblioteca"}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-white/10" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="outline" className="flex-1 border-white/10" onClick={onRegenerate}>
            <RefreshCw /> Regenerar
          </Button>
        </div>
      </footer>
    </article>
  );
}

function OnScreen({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-white/[0.04] px-2 py-1 ring-1 ring-white/[0.06]">
      <span className="mt-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">En pantalla</span>
      <AutoTextarea value={value} onChange={onChange} className="px-1 text-xs font-medium" />
    </div>
  );
}

function Block({
  icon: Icon,
  color,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-xl", color)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

function ScriptSkeleton() {
  return (
    <div className="surface space-y-5 p-6">
      {[60, 90, 75, 85, 50].map((w, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 animate-pulse rounded-full bg-white/[0.07]" style={{ width: `${w}%` }} />
          <div className="h-4 animate-pulse rounded-full bg-white/[0.05]" style={{ width: `${w - 20}%` }} />
        </div>
      ))}
    </div>
  );
}
