import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceGeneration } from "@/lib/jobs/pipeline";

// Each poll can perform one unit of pipeline work (e.g. generating one
// scene's clip), which can take a few seconds - give it headroom on hosts
// that support configurable function duration (Vercel Hobby/Pro).
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await db.generation.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Generation not found" }, { status: 404 });

  // Drive the pipeline forward on every poll - see lib/jobs/pipeline.ts for
  // why this replaces a fire-and-forget background task.
  await advanceGeneration(params.id).catch((err) => {
    console.error(`[generations] advance failed for ${params.id}:`, err);
  });

  const generation = await db.generation.findFirst({
    where: { id: params.id, project: { userId: session.user.id } },
    include: { project: { include: { videos: { orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  if (!generation) return NextResponse.json({ error: "Generation not found" }, { status: 404 });

  return NextResponse.json({
    generation: {
      ...generation,
      logs: generation.logs ? JSON.parse(generation.logs) : [],
    },
    video: generation.project.videos[0] ?? null,
  });
}
