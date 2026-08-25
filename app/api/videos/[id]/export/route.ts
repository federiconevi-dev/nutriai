import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  quality: z.enum(["720p", "1080p"]),
  format: z.literal("mp4").default("mp4"),
  aspectRatio: z.enum(["RATIO_9_16", "RATIO_16_9", "RATIO_1_1"]),
});

/**
 * Simulates the export/render pipeline (composition of scenes + captions +
 * music via FFmpeg happens here in production). In demo mode this just marks
 * the video as exported and returns its existing demo clip URL to download.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await db.video.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid export options" }, { status: 400 });

  // Simulate rendering time.
  await new Promise((r) => setTimeout(r, 1200));

  const updated = await db.video.update({
    where: { id: video.id },
    data: {
      exportedAt: new Date(),
      exportQuality: parsed.data.quality,
      aspectRatio: parsed.data.aspectRatio,
    },
  });

  return NextResponse.json({ video: updated, downloadUrl: video.videoUrl });
}
