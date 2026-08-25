import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await db.video.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { project: { include: { scenes: { orderBy: { order: "asc" } } } } },
  });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
  return NextResponse.json({ video });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await db.video.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const allowed = ["title", "captionsStyle", "musicId", "voiceGender", "voiceStyle", "voiceSpeed"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const updated = await db.video.update({ where: { id: video.id }, data });
  return NextResponse.json({ video: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await db.video.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  await db.video.delete({ where: { id: video.id } });
  return NextResponse.json({ success: true });
}
