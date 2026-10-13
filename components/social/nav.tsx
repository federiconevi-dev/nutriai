"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BarChart3, CalendarDays, FileText, GalleryHorizontalEnd, Gauge, Lightbulb, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const SOCIAL_NAV = [
  { href: "/social", label: "Panel", icon: Gauge },
  { href: "/social/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/social/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/social/metricas", label: "Métricas", icon: BarChart3 },
  { href: "/social/guiones", label: "Guiones IA", icon: FileText },
  { href: "/social/carruseles", label: "Carruseles IA", icon: GalleryHorizontalEnd },
];

export function isSocialActive(pathname: string, href: string) {
  return href === "/social" ? pathname === "/social" : pathname.startsWith(href);
}

/** Section tabs; scroll horizontally on phones. */
export function SocialTabs() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {SOCIAL_NAV.map((item) => {
        const active = isSocialActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              active
                ? "bg-white text-zinc-900 shadow-lg shadow-white/10"
                : "bg-white/[0.04] text-muted-foreground ring-1 ring-white/[0.07] hover:bg-white/[0.08] hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SocialHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/social" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-brand-600 shadow-lg shadow-brand-600/30">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          Estudio Social
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted-foreground ring-1 ring-white/10 transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </div>
    </header>
  );
}
