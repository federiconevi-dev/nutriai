import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ sceneIds: z.array(z.string()).min(1) });

/** Reorders scenes for a project - client sends the full ordered id list. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const scenes = await db.videoScene.findMany({ where: { projectId: project.id } });
  const validIds = new Set(scenes.map((s) => s.id));
  if (parsed.data.sceneIds.length !== scenes.length || !parsed.data.sceneIds.every((id) => validIds.has(id))) {
    return NextResponse.json({ error: "Scene list mismatch" }, { status: 400 });
  }

  await db.$transaction(
    parsed.data.sceneIds.map((id, index) => db.videoScene.update({ where: { id }, data: { order: index + 1 } }))
  );

  const updated = await db.videoScene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
  return NextResponse.json({ scenes: updated });
}
