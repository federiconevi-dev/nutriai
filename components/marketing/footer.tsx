import Link from "next/link";
import { Sparkles } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          {APP_CONFIG.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.
        </p>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <Link href="/templates" className="hover:text-foreground">Templates</Link>
          <Link href="/login" className="hover:text-foreground">Log in</Link>
          <Link href="/register" className="hover:text-foreground">Sign up</Link>
        </div>
      </div>
    </footer>
  );
}
