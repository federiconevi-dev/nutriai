import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/providers/ai";
import { getVideoProvider } from "@/lib/providers/video";
import { getVoiceProvider } from "@/lib/providers/voice";
import { deductCredits, refundCredits, InsufficientCreditsError } from "@/lib/credits";
import { GENERATION_COSTS } from "@/lib/config";
import { pickDemoClip, pickDemoThumbnail } from "@/lib/demo/media";
import type { GenerationStage } from "@/lib/types";

type LogEntry = { step: string; message: string; at: string };

/**
 * Serverless-safe generation pipeline.
 *
 * Serverless hosts (Vercel functions) freeze/terminate the process once an
 * HTTP response is sent, so a long-running "fire and forget" background job
 * never gets to finish there. Instead, this pipeline advances by exactly one
 * small unit of work (one stage transition, or one scene) each time
 * `advanceGeneration()` is called - and the client already polls
 * GET /api/generations/[id] every ~1.5s, so that poll is what drives the
 * pipeline forward. Every unit of work completes well within a single
 * request, and all state lives in the database, so it survives across
 * separate function invocations with no in-memory state required.
 *
 * For a queue with true fan-out/retries at scale, swap this for BullMQ +
 * Redis, Inngest, Trigger.dev, etc. - `advanceGeneration` is the only entry
 * point that would need to change.
 */

const TERMINAL_STAGES: GenerationStage[] = ["COMPLETED", "FAILED", "CANCELLED"];

export async function startGeneration(projectId: string, userId: string) {
  const project = await db.project.findFirstOrThrow({ where: { id: projectId, userId } });

  await deductCredits(userId, GENERATION_COSTS.video, "VIDEO_GENERATION", `Project: ${project.title}`);

  const generation = await db.generation.create({
    data: {
      projectId,
      stage: "QUEUED",
      progress: 0,
      provider: getVideoProvider().id,
      creditsCost: GENERATION_COSTS.video,
      logs: JSON.stringify([{ step: "QUEUED", message: "Generation queued", at: new Date().toISOString() }] as LogEntry[]),
    },
  });

  await db.project.update({ where: { id: projectId }, data: { status: "GENERATING" } });

  return generation;
}

async function appendLog(generationId: string, step: string, message: string) {
  const current = await db.generation.findUnique({ where: { id: generationId } });
  const logs: LogEntry[] = current?.logs ? JSON.parse(current.logs) : [];
  logs.push({ step, message, at: new Date().toISOString() });
  await db.generation.update({ where: { id: generationId }, data: { logs: JSON.stringify(logs) } });
}

/**
 * Advances a generation by one unit of work. Safe to call repeatedly (e.g.
 * on every status poll) - it's a no-op once the generation is terminal.
 */
