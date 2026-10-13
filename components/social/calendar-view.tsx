"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WEEKDAYS_SHORT, dayKey, formatMonth, monthGrid, sameDay } from "@/lib/social/dates";
import { NETWORK_META, type SocialItem } from "@/lib/social/types";
import { NetworkBadge } from "./icons";
import { PostEditorSheet } from "./post-editor";
import { PageHeader, PostImage } from "./ui";
import { useSocial } from "./use-social";

export function CalendarView() {
  const { posts } = useSocial();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);
  const [initialPostId, setInitialPostId] = useState<string | "new" | null>(null);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const byDay = useMemo(() => {
    const map = new Map<string, SocialItem<"POST">[]>();
    for (const p of posts) {
      const k = dayKey(new Date(p.data.scheduledAt));
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.data.scheduledAt) - +new Date(b.data.scheduledAt));
    return map;
  }, [posts]);

  const monthPosts = posts.filter((p) => {
    const d = new Date(p.data.scheduledAt);
    return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
  });

  function shift(n: 1 | -1) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  }

  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function open(day: Date, postId: string | "new" | null = null) {
    setSelected(day);
    setInitialPostId(postId);
  }

  const selectedPosts = selected ? byDay.get(dayKey(selected)) ?? [] : [];

  return (
    <div>
      <PageHeader
        eyebrow="Calendario de contenido"
        title={formatMonth(cursor)}
        description={`${monthPosts.length} publicaciones este mes · tocá un día para crear o editar`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-10 border-white/10 px-4" onClick={goToday}>
              Hoy
            </Button>
            <div className="flex rounded-xl ring-1 ring-white/10">
              <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Mes anterior">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Mes siguiente">
                <ChevronRight />
              </Button>
            </div>
            <Button variant="gradient" onClick={() => open(today, "new")}>
              <Plus /> <span className="hidden sm:inline">Nuevo post</span>
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] ring-2 ring-emerald-400/80" /> Día completo (todo listo o publicado)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] ring-1 ring-white/20" /> Con borradores
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-brand-500" /> Hoy
        </span>
      </div>

      <div className="surface overflow-hidden p-1.5 sm:p-2">
        <div className="grid grid-cols-7">
          {WEEKDAYS_SHORT.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div
          key={cursor.toISOString()}
          className={cn(
            "grid grid-cols-7 grid-rows-6 gap-1 motion-safe:animate-fade-in sm:gap-1.5",
            "lg:h-[calc(100dvh-19rem)] lg:min-h-[640px]"
          )}
        >
          {days.map((day) => {
            const list = byDay.get(dayKey(day)) ?? [];
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, today);
            const complete = list.length > 0 && list.every((p) => p.data.status !== "draft");
            const empty = list.length === 0;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => open(day)}
                className={cn(
                  "group relative flex min-h-[64px] flex-col overflow-hidden rounded-xl p-1 text-left transition-all sm:min-h-[110px] sm:rounded-2xl lg:min-h-0 sm:p-2",
                  empty ? "bg-white/[0.012] hover:bg-white/[0.04]" : "bg-white/[0.045] hover:bg-white/[0.07]",
                  !inMonth && "opacity-35",
                  complete && "ring-2 ring-inset ring-emerald-400/70",
                  !complete && !empty && "ring-1 ring-inset ring-white/10",
                  isToday && !complete && "ring-2 ring-inset ring-brand-400/80",
                  isToday && "bg-brand-500/[0.08]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums sm:h-7 sm:min-w-7 sm:text-[13px]",
                      isToday ? "bg-brand-500 text-white shadow-lg shadow-brand-500/40" : empty ? "text-muted-foreground/60" : "text-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <Plus className="hidden h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </div>

                {/* Phones: colored dots per post */}
                {list.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((p) => (
                      <span key={p.id} className="h-1.5 w-1.5 rounded-full" style={{ background: NETWORK_META[p.data.network].color }} />
                    ))}
                  </div>
                )}

                {/* Larger screens: thumbnail + network icon */}
                <div className="mt-1.5 hidden min-h-0 flex-1 flex-col gap-1 sm:flex">
                  {list.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        open(day, p.id);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg bg-black/25 p-1 ring-1 ring-white/[0.06] transition-colors hover:bg-black/40",
                        p.data.status === "draft" && "opacity-75"
                      )}
                    >
                      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
                        <PostImage src={p.data.imageUrl} alt="" className="h-full w-full" />
                      </div>
                      <span className="hidden min-w-0 flex-1 truncate text-[11px] font-medium xl:block">{p.data.title}</span>
                      <NetworkBadge network={p.data.network} size="sm" className="ml-auto h-4 w-4 ring-0 [&_svg]:h-2.5 [&_svg]:w-2.5" />
                    </div>
                  ))}
                  {list.length > 3 && <span className="px-1 text-[11px] font-medium text-muted-foreground">+{list.length - 3} más</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <PostEditorSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        date={selected}
        dayPosts={selectedPosts}
        initialPostId={initialPostId}
      />
    </div>
  );
}
