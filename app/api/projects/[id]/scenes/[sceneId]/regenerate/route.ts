import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getVideoProvider } from "@/lib/providers/video";
import { deductCredits, InsufficientCreditsError } from "@/lib/credits";
import { GENERATION_COSTS } from "@/lib/config";
import { pickDemoClip, pickDemoThumbnail } from "@/lib/demo/media";

/**
 * Regenerates a single scene's clip synchronously. This is a lighter-weight
 * operation than a full pipeline run, so we await the provider directly
 * instead of going through the background job system.
 */
export async function POST(req: Request, { params }: { params: { id: string; sceneId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scene = await db.videoScene.findFirst({
    where: { id: params.sceneId, projectId: params.id, project: { userId: session.user.id } },
    include: { project: true },
  });
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  try {
    await deductCredits(session.user.id, GENERATION_COSTS.scene, "VIDEO_GENERATION", `Regenerate scene ${scene.order}`);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Not enough credits to regenerate this scene." }, { status: 402 });
    }
    throw err;
  }

  const video = getVideoProvider();
  const handle = await video.generateVideo({
    jobId: `${scene.id}-${Date.now()}`,
    prompt: scene.prompt,
    style: scene.project.style,
    aspectRatio: scene.project.aspectRatio,
    durationSeconds: scene.endSec - scene.startSec,
  });

  let status = await video.getGenerationStatus(handle);
  const deadline = Date.now() + 15000;
  while (status.status === "processing" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    status = await video.getGenerationStatus(handle);
  }

  const updated = await db.videoScene.update({
    where: { id: scene.id },
    data: {
      videoUrl: status.videoUrl ?? pickDemoClip(`${scene.id}-${Date.now()}`),
      imageUrl: pickDemoThumbnail(`${scene.id}-${Date.now()}`),
    },
  });

  return NextResponse.json({ scene: updated });
}
