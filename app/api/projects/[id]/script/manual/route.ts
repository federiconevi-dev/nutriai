import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Initializes a project for manual scriptwriting: creates blank, editable
 * scenes split evenly across the project's duration, without calling the
 * AIProvider. Used when the user wants to write exactly what happens and
 * what's said in each scene themselves, instead of an AI-generated script.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const ranges = splitDuration(project.duration);

  await db.$transaction([
    db.videoScene.deleteMany({ where: { projectId: project.id } }),
    db.project.update({ where: { id: project.id }, data: { script: null } }),
    db.videoScene.createMany({
      data: ranges.map(([start, end], i) => ({
        projectId: project.id,
        order: i + 1,
        startSec: start,
        endSec: end,
        visualText: "",
        voiceText: "",
        prompt: "",
      })),
    }),
  ]);

  const scenes = await db.videoScene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
  return NextResponse.json({ scenes });
}

function splitDuration(totalSeconds: number): [number, number][] {
  const sceneCount = totalSeconds <= 15 ? 3 : totalSeconds <= 30 ? 4 : 5;
  const base = Math.floor(totalSeconds / sceneCount);
  const ranges: [number, number][] = [];
  let cursor = 0;
  for (let i = 0; i < sceneCount; i++) {
    const isLast = i === sceneCount - 1;
    const end = isLast ? totalSeconds : cursor + base;
    ranges.push([cursor, end]);
    cursor = end;
  }
  return ranges;
}
