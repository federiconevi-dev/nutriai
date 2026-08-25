import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSceneSchema } from "@/lib/validations";

async function assertOwnership(projectId: string, sceneId: string, userId: string) {
  const scene = await db.videoScene.findFirst({
    where: { id: sceneId, projectId, project: { userId } },
  });
  return scene;
}

export async function PATCH(req: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scene = await assertOwnership(params.id, params.sceneId, session.user.id);
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSceneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updated = await db.videoScene.update({ where: { id: scene.id }, data: parsed.data });
  return NextResponse.json({ scene: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scene = await assertOwnership(params.id, params.sceneId, session.user.id);
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const count = await db.videoScene.count({ where: { projectId: params.id } });
  if (count <= 1) {
    return NextResponse.json({ error: "A video needs at least one scene." }, { status: 400 });
  }

  await db.videoScene.delete({ where: { id: scene.id } });
  return NextResponse.json({ success: true });
}
