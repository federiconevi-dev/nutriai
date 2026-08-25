import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { VideosGrid } from "@/components/videos/videos-grid";

export default async function VideosPage() {
  const user = await requireUser();

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { videos: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const items = projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    duration: p.duration,
    aspectRatio: p.aspectRatio,
    updatedAt: p.updatedAt.toISOString(),
    thumbnail: p.thumbnail,
    videoId: p.videos[0]?.id ?? null,
    videoUrl: p.videos[0]?.videoUrl ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">All your projects, drafts and finished videos in one place.</p>
      </div>
      <VideosGrid items={items} />
    </div>
  );
}
