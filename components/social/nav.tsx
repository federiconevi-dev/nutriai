"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, FileText, GalleryHorizontalEnd, Gauge, Lightbulb } from "lucide-react";
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
    <nav className="no-scrollbar -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
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
