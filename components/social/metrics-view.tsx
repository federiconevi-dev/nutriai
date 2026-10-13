"use client";

import { useMemo, useState } from "react";
import { Eye, Info, Pencil, Sparkles, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCompact, formatNumber, formatPct, formatShortDate } from "@/lib/social/dates";
import { computeSummary } from "@/lib/social/metrics";
import { NETWORKS, NETWORK_META, type ProfileData } from "@/lib/social/types";
import { BarChart, Legend, LineChart, Segmented } from "./charts";
import { NetworkBadge, NetworkIcon } from "./icons";
import { PageHeader, PostImage, StatCard, Trend } from "./ui";
import { useSocial } from "./use-social";

type BarMetric = "views" | "interactions" | "engagement" | "followers";

const BAR_METRICS: { value: BarMetric; label: string; format: (n: number) => string }[] = [
  { value: "views", label: "Visualizaciones", format: formatCompact },
  { value: "interactions", label: "Interacciones", format: formatCompact },
  { value: "engagement", label: "Tasa %", format: (n) => formatPct(n) },
  { value: "followers", label: "Seguidores", format: formatCompact },
];

export function MetricsView() {
  const { posts, profile, profileId, update } = useSocial();
  const [lineMode, setLineMode] = useState<"total" | "network">("total");
  const [barMetric, setBarMetric] = useState<BarMetric>("views");
  const [editing, setEditing] = useState(false);

  const s = useMemo(() => computeSummary(posts, profile), [posts, profile]);
  const labels = s.series.map((p) => formatShortDate(p.date));
  const metric = BAR_METRICS.find((m) => m.value === barMetric)!;

  const lineSeries =
    lineMode === "total"
      ? [{ key: "total", label: "Seguidores", color: "#a894ff", values: s.series.map((p) => NETWORKS.reduce((t, n) => t + p[n], 0)) }]
      : NETWORKS.map((n) => ({
          key: n,
          label: NETWORK_META[n].label,
          color: NETWORK_META[n].color,
          values: s.series.map((p) => ((p[n] - s.series[0][n]) / (s.series[0][n] || 1)) * 100),
        }));

  return (
    <div>
      <PageHeader
        eyebrow="Rendimiento"
        title="Métricas"
        description="Tus números de Instagram y TikTok de un vistazo."
        actions={
          <Button variant="outline" className="border-white/10" onClick={() => setEditing(true)}>
            <Pencil /> Mis números
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Seguidores totales"
          icon={Users}
          value={s.followers.value}
          format={formatNumber}
          change={s.followers.change}
          changeLabel="últimos 30 días"
          accent="#a894ff"
        />
        <StatCard
          index={1}
          label="Interacción promedio"
          icon={Sparkles}
          value={s.engagement.value}
          format={(n) => formatPct(n)}
          change={s.engagement.change}
          changeSuffix=" pts"
          changeLabel="vs. mes anterior"
          accent="#db2777"
        />
        <StatCard
          index={2}
          label="Visualizaciones del mes"
          icon={Eye}
          value={s.views.value}
          format={formatCompact}
          change={s.views.change}
          changeLabel="vs. mes anterior"
          accent="#0891b2"
        />
        <StatCard
          index={3}
          label="Mejor post de la semana"
          icon={Trophy}
          value={s.bestWeek?.post.data.metrics.views ?? 0}
          format={(n) => `${formatCompact(n)}`}
          change={s.bestWeek ? s.bestWeek.change : undefined}
          changeLabel="vs. el mejor anterior"
          accent="#ea580c"
          footer={
            s.bestWeek ? (
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/[0.06]">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                  <PostImage src={s.bestWeek.post.data.imageUrl} alt="" className="h-full w-full" />
                </div>
                <p className="line-clamp-2 flex-1 text-xs font-medium">{s.bestWeek.post.data.title}</p>
                <NetworkBadge network={s.bestWeek.post.data.network} size="sm" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin posts publicados esta semana.</p>
            )
          }
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <section className="surface min-w-0 p-5 motion-safe:animate-rise-in sm:p-6 xl:col-span-3" style={{ animationDelay: "240ms" }}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">Crecimiento · últimos 30 días</h2>
              <p className="text-xs text-muted-foreground">
                {lineMode === "total" ? "Seguidores sumando Instagram y TikTok" : "Crecimiento % de cada red desde hace 30 días"}
              </p>
            </div>
            <Segmented
              value={lineMode}
              onChange={setLineMode}
              options={[
                { value: "total", label: "Total" },
                { value: "network", label: "Por red" },
              ]}
            />
          </div>
          {lineMode === "network" && (
            <div className="mb-3">
              <Legend items={NETWORKS.map((n) => ({ label: NETWORK_META[n].label, color: NETWORK_META[n].color }))} />
            </div>
          )}
          <LineChart
            key={lineMode}
            area={lineMode === "total"}
            height={280}
            labels={labels}
            series={lineSeries}
            formatValue={lineMode === "total" ? formatNumber : (n) => `${n >= 0 ? "+" : ""}${formatPct(n)}`}
            formatTick={lineMode === "total" ? formatCompact : (n) => formatPct(n, 0)}
          />
        </section>

        <section className="surface min-w-0 p-5 motion-safe:animate-rise-in sm:p-6 xl:col-span-2" style={{ animationDelay: "320ms" }}>
          <div className="mb-5 flex flex-col gap-3">
            <div>
              <h2 className="font-semibold">Instagram vs. TikTok</h2>
              <p className="text-xs text-muted-foreground">Rendimiento de los últimos 30 días</p>
            </div>
            <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
              <Segmented value={barMetric} onChange={setBarMetric} options={BAR_METRICS} />
            </div>
          </div>
          <BarChart
            animationKey={barMetric}
            height={262}
            formatValue={metric.format}
            bars={s.byNetwork.map((n) => ({
              key: n.network,
              name: NETWORK_META[n.network].label,
              color: NETWORK_META[n.network].color,
              value: n[barMetric],
              label: (
                <span className="flex items-center gap-1.5">
                  <NetworkIcon network={n.network} className="h-3.5 w-3.5" />
                  {NETWORK_META[n.network].label}
                </span>
              ),
            }))}
          />
        </section>
      </div>

      {/* Per network */}
      <div className="mt-4 grid gap-3 sm:gap-4 md:grid-cols-2">
        {s.byNetwork.map((n, i) => (
          <div key={n.network} className="surface p-5 motion-safe:animate-rise-in sm:p-6" style={{ animationDelay: `${400 + i * 80}ms` }}>
            <div className="flex items-center gap-3">
              <NetworkBadge network={n.network} />
              <div>
                <p className="font-semibold">{NETWORK_META[n.network].label}</p>
                <p className="text-xs text-muted-foreground">@{profile.handle}</p>
              </div>
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{formatNumber(n.followers)}</p>
            <div className="mt-2">
              <Trend change={n.followersChange} label="seguidores en 30 días" />
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center">
              <MiniStat label="Posts" value={String(n.posts)} />
              <MiniStat label="Vistas" value={formatCompact(n.views)} />
              <MiniStat label="Interac." value={formatPct(n.engagement)} />
            </dl>
          </div>
        ))}
      </div>

      <details className="surface mt-4 p-5 text-sm sm:p-6">
        <summary className="cursor-pointer font-medium text-muted-foreground">Ver los números en tabla</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Red</th>
                <th className="py-2 font-medium">Seguidores</th>
                <th className="py-2 font-medium">Posts (30 d)</th>
                <th className="py-2 font-medium">Visualizaciones</th>
                <th className="py-2 font-medium">Interacciones</th>
                <th className="py-2 font-medium">Interacción %</th>
              </tr>
            </thead>
            <tbody>
              {s.byNetwork.map((n) => (
                <tr key={n.network} className="border-t border-white/[0.06]">
                  <td className="py-2.5 font-medium">{NETWORK_META[n.network].label}</td>
                  <td>{formatNumber(n.followers)}</td>
                  <td>{n.posts}</td>
                  <td>{formatNumber(n.views)}</td>
                  <td>{formatNumber(n.interactions)}</td>
                  <td>{formatPct(n.engagement, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Visualizaciones e interacciones salen de los resultados que cargás en cada post publicado. La curva diaria de
        seguidores es una estimación anclada a tus números actuales (tocá «Mis números» para actualizarlos).
      </p>

      {editing && profileId && (
        <ProfileDialog
          profile={profile}
          onClose={() => setEditing(false)}
          onSave={async (p) => {
            if (await update<"PROFILE">(profileId, p)) {
              toast.success("Números actualizados");
              setEditing(false);
            }
          }}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function ProfileDialog({
  profile,
  onClose,
  onSave,
}: {
  profile: ProfileData;
  onClose: () => void;
  onSave: (p: ProfileData) => void;
}) {
  const [draft, setDraft] = useState(profile);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mis números</DialogTitle>
          <DialogDescription>Actualizá tu usuario y tus seguidores actuales en cada red.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Usuario</span>
            <Input
              className="text-base sm:text-sm"
              value={draft.handle}
              onChange={(e) => setDraft({ ...draft, handle: e.target.value.replace(/^@/, "") })}
            />
          </label>
          {NETWORKS.map((n) => (
            <label key={n} className="flex items-center gap-3">
              <NetworkBadge network={n} />
              <span className="w-20 text-sm">{NETWORK_META[n].label}</span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                className="text-base tabular-nums sm:text-sm"
                value={draft.followers[n]}
                onChange={(e) =>
                  setDraft({ ...draft, followers: { ...draft.followers, [n]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })
                }
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="gradient" onClick={() => onSave(draft)}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
