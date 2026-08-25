import Link from "next/link";
import Image from "next/image";
import { Type, ShoppingBag, ImageIcon, UserCircle2, Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { getDashboardContext } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, aspectRatioToClass } from "@/lib/utils";
import { pickDemoThumbnail } from "@/lib/demo/media";

const quickActions = [
  { type: "TEXT_TO_VIDEO", label: "Text to Video", description: "Start from a written idea", icon: Type },
  { type: "PRODUCT_AD", label: "Product Video", description: "Turn product photos into ads", icon: ShoppingBag },
  { type: "IMAGE_TO_VIDEO", label: "Image to Video", description: "Animate an existing image", icon: ImageIcon },
  { type: "UGC", label: "UGC Ad", description: "Authentic creator-style content", icon: UserCircle2 },
  { type: "AVATAR", label: "AI Avatar", description: "A presenter narrates for you", icon: Sparkles },
  { type: "RECREATE", label: "Recreate Video", description: "Remix a video you already have", icon: RefreshCw },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const statusVariant: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  DRAFT: "secondary",
  GENERATING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
};

export default async function DashboardPage() {
  const { user } = await getDashboardContext();
  const firstName = user.name?.split(" ")[0] ?? "there";

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">{greeting()}, {firstName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Create your next video</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {quickActions.map((action) => (
          <Link key={action.type} href={`/create?type=${action.type}`}>
            <Card className="group flex h-full flex-col items-start gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-900/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 transition-colors group-hover:bg-brand-500/20">
                <action.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{action.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent projects</h2>
          <Link href="/videos" className="flex items-center gap-1 text-sm text-brand-400 hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No projects yet"
            description="Start your first AI video project — it only takes a couple of minutes."
            action={
              <Link href="/create" className="text-sm font-medium text-brand-400 hover:underline">
                Create your first video →
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-brand-500/40">
                  <div className={`relative w-full overflow-hidden bg-secondary ${aspectRatioToClass(project.aspectRatio)}`}>
                    <Image
                      src={project.thumbnail || pickDemoThumbnail(project.id)}
                      alt={project.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-sm font-medium">{project.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatDate(project.updatedAt)}</span>
                      <Badge variant={statusVariant[project.status]}>{project.status}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
