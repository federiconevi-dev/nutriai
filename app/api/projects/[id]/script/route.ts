import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/providers/ai";
import { deductCredits, InsufficientCreditsError } from "@/lib/credits";
import { GENERATION_COSTS } from "@/lib/config";

/** Generates (or regenerates) the AI script + scenes for a project. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await db.project.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const regenerate = !!body?.regenerate;

  if (project.script && !regenerate) {
    const scenes = await db.videoScene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
    return NextResponse.json({ script: JSON.parse(project.script), scenes });
  }

  if (regenerate) {
    try {
      await deductCredits(session.user.id, GENERATION_COSTS.script, "SCRIPT_GENERATION", "Script regenerated");
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json({ error: "Not enough credits to regenerate the script." }, { status: 402 });
      }
      throw err;
    }
  }

  const ai = getAIProvider();
  const script = await ai.generateScript({
    prompt: project.prompt,
    videoType: project.videoType,
    style: project.style,
    duration: project.duration,
    language: project.language,
  });

  await db.$transaction([
    db.videoScene.deleteMany({ where: { projectId: project.id } }),
    db.project.update({
      where: { id: project.id },
      data: { title: script.title || project.title, script: JSON.stringify(script) },
    }),
    db.videoScene.createMany({
      data: script.scenes.map((s) => ({
        projectId: project.id,
        order: s.order,
        startSec: s.startSec,
        endSec: s.endSec,
        visualText: s.visual,
        voiceText: s.voice,
        prompt: s.prompt,
      })),
    }),
  ]);

  const scenes = await db.videoScene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
  return NextResponse.json({ script, scenes });
}
