import Link from "next/link";
import { Sparkles } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 sm:p-12">
        <Link href="/" className="flex w-fit items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          {APP_CONFIG.name}
        </Link>

        <div className="mx-auto w-full max-w-sm">{children}</div>

        <p className="text-center text-xs text-muted-foreground lg:text-left">
          © {new Date().getFullYear()} {APP_CONFIG.name}
        </p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-white/5 bg-gradient-to-br from-brand-900/40 via-background to-background lg:block">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_40%,transparent_100%)]" />
        <div className="flex h-full flex-col items-center justify-center gap-6 p-12 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
            <p className="text-balance text-lg font-medium">
              "{APP_CONFIG.tagline}"
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{APP_CONFIG.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[9/16] w-20 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-900/40 ring-1 ring-white/10" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
