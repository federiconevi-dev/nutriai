"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/videos", label: "Videos" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 rounded-xl bg-secondary p-1 w-fit">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            pathname === l.href ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
