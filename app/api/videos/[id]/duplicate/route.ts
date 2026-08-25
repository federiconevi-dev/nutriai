import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await db.video.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const duplicated = await db.video.create({
    data: {
      projectId: video.projectId,
      userId: video.userId,
      title: `${video.title} (copy)`,
      description: video.description,
      status: video.status,
      duration: video.duration,
      aspectRatio: video.aspectRatio,
      thumbnail: video.thumbnail,
      videoUrl: video.videoUrl,
      captionsStyle: video.captionsStyle,
      musicId: video.musicId,
      voiceGender: video.voiceGender,
      voiceStyle: video.voiceStyle,
      voiceSpeed: video.voiceSpeed,
    },
  });

  return NextResponse.json({ video: duplicated });
}
