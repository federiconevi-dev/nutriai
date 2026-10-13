"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ImageIcon, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPostDate } from "@/lib/social/dates";
import { STATUS_META, type PostData, type PostStatus, type SocialItem } from "@/lib/social/types";
import { NetworkBadge } from "./icons";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset backdrop-blur-md",
        meta.className,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function PostImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-brand-500/25 via-fuchsia-500/10 to-cyan-500/20", className)}>
        <ImageIcon className="h-6 w-6 text-white/40" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}

/** The main post card: image, network, title, scheduled date and status. */
export function PostCard({
  post,
  onClick,
  index = 0,
}: {
  post: SocialItem<"POST">;
  onClick?: () => void;
  index?: number;
}) {
  const d: PostData = post.data;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      className="surface surface-hover group flex w-full flex-col overflow-hidden text-left motion-safe:animate-rise-in"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <PostImage
          src={d.imageUrl}
          alt={d.title}
          className="h-full w-full transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
        <div className="absolute left-3 top-3">
          <NetworkBadge network={d.network} />
        </div>
        <div className="absolute right-3 top-3">
          <StatusBadge status={d.status} className="bg-black/40" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{d.title}</p>
          <p className="mt-1.5 text-xs font-medium capitalize text-white/70">{formatPostDate(d.scheduledAt)}</p>
        </div>
      </div>
    </button>
  );
}

/** Animated number that counts up from zero when it first renders. */
export function CountUp({
  value,
  format,
  duration = 1200,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(origin + (value - origin) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** Green arrow when it went up, red when it went down. */
export function Trend({ change, suffix = "%", label }: { change: number; suffix?: string; label?: string }) {
  const rounded = Math.round(change * 10) / 10;
  const up = rounded > 0;
  const flat = rounded === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
          flat ? "bg-white/10 text-muted-foreground" : up ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
        {up ? "+" : ""}
        {rounded.toLocaleString("es-AR")}
        {suffix}
        <span className="sr-only">{flat ? "sin cambios" : up ? "subió" : "bajó"}</span>
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}

export function StatCard({
  label,
  icon: Icon,
  value,
  format,
  change,
  changeSuffix,
  changeLabel,
  footer,
  accent,
  index = 0,
  className,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  format: (n: number) => string;
  change?: number;
  changeSuffix?: string;
  changeLabel?: string;
  footer?: React.ReactNode;
  accent: string;
  index?: number;
  className?: string;
}) {
  return (
    <div
      style={{ animationDelay: `${index * 80}ms` }}
      className={cn("surface overflow-clip p-5 motion-safe:animate-rise-in sm:p-6", className)}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-25 blur-3xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
          <Icon className="h-4 w-4 text-foreground/80" />
        </span>
      </div>
      <p className="relative mt-4 text-4xl font-semibold tracking-tight tabular-nums sm:text-[2.75rem] sm:leading-none">
        <CountUp value={value} format={format} />
      </p>
      <div className="relative mt-4 min-h-[22px]">
        {change !== undefined && <Trend change={change} suffix={changeSuffix} label={changeLabel} />}
      </div>
      {footer && <div className="relative mt-3">{footer}</div>}
    </div>
  );
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface aspect-[4/5] animate-pulse" />
      ))}
    </div>
  );
}
