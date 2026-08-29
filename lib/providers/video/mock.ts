import type {
  VideoProvider,
  VideoGenerationRequest,
  VideoGenerationHandle,
  VideoGenerationStatus,
} from "./types";
import { pickDemoClip } from "@/lib/demo/media";

interface InternalJob {
  status: VideoGenerationStatus["status"];
  startedAt: number;
  durationMs: number;
  videoUrl: string;
  cancelled: boolean;
}

const jobs = new Map<string, InternalJob>();

/**
 * Simulates a text/image-to-video generation provider. No network calls are
 * made; progress advances based on elapsed time so the UI can show a
 * realistic progress bar. Used automatically whenever VIDEO_API_KEY is not
 * configured or DEMO_MODE=true.
 */
export class MockVideoProvider implements VideoProvider {
  readonly id = "mock";

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationHandle> {
    const providerJobId = `mock_${request.jobId}`;
    jobs.set(providerJobId, {
      status: "processing",
      startedAt: Date.now(),
      durationMs: 900 + Math.random() * 700,
      videoUrl: pickDemoClip(request.jobId + request.prompt),
      cancelled: false,
    });
    return { providerJobId };
  }

  async getGenerationStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus> {
    const job = jobs.get(handle.providerJobId);
    if (!job) {
      return { status: "failed", progress: 0, errorMessage: "Job not found" };
    }
    if (job.cancelled) {
      return { status: "cancelled", progress: 0 };
    }
    const elapsed = Date.now() - job.startedAt;
    const progress = Math.min(100, Math.round((elapsed / job.durationMs) * 100));
    if (progress >= 100) {
      job.status = "completed";
      return { status: "completed", progress: 100, videoUrl: job.videoUrl };
    }
    return { status: "processing", progress };
  }

  async downloadVideo(handle: VideoGenerationHandle): Promise<string> {
    const job = jobs.get(handle.providerJobId);
    if (!job) throw new Error("Job not found");
    return job.videoUrl;
  }

  async cancelGeneration(handle: VideoGenerationHandle): Promise<void> {
    const job = jobs.get(handle.providerJobId);
    if (job) job.cancelled = true;
  }
}
