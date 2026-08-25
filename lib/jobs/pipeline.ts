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
 * In-process background job runner.
 *
 * IMPORTANT (production note): this simulates a job queue using an
 * in-memory async function kicked off with a fire-and-forget promise. It
 * works well for `next start`/`next dev` (a long-running Node process), but
 * a serverless deployment (Vercel functions) can freeze/terminate the
 * process once the HTTP response is sent. For production at scale, swap
 * this module for a real queue (BullMQ + Redis, Inngest, Trigger.dev, etc.)
 * - every call site here goes through `startGeneration`, so only this file
 * needs to change.
 */

const STAGE_SEQUENCE: { stage: GenerationStage; progress: number; message: string }[] = [
  { stage: "ANALYZING_PROMPT", progress: 8, message: "Analyzing your prompt…" },
  { stage: "CREATING_SCRIPT", progress: 22, message: "Writing the script…" },
  { stage: "CREATING_STORYBOARD", progress: 34, message: "Building the storyboard…" },
  { stage: "GENERATING_SCENES", progress: 60, message: "Generating video scenes…" },
  { stage: "CREATING_VOICE", progress: 74, message: "Generating voiceover…" },
  { stage: "ADDING_SUBTITLES", progress: 84, message: "Adding subtitles…" },
  { stage: "RENDERING_VIDEO", progress: 94, message: "Rendering final video…" },
  { stage: "FINALIZING", progress: 99, message: "Finalizing…" },
];

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

  // Fire-and-forget: the pipeline runs in the background and the caller
  // gets an immediate response with the generation id to poll.
  runPipeline(generation.id).catch((err) => {
    console.error(`[pipeline] Unhandled error for generation ${generation.id}:`, err);
  });

  return generation;
}

async function appendLog(generationId: string, step: string, message: string) {
  const current = await db.generation.findUnique({ where: { id: generationId } });
  const logs: LogEntry[] = current?.logs ? JSON.parse(current.logs) : [];
  logs.push({ step, message, at: new Date().toISOString() });
  await db.generation.update({ where: { id: generationId }, data: { logs: JSON.stringify(logs) } });
}

async function isCancelled(generationId: string) {
  const g = await db.generation.findUnique({ where: { id: generationId }, select: { stage: true } });
  return g?.stage === "CANCELLED";
}

async function runPipeline(generationId: string) {
  const generation = await db.generation.findUniqueOrThrow({
    where: { id: generationId },
    include: { project: { include: { scenes: true, user: true } } },
  });
  const project = generation.project;
  const ai = getAIProvider();
  const video = getVideoProvider();
  const voice = getVoiceProvider();

  try {
    for (const step of STAGE_SEQUENCE) {
      if (await isCancelled(generationId)) return;

      await db.generation.update({
        where: { id: generationId },
        data: { stage: step.stage, progress: step.progress },
      });
      await appendLog(generationId, step.stage, step.message);

      switch (step.stage) {
        case "ANALYZING_PROMPT":
          await sleep(500);
          break;

        case "CREATING_SCRIPT": {
          if (project.scenes.length === 0) {
            const script = await ai.generateScript({
              prompt: project.prompt,
              videoType: project.videoType,
              style: project.style,
              duration: project.duration,
              language: project.language,
            });
            await db.project.update({
              where: { id: project.id },
              data: {
                title: script.title || project.title,
                script: JSON.stringify(script),
              },
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
          break;
        }

        case "CREATING_STORYBOARD":
          await sleep(400);
          break;

        case "GENERATING_SCENES": {
          const scenes = await db.videoScene.findMany({
            where: { projectId: project.id },
            orderBy: { order: "asc" },
          });
          for (const scene of scenes) {
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
          break;
        }

        case "CREATING_VOICE": {
          const scenes = await db.videoScene.findMany({
            where: { projectId: project.id },
            orderBy: { order: "asc" },
          });
          for (const scene of scenes) {
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
          break;
        }

        case "ADDING_SUBTITLES":
          await sleep(500);
          break;

        case "RENDERING_VIDEO":
          await sleep(700);
          break;

        case "FINALIZING": {
          const firstScene = await db.videoScene.findFirst({
            where: { projectId: project.id },
            orderBy: { order: "asc" },
          });
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

          await db.project.update({
            where: { id: project.id },
            data: { status: "COMPLETED", thumbnail },
          });

          await db.generation.update({
            where: { id: generationId },
            data: { resultUrl },
          });
          break;
        }
      }
    }

    await db.generation.update({
      where: { id: generationId },
      data: { stage: "COMPLETED", progress: 100, finishedAt: new Date() },
    });
    await appendLog(generationId, "COMPLETED", "Your video is ready!");
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

    // Refund credits since the generation didn't complete.
    await refundCredits(project.userId, generation.creditsCost, `Refund for failed generation ${generationId}`).catch(() => {});
  }
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
  timeoutMs = 20000
): Promise<T> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await check();
    if (result.status === "completed" || result.status === "failed" || result.status === "cancelled") {
      return result;
    }
    if (Date.now() - start > timeoutMs) return result;
    await sleep(350);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
