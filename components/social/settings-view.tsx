"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Bot, Check, ExternalLink, Instagram, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_BRAND } from "@/lib/social/brand";
import { CAROUSEL_STYLES } from "@/lib/social/carousel-render";
import type { AutopilotSettings, BrandData, PublicSettings } from "@/lib/social/types";
import { PageHeader } from "./ui";
import { postJSON, useSocial } from "./use-social";

const BRAND_FIELDS: { key: keyof BrandData; label: string; rows: number }[] = [
  { key: "name", label: "Quién sos", rows: 1 },
  { key: "niche", label: "Nicho", rows: 2 },
  { key: "audience", label: "Público", rows: 2 },
  { key: "tone", label: "Tono", rows: 2 },
  { key: "offer", label: "Qué vendés", rows: 2 },
  { key: "cta", label: "Llamada a la acción", rows: 1 },
  { key: "pains", label: "Dolores del público", rows: 3 },
  { key: "rules", label: "Reglas (lo que nunca se hace)", rows: 3 },
  { key: "mix", label: "Mezcla de contenido", rows: 3 },
];

const input =
  "w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-base outline-none placeholder:text-muted-foreground focus:border-brand-400/60 sm:text-sm";

async function fetchSettings(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudieron cargar los ajustes");
  return (await res.json()) as { settings: PublicSettings };
}

async function putSettings(body: unknown) {
  const res = await fetch("/api/social/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo guardar");
  return json as { settings: PublicSettings };
}

