import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scene = await db.videoScene.findFirst({
    where: { id: params.sceneId, projectId: params.id, project: { userId: session.user.id } },
  });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const scenesAfter = await db.videoScene.findMany({
    where: { projectId: params.id, order: { gt: scene.order } },
  });
  await db.$transaction(
    scenesAfter.map((s) => db.videoScene.update({ where: { id: s.id }, data: { order: s.order + 1 } }))
  );

  const duplicated = await db.videoScene.create({
    data: {
      projectId: scene.projectId,
      order: scene.order + 1,
      startSec: scene.startSec,
      endSec: scene.endSec,
      visualText: scene.visualText,
      voiceText: scene.voiceText,
      prompt: scene.prompt,
      imageUrl: scene.imageUrl,
      videoUrl: scene.videoUrl,
      audioUrl: scene.audioUrl,
      musicId: scene.musicId,
    },
  });

  return NextResponse.json({ scene: duplicated });
}
