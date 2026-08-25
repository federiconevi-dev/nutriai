import Link from "next/link";
import { ArrowRight, Play, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/lib/config";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-20 md:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-pattern [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)] opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[120px]" />

      <div className="container">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            AI video generation, reimagined
          </div>

          <h1 className="animate-fade-in-up text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {APP_CONFIG.tagline}
          </h1>

          <p className="mt-6 max-w-xl animate-fade-in-up text-balance text-lg text-muted-foreground [animation-delay:100ms]">
            {APP_CONFIG.description}
          </p>

          <div className="mt-10 flex animate-fade-in-up flex-col gap-3 sm:flex-row [animation-delay:200ms]">
            <Button size="lg" variant="gradient" asChild>
              <Link href="/register">
                Create video <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/templates">
                <Play className="h-4 w-4" /> Explore templates
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · 100 free credits · Demo mode available
          </p>
        </div>

        <AppPreview />
      </div>
    </section>
  );
}

function AppPreview() {
  return (
    <div className="relative mx-auto mt-20 max-w-5xl animate-fade-in-up [animation-delay:300ms]">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-xs text-muted-foreground">
            <Wand2 className="h-3 w-3" /> app.videora.ai/create
          </div>
        </div>
        <div className="grid gap-px bg-white/5 p-px md:grid-cols-[280px_1fr]">
          <div className="space-y-3 bg-card p-5">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="space-y-2">
              {["Product Ad", "TikTok", "Instagram Reel", "UGC"].map((t, i) => (
                <div
                  key={t}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    i === 0 ? "bg-brand-500/15 text-brand-300" : "text-muted-foreground"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> {t}
                </div>
              ))}
            </div>
            <div className="mt-6 h-24 rounded-xl border border-dashed border-white/10 bg-white/[0.02]" />
          </div>
          <div className="space-y-4 bg-card p-6">
            <div className="h-4 w-1/3 rounded bg-white/10" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-[9/16] rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-900/40 ring-1 ring-white/5" />
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-brand-500/20" />
              <div className="flex-1 space-y-2">
                <div className="h-2 w-full rounded bg-white/10" />
                <div className="h-2 w-2/3 rounded bg-white/10" />
              </div>
              <span className="text-xs font-medium text-brand-300">86%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