export function SettingsView() {
  const { profile, profileId, update, mutateAll } = useSocial();
  const { data, mutate } = useSWR("/api/social/settings", fetchSettings, { revalidateOnFocus: false });
  const settings = data?.settings;

  const [brand, setBrand] = useState<BrandData>(DEFAULT_BRAND);
  const [handle, setHandle] = useState("");
  const [ap, setAp] = useState<AutopilotSettings | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setBrand(profile.brand ?? DEFAULT_BRAND);
    setHandle(profile.handle === "tumarca" ? "federicomarketingg" : profile.handle);
  }, [profile.brand, profile.handle]);
  useEffect(() => {
    if (settings) setAp(settings.autopilot);
  }, [settings]);

  async function saveBrand() {
    if (!profileId) return;
    setBusy("brand");
    const ok = await update<"PROFILE">(profileId, { ...profile, handle: handle.replace(/^@/, ""), brand });
    setBusy(null);
    if (ok) toast.success("Marca guardada: todo lo que se genere va a usarla");
  }

  async function saveAutopilot(next: AutopilotSettings) {
    setAp(next);
    try {
      const { lastRunDay: _ignored, ...rest } = next;
      await mutate(await putSettings({ autopilot: rest }), { revalidate: false });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function connect() {
    setBusy("ig");
    try {
      await mutate(await putSettings({ instagramToken: token.trim() }), { revalidate: false });
      setToken("");
      toast.success("Instagram conectado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    try {
      await mutate(await putSettings({ disconnectInstagram: true }), { revalidate: false });
      toast.success("Instagram desconectado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function generateNow() {
    setBusy("gen");
    try {
      const res = await postJSON<{ created: number }>("/api/social/autopilot", {});
      await mutateAll();
      toast.success(`Listo: ${res.created} piezas nuevas para mañana`, { description: "Las ves en el calendario." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Automático"
        title="Piloto automático"
        description="La app crea contenido todos los días con tu marca y publica los carruseles en Instagram sola."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Autopilot */}
        <section className="surface p-5 motion-safe:animate-rise-in sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-200">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Contenido automático diario</h2>
                <p className="text-xs text-muted-foreground">Se genera cada mañana para el día siguiente</p>
              </div>
            </div>
            {ap && <Toggle checked={ap.enabled} onChange={(v) => saveAutopilot({ ...ap, enabled: v })} label="Activar piloto automático" />}
          </div>

          {ap ? (
            <div className="mt-6 space-y-5">
              <Stepper label="Carruseles por día (se publican en Instagram)" value={ap.carouselsPerDay} onChange={(v) => saveAutopilot({ ...ap, carouselsPerDay: v })} />
              <Stepper label="Guiones de reels por día (para grabar)" value={ap.scriptsPerDay} onChange={(v) => saveAutopilot({ ...ap, scriptsPerDay: v })} />
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm">Hora de publicación (Argentina)</span>
                <select
                  value={ap.publishHour}
                  onChange={(e) => saveAutopilot({ ...ap, publishHour: Number(e.target.value) })}
                  className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-base sm:text-sm"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-2 text-sm">Estilo de los carruseles</p>
                <div className="flex flex-wrap gap-2">
                  {CAROUSEL_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => saveAutopilot({ ...ap, styleId: s.id })}
                      className={cn(
                        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all",
                        ap.styleId === s.id ? "bg-white text-zinc-900 ring-white" : "text-muted-foreground ring-white/10 hover:text-foreground"
                      )}
                    >
                      <span className="h-3 w-3 rounded-full ring-1 ring-black/20" style={{ background: `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[s.bg.length - 1]})` }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm">Publicar los carruseles solos en Instagram</span>
                <Toggle checked={ap.autoPublish} onChange={(v) => saveAutopilot({ ...ap, autoPublish: v })} label="Publicar automático" />
              </label>
              <Button variant="gradient" className="w-full" onClick={generateNow} disabled={busy === "gen"}>
                {busy === "gen" ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {busy === "gen" ? "Creando contenido… (puede tardar 1 minuto)" : "Generar la tanda de mañana ahora"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Los carruseles se publican una vez por día cerca de la hora elegida. Los guiones quedan en el calendario como
                «🎬 Grabar» para que los grabes.
              </p>
            </div>
          ) : (
            <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
          )}
        </section>

        {/* Instagram */}
        <section className="surface p-5 motion-safe:animate-rise-in sm:p-6" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300">
              <Instagram className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">Instagram</h2>
              <p className="text-xs text-muted-foreground">Para publicar directo en tu cuenta</p>
            </div>
          </div>

          {settings?.instagram.connected ? (
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/20">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-400" /> Conectado como <b>@{settings.instagram.username}</b>
              </div>
              <button onClick={disconnect} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400">
                <X className="h-3.5 w-3.5" /> Desconectar
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li>
                  <b className="text-foreground">1.</b> En la app de Instagram: Configuración → Tipo de cuenta → pasala a{" "}
                  <b className="text-foreground">Profesional (Creador)</b>.
                </li>
                <li>
                  <b className="text-foreground">2.</b> Entrá a{" "}
                  <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-300 underline">
                    developers.facebook.com/apps <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  → <b className="text-foreground">Crear app</b> → caso de uso{" "}
                  <b className="text-foreground">«Administrar mensajes y contenido en Instagram»</b>.
                </li>
                <li>
                  <b className="text-foreground">3.</b> En <b className="text-foreground">«Configuración de la API con inicio de sesión de Instagram»</b> →
                  «Generar tokens de acceso» → <b className="text-foreground">Agregar cuenta</b> → iniciá sesión con @federicomarketingg.
                </li>
                <li>
                  <b className="text-foreground">4.</b> Tocá <b className="text-foreground">«Generar token»</b>, copialo y pegalo acá abajo.
                </li>
              </ol>
              <textarea value={token} onChange={(e) => setToken(e.target.value)} rows={3} placeholder="Pegá acá el token de Instagram (empieza con IG…)" className={input} />
              <Button variant="gradient" className="w-full" onClick={connect} disabled={busy === "ig" || token.trim().length < 20}>
                {busy === "ig" ? <Loader2 className="animate-spin" /> : <Instagram />} Conectar Instagram
              </Button>
              <p className="text-xs text-muted-foreground">El token queda guardado en el servidor y nunca se muestra en la página. Se renueva solo.</p>
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-white/[0.03] p-4 text-xs text-muted-foreground ring-1 ring-white/[0.06]">
            <b className="text-foreground">TikTok:</b> TikTok solo permite publicar automático con una app aprobada por ellos. Mientras tanto, los
            guiones y textos quedan listos en el calendario para subirlos en un minuto.
          </div>
        </section>

        {/* Brand */}
        <section className="surface p-5 motion-safe:animate-rise-in sm:p-6 lg:col-span-2" style={{ animationDelay: "160ms" }}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Tu marca</h2>
                <p className="text-xs text-muted-foreground">La IA usa esto en cada guion, carrusel y tema</p>
              </div>
            </div>
            <Button variant="gradient" onClick={saveBrand} disabled={busy === "brand"}>
              {busy === "brand" && <Loader2 className="animate-spin" />} Guardar marca
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Usuario de Instagram/TikTok</span>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} className={cn(input, "mt-1.5 h-10 py-0")} />
            </label>
            {BRAND_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
                <textarea rows={f.rows} value={brand[f.key]} onChange={(e) => setBrand({ ...brand, [f.key]: e.target.value })} className={cn(input, "mt-1.5")} />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-white/15")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
    </button>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex h-10 shrink-0 items-center rounded-xl border border-white/10 bg-black/20">
        <button className="h-full w-10 text-lg text-muted-foreground disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="Menos">
          −
        </button>
        <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
        <button className="h-full w-10 text-lg text-muted-foreground disabled:opacity-30" disabled={value >= 3} onClick={() => onChange(value + 1)} aria-label="Más">
          +
        </button>
      </div>
    </div>
  );
}
