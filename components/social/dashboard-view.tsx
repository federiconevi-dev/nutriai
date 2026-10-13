"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, Eye, Plus, Sparkles, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDays, formatCompact, formatNumber, formatPct, formatShortDate, sameDay, startOfDay, startOfWeek } from "@/lib/social/dates";
import { computeSummary, interactions } from "@/lib/social/metrics";
import { NETWORKS, NETWORK_META, POST_STATUSES, STATUS_META, type Network, type PostStatus, type SocialItem } from "@/lib/social/types";
import { LineChart } from "./charts";
import { NetworkBadge, NetworkIcon } from "./icons";
import { PostEditorSheet } from "./post-editor";
import { LoadingGrid, PageHeader, PostCard, PostImage, StatCard } from "./ui";
import { useSocial } from "./use-social";

export function DashboardView() {
  const { posts, profile, isLoading } = useSocial();
  const [network, setNetwork] = useState<Network | "all">("all");
  const [status, setStatus] = useState<PostStatus | "all">("all");
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [sheet, setSheet] = useState<{ date: Date; postId: string | "new" } | null>(null);

  const now = new Date();
  const summary = useMemo(() => computeSummary(posts, profile), [posts, profile]);

  const week = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = addDays(start, 7);
    const list = posts.filter((p) => {
      const d = new Date(p.data.scheduledAt);
      return d >= start && d < end;
    });
    const by = (s: PostStatus) => list.filter((p) => p.data.status === s).length;
    return { total: list.length, draft: by("draft"), ready: by("ready"), published: by("published") };
  }, [posts]);

  const visible = useMemo(() => {
    const today = startOfDay(new Date());
    return posts
      .filter((p) => network === "all" || p.data.network === network)
      .filter((p) => status === "all" || p.data.status === status)
      .filter((p) => scope === "all" || new Date(p.data.scheduledAt) >= today)
      .sort((a, b) =>
        scope === "upcoming"
          ? +new Date(a.data.scheduledAt) - +new Date(b.data.scheduledAt)
          : +new Date(b.data.scheduledAt) - +new Date(a.data.scheduledAt)
      );
  }, [posts, network, status, scope]);

  const openPost = (p: SocialItem<"POST">) => setSheet({ date: new Date(p.data.scheduledAt), postId: p.id });
  const sheetPosts = sheet ? posts.filter((p) => sameDay(new Date(p.data.scheduledAt), sheet.date)) : [];

  const greeting = now.getHours() < 12 ? "Buen día" : now.getHours() < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div>
      <PageHeader
        eyebrow={`${greeting} · @${profile.handle}`}
        title="Panel principal"
        description="Todo tu contenido de Instagram y TikTok en un solo lugar."
        actions={
          <Button variant="gradient" onClick={() => setSheet({ date: new Date(), postId: "new" })}>
            <Plus /> Nuevo post
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Posts esta semana"
          icon={CalendarCheck2}
          value={week.total}
          format={(n) => String(Math.round(n))}
          accent="#7c4dff"
          footer={
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {(["published", "ready", "draft"] as const).map((s) => (
                <span key={s} className={cn("rounded-full px-2 py-0.5 font-medium ring-1 ring-inset", STATUS_META[s].className)}>
                  {week[s]} {STATUS_META[s].label.toLowerCase()}
                </span>
              ))}
            </div>
          }
        />
        <StatCard
          index={1}
          label="Seguidores totales"
          icon={Users}
          value={summary.followers.value}
          format={formatNumber}
          change={summary.followers.change}
          changeLabel="en 30 días"
          accent="#db2777"
        />
        <StatCard
          index={2}
          label="Visualizaciones (30 días)"
          icon={Eye}
          value={summary.views.value}
          format={formatCompact}
          change={summary.views.change}
          changeLabel="vs. mes anterior"
          accent="#0891b2"
        />
        <StatCard
          index={3}
          label="Interacción promedio"
          icon={Sparkles}
          value={summary.engagement.value}
          format={(n) => formatPct(n)}
          change={summary.engagement.change}
          changeSuffix=" pts"
          changeLabel="vs. mes anterior"
          accent="#ea580c"
        />
      </div>

      {/* Growth + best posts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="surface min-w-0 p-5 motion-safe:animate-rise-in sm:p-6 lg:col-span-3" style={{ animationDelay: "200ms" }}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Crecimiento de seguidores</h2>
              <p className="text-xs text-muted-foreground">Instagram + TikTok · últimos 30 días</p>
            </div>
            <Link href="/social/metricas" className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
              Ver métricas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <LineChart
            area
            height={240}
            labels={summary.series.map((p) => formatShortDate(p.date))}
            series={[
              {
                key: "total",
                label: "Seguidores",
                color: "#a894ff",
                values: summary.series.map((p) => NETWORKS.reduce((s, n) => s + p[n], 0)),
              },
            ]}
            formatValue={formatNumber}
            formatTick={formatCompact}
          />
        </section>

        <section className="surface min-w-0 p-5 motion-safe:animate-rise-in sm:p-6 lg:col-span-2" style={{ animationDelay: "280ms" }}>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            <h2 className="font-semibold">Los mejores del mes</h2>
          </div>
          {summary.topPosts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Cuando marques posts como publicados con sus resultados, vas a ver acá los mejores.
            </p>
          ) : (
            <ol className="space-y-3">
              {summary.topPosts.map((p, i) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSheet({ date: p.at, postId: p.id })}
                    className="flex w-full items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="w-5 text-center text-lg font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                      <PostImage src={p.data.imageUrl} alt={p.data.title} className="h-full w-full" />
                      <NetworkBadge network={p.data.network} size="sm" className="absolute bottom-1 right-1" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.data.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{formatCompact(p.data.metrics.views)}</span> vistas ·{" "}
                        {formatCompact(interactions(p.data.metrics))} interacciones
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Posts */}
      <section className="mt-10">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{scope === "upcoming" ? "Próximas publicaciones" : "Todas las publicaciones"}</h2>
            <p className="text-xs text-muted-foreground">{visible.length} posts</p>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            <Chip active={scope === "upcoming"} onClick={() => setScope("upcoming")}>Próximos</Chip>
            <Chip active={scope === "all"} onClick={() => setScope("all")}>Todos</Chip>
            <span className="mx-1 w-px shrink-0 bg-white/10" />
            <Chip active={network === "all"} onClick={() => setNetwork("all")}>Todas las redes</Chip>
            {NETWORKS.map((n) => (
              <Chip key={n} active={network === n} onClick={() => setNetwork(n)}>
                <NetworkIcon network={n} className="h-3.5 w-3.5" />
                {NETWORK_META[n].label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-white/10" />
            <Chip active={status === "all"} onClick={() => setStatus("all")}>Todos los estados</Chip>
            {POST_STATUSES.map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {STATUS_META[s].label}
              </Chip>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingGrid />
        ) : visible.length === 0 ? (
          <div className="surface flex flex-col items-center px-6 py-16 text-center">
            <CalendarCheck2 className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">No hay posts con estos filtros</p>
            <p className="mt-1 text-sm text-muted-foreground">Creá uno nuevo o cambiá los filtros.</p>
            <Button variant="gradient" className="mt-5" onClick={() => setSheet({ date: new Date(), postId: "new" })}>
              <Plus /> Nuevo post
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {visible.map((p, i) => (
              <PostCard key={p.id} post={p} index={i} onClick={() => openPost(p)} />
            ))}
          </div>
        )}
      </section>

      <PostEditorSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        date={sheet?.date ?? null}
        dayPosts={sheetPosts}
        initialPostId={sheet?.postId}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
        active ? "bg-white/[0.14] text-foreground ring-1 ring-white/20" : "text-muted-foreground ring-1 ring-white/[0.07] hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
