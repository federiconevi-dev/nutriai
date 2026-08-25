import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { scenes: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const duplicated = await db.project.create({
    data: {
      userId: project.userId,
      title: `${project.title} (copy)`,
      prompt: project.prompt,
      videoType: project.videoType,
      style: project.style,
      aspectRatio: project.aspectRatio,
      duration: project.duration,
      language: project.language,
      status: "DRAFT",
      script: project.script,
      scenes: {
        create: project.scenes.map((s) => ({
          order: s.order,
          startSec: s.startSec,
          endSec: s.endSec,
          visualText: s.visualText,
          voiceText: s.voiceText,
          prompt: s.prompt,
          imageUrl: s.imageUrl,
          videoUrl: s.videoUrl,
          audioUrl: s.audioUrl,
          musicId: s.musicId,
        })),
      },
    },
  });

  return NextResponse.json({ project: duplicated });
}
