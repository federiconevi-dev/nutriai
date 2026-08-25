import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { TemplatesGallery } from "@/components/templates/templates-gallery";
import { Sparkles } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  const templates = await db.template.findMany({ orderBy: [{ featured: "desc" }, { createdAt: "desc" }] });

  return (
    <div className="flex min-h-screen flex-col">
      {session?.user ? (
        <header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/5 bg-background/80 px-6 backdrop-blur-lg">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </span>
            {APP_CONFIG.name}
          </Link>
          <span className="ml-4 text-sm text-muted-foreground">← Back to dashboard</span>
        </header>
      ) : (
        <Navbar />
      )}

      <main className="flex-1">
        <div className="container py-16">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Templates</h1>
            <p className="mt-4 text-muted-foreground">
              Start from a proven format and customize it with your own product, script and branding.
            </p>
          </div>
          <TemplatesGallery
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              category: t.category,
              previewUrl: t.previewUrl,
              aspectRatio: t.aspectRatio,
              duration: t.duration,
              featured: t.featured,
            }))}
            isAuthenticated={!!session?.user}
          />
        </div>
      </main>

      {!session?.user && <Footer />}
    </div>
  );
}
