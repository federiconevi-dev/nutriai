import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
