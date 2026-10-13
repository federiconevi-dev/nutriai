"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wand2,
  Clapperboard,
  LayoutTemplate,
  ImageIcon,
  Palette,
  Coins,
  Settings,
  Sparkles,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Video", icon: Wand2 },
  { href: "/videos", label: "My Videos", icon: Clapperboard },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
  { href: "/credits", label: "Credits", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  isAdmin,
  isDemoMode,
  mobileOpen,
  onClose,
}: {
  isAdmin?: boolean;
  isDemoMode?: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-white/5 bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen && "translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            {APP_CONFIG.name}
          </Link>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-500/15 text-brand-300"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-amber-500/15 text-amber-300"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin panel
            </Link>
          )}
        </nav>

        {isDemoMode && (
          <div className="border-t border-white/5 p-4">
            <div className="rounded-xl bg-gradient-to-br from-brand-500/15 to-transparent p-4">
              <p className="text-xs font-medium text-brand-300">Demo mode</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generations use simulated AI providers until you add real API keys.
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
