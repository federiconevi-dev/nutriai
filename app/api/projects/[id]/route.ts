import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      generations: { orderBy: { startedAt: "desc" }, take: 1 },
      videos: { orderBy: { createdAt: "desc" }, take: 1 },
      assets: { include: { asset: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const allowed = ["title", "prompt", "videoType", "style", "aspectRatio", "duration", "language"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const updated = await db.project.update({ where: { id: project.id }, data });
  return NextResponse.json({ project: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await db.project.delete({ where: { id: project.id } });
  return NextResponse.json({ success: true });
}
