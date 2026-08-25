import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ProjectRedirectPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: { scenes: true, generations: { orderBy: { startedAt: "desc" }, take: 1 }, videos: { take: 1 } },
  });

  if (!project) redirect("/videos");

  const activeGeneration = project.generations[0];
  if (activeGeneration && !["COMPLETED", "FAILED", "CANCELLED"].includes(activeGeneration.stage)) {
    redirect(`/projects/${project.id}/generate?generationId=${activeGeneration.id}`);
  }

  if (project.status === "COMPLETED" && project.videos[0]) {
    redirect(`/editor/${project.videos[0].id}`);
  }

  if (project.scenes.length > 0) {
    redirect(`/projects/${project.id}/storyboard`);
  }

  redirect(`/projects/${project.id}/script`);
}