export async function advanceGeneration(generationId: string) {
  const generation = await db.generation.findUnique({
    where: { id: generationId },
    include: { project: { include: { scenes: { orderBy: { order: "asc" } } } } },
  });
  if (!generation) return null;
  if (TERMINAL_STAGES.includes(generation.stage as GenerationStage)) return generation;

  const project = generation.project;

  try {
    switch (generation.stage as GenerationStage) {
      case "QUEUED":
        await setStage(generationId, "ANALYZING_PROMPT", 8, "Analyzing your prompt…");
        break;

      case "ANALYZING_PROMPT":
        await setStage(generationId, "CREATING_SCRIPT", 22, "Writing the script…");
        break;

      case "CREATING_SCRIPT": {
        if (project.scenes.length === 0) {
          const ai = getAIProvider();
          const script = await ai.generateScript({
            prompt: project.prompt,
            videoType: project.videoType,
            style: project.style,
            duration: project.duration,
            language: project.language,
          });
          await db.project.update({
            where: { id: project.id },
            data: { title: script.title || project.title, script: JSON.stringify(script) },
          });
          await db.videoScene.createMany({
            data: script.scenes.map((s) => ({
              projectId: project.id,
              order: s.order,
              startSec: s.startSec,
              endSec: s.endSec,
              visualText: s.visual,
              voiceText: s.voice,
              prompt: s.prompt,
            })),
          });
        }
        await setStage(generationId, "CREATING_STORYBOARD", 34, "Building the storyboard…");
        break;
      }

      case "CREATING_STORYBOARD":
        await setStage(generationId, "GENERATING_SCENES", 40, "Generating video scenes…");
        break;

      case "GENERATING_SCENES": {
        // Generate every scene's clip in this single call (each mock clip is
        // fast, well within the route's maxDuration) instead of one scene per
        // poll - far fewer network round trips, much faster overall.
        const scenes = await db.videoScene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
        const video = getVideoProvider();
        for (const scene of scenes) {
          if (scene.videoUrl) continue;
          const handle = await video.generateVideo({
            jobId: scene.id,
            prompt: scene.prompt,
            style: project.style,
            aspectRatio: project.aspectRatio,
            durationSeconds: scene.endSec - scene.startSec,
          });
          const result = await pollUntilDone(() => video.getGenerationStatus(handle));
          await db.videoScene.update({
            where: { id: scene.id },
            data: {
              videoUrl: result.videoUrl ?? pickDemoClip(scene.id),
              imageUrl: pickDemoThumbnail(scene.id),
            },
          });
        }
        await setStage(generationId, "CREATING_VOICE", 60, "Creating voiceover…");
        break;
      }

      case "CREATING_VOICE": {
        const scenes = await db.videoScene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
        const voice = getVoiceProvider();
        for (const scene of scenes) {
          if (scene.audioUrl) continue;
          const handle = await voice.generateVoice({
            jobId: scene.id,
            text: scene.voiceText,
            gender: "female",
            tone: "professional",
            speed: 1,
            language: project.language,
          });
          const result = await pollUntilDone(() => voice.getVoiceStatus(handle));
          await db.videoScene.update({ where: { id: scene.id }, data: { audioUrl: result.audioUrl } });
        }
        await setStage(generationId, "ADDING_SUBTITLES", 84, "Adding subtitles…");
        break;
      }

      case "ADDING_SUBTITLES":
        await setStage(generationId, "RENDERING_VIDEO", 90, "Rendering final video…");
        break;

      case "RENDERING_VIDEO":
        await setStage(generationId, "FINALIZING", 97, "Finalizing…");
        break;

      case "FINALIZING": {
        const firstScene = await db.videoScene.findFirst({ where: { projectId: project.id }, orderBy: { order: "asc" } });
        const resultUrl = firstScene?.videoUrl ?? pickDemoClip(project.id);
        const thumbnail = firstScene?.imageUrl ?? pickDemoThumbnail(project.id);

        await db.video.create({
          data: {
            projectId: project.id,
            userId: project.userId,
            title: project.title,
            status: "COMPLETED",
            duration: project.duration,
            aspectRatio: project.aspectRatio,
            thumbnail,
            videoUrl: resultUrl,
          },
        });
        await db.project.update({ where: { id: project.id }, data: { status: "COMPLETED", thumbnail } });
        await db.generation.update({
          where: { id: generationId },
          data: { resultUrl, stage: "COMPLETED", progress: 100, finishedAt: new Date() },
        });
        await appendLog(generationId, "COMPLETED", "Your video is ready!");
        break;
      }
    }
  } catch (err) {
    console.error(`[pipeline] Generation ${generationId} failed:`, err);
    const message =
      err instanceof InsufficientCreditsError
        ? "Insufficient credits."
        : "Something went wrong while generating your video. Please try again.";

    await db.generation.update({
      where: { id: generationId },
      data: { stage: "FAILED", errorMessage: message, finishedAt: new Date() },
    });
    await db.project.update({ where: { id: project.id }, data: { status: "FAILED" } });
    await appendLog(generationId, "FAILED", message);
    await refundCredits(project.userId, generation.creditsCost, `Refund for failed generation ${generationId}`).catch(() => {});
  }

  return db.generation.findUnique({ where: { id: generationId } });
}

async function setStage(generationId: string, stage: GenerationStage, progress: number, message: string) {
  await db.generation.update({ where: { id: generationId }, data: { stage, progress } });
  await appendLog(generationId, stage, message);
}

export async function cancelGenerationJob(generationId: string, userId: string) {
  const generation = await db.generation.findFirst({
    where: { id: generationId, project: { userId } },
    include: { project: true },
  });
  if (!generation) throw new Error("Generation not found");
  if (generation.stage === "COMPLETED" || generation.stage === "FAILED") return generation;

  await db.generation.update({
    where: { id: generationId },
    data: { stage: "CANCELLED", finishedAt: new Date() },
  });
  await db.project.update({ where: { id: generation.projectId }, data: { status: "DRAFT" } });
  await appendLog(generationId, "CANCELLED", "Generation cancelled by user");
  await refundCredits(userId, generation.creditsCost, `Refund for cancelled generation ${generationId}`).catch(() => {});

  return generation;
}

async function pollUntilDone<T extends { status: string; progress: number }>(
  check: () => Promise<T>,
  timeoutMs = 15000
): Promise<T> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await check();
    if (result.status === "completed" || result.status === "failed" || result.status === "cancelled") {
      return result;
    }
    if (Date.now() - start > timeoutMs) return result;
    await sleep(300);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
