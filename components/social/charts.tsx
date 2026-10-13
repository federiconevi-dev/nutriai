"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Rounded, readable tick steps (1, 2, 2.5, 5 × 10^n). */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export type LineSeries = { key: string; label: string; color: string; values: number[] };

export function LineChart({
  series,
  labels,
  height = 260,
  formatValue,
  formatTick = formatValue,
  area = false,
  className,
}: {
  series: LineSeries[];
  labels: string[];
  height?: number;
  formatValue: (n: number) => string;
  formatTick?: (n: number) => string;
  area?: boolean;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const multi = series.length > 1;
  const pad = { top: 16, right: multi ? 84 : 16, bottom: 28, left: 52 };
  const n = labels.length;

  const { ticks, x, y } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const ticks = niceTicks(Math.min(...all), Math.max(...all));
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const innerW = Math.max(1, width - pad.left - pad.right);
    const innerH = height - pad.top - pad.bottom;
    return {
      ticks,
      x: (i: number) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW),
      y: (v: number) => pad.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH,
    };
  }, [series, width, height, n, pad.left, pad.right, pad.top, pad.bottom]);

  // Direct labels at the end of each line, nudged apart so they never overlap.
  const endLabels = useMemo(() => {
    if (!multi || !width) return [];
    const items = series.map((s) => ({ s, y: y(s.values[s.values.length - 1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 16) items[i].y = items[i - 1].y + 16;
    }
    return items;
  }, [multi, series, width, y]);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const innerW = rect.width;
    const i = Math.round((px / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const tickEvery = Math.ceil(n / (width < 480 ? 4 : 7));

  return (
    <div ref={ref} className={cn("relative w-full min-w-0", className)} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0 overflow-visible" role="img" aria-label="Gráfico de líneas">
          {area && !multi && (
            <defs>
              <linearGradient id={`area-${series[0].key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={series[0].color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={series[0].color} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
              <text x={pad.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {formatTick(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % tickEvery === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} className="fill-muted-foreground text-[11px]">
                {l}
              </text>
            ) : null
          )}
          {series.map((s) => {
            const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
            return (
              <g key={s.key}>
                {area && !multi && (
                  <path
                    d={`${d}L${x(n - 1)},${height - pad.bottom}L${x(0)},${height - pad.bottom}Z`}
                    fill={`url(#area-${s.key})`}
                    className="chart-fade"
                  />
                )}
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={1}
                  className="chart-draw"
                  style={{ ["--len" as string]: 1 }}
                />
              </g>
            );
          })}
          {endLabels.map(({ s, y: ly }) => (
            <g key={s.key} className="chart-fade">
              <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={4} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />
              <text x={width - pad.right + 10} y={ly} dy="0.32em" className="fill-foreground text-[11px] font-medium">
                {s.label}
              </text>
            </g>
          ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={height - pad.bottom} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={5} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={Math.max(1, width - pad.left - pad.right)}
            height={height - pad.top - pad.bottom}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            style={{ touchAction: "pan-y" }}
          />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-xl border border-white/10 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{
            left: Math.min(Math.max(x(hover) - 75, 0), width - 160),
          }}
        >
          <p className="mb-1 font-medium text-muted-foreground">{labels[hover]}</p>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums">{formatValue(s.values[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type Bar = { key: string; label: React.ReactNode; name: string; value: number; color: string };

/** Vertical bars on one shared axis; animated grow on mount and on metric change. */
export function BarChart({
  bars,
  height = 260,
  formatValue,
  animationKey,
}: {
  bars: Bar[];
  height?: number;
  formatValue: (n: number) => string;
  animationKey?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const pad = { top: 28, right: 8, bottom: 44, left: 8 };
  const max = Math.max(...bars.map((b) => b.value), 1);
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / bars.length;
  const barW = Math.min(88, slot * 0.52);

  return (
    <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0" role="img" aria-label="Gráfico de barras" key={animationKey}>
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="rgba(255,255,255,0.12)" />
          {bars.map((b, i) => {
            const h = Math.max(2, (b.value / max) * innerH);
            const bx = pad.left + slot * i + (slot - barW) / 2;
            const by = pad.top + innerH - h;
            const r = Math.min(4, barW / 2, h);
            const path = `M${bx},${pad.top + innerH}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + barW - r}Q${bx + barW},${by} ${bx + barW},${by + r}V${pad.top + innerH}Z`;
            const dim = hover !== null && hover !== b.key;
            return (
              <g
                key={b.key}
                onPointerEnter={() => setHover(b.key)}
                onPointerLeave={() => setHover(null)}
                onPointerDown={() => setHover(b.key)}
              >
                <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent" />
                <path
                  d={path}
                  fill={b.color}
                  className="chart-grow transition-opacity"
                  style={{ animationDelay: `${i * 110}ms`, opacity: dim ? 0.45 : 1 }}
                />
                <text
                  x={bx + barW / 2}
                  y={by - 8}
                  textAnchor="middle"
                  className="chart-fade fill-foreground text-[12px] font-semibold tabular-nums"
                  style={{ animationDelay: `${300 + i * 110}ms` }}
                >
                  {formatValue(b.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 flex" style={{ paddingLeft: pad.left, paddingRight: pad.right }}>
        {bars.map((b) => (
          <div key={b.key} className="flex flex-1 justify-center pb-1 text-xs font-medium text-muted-foreground">
            {b.label}
          </div>
        ))}
      </div>
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-xl border border-white/10 bg-popover/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur">
          {bars.find((b) => b.key === hover)?.name}:{" "}
          <span className="font-semibold tabular-nums">{formatValue(bars.find((b) => b.key === hover)!.value)}</span>
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/[0.07]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            value === o.value ? "bg-white/[0.12] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
