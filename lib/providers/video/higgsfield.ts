import type {
  VideoProvider,
  VideoGenerationRequest,
  VideoGenerationHandle,
  VideoGenerationStatus,
} from "./types";

/**
 * Higgsfield API adapter (Kling 3.0 by default). The key stays server-side,
 * so clients generate through Videora's credit system, never with the key.
 *
 * Configure via env vars:
 *   VIDEO_PROVIDER=higgsfield
 *   VIDEO_API_KEY         - Higgsfield key, "id:secret"
 *   VIDEO_API_URL         - Higgsfield API origin
 *   HIGGSFIELD_VIDEO_MODEL - submit path prefix (default kling-video/v3.0/std)
 */
const ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1"]);

export class HiggsfieldVideoProvider implements VideoProvider {
  readonly id = "higgsfield";

  private config() {
    const apiKey = process.env.VIDEO_API_KEY;
    const apiUrl = process.env.VIDEO_API_URL?.replace(/\/$/, "");
    if (!apiKey || !apiUrl) {
      throw new Error("VIDEO_API_KEY / VIDEO_API_URL are not configured for Higgsfield.");
    }
    return { apiUrl, headers: { Authorization: `Key ${apiKey}` } };
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationHandle> {
    const { apiUrl, headers } = this.config();
    const model = process.env.HIGGSFIELD_VIDEO_MODEL ?? "kling-video/v3.0/std";
    const start = request.referenceImageUrls?.[0];
    const body: Record<string, unknown> = {
      prompt: `${request.prompt}. Style: ${request.style}`,
      duration: Math.min(15, Math.max(3, Math.round(request.durationSeconds))),
      sound: "off",
    };
    if (start) body.image_url = start;
    else body.aspect_ratio = ASPECT_RATIOS.has(request.aspectRatio) ? request.aspectRatio : "9:16";

    const res = await fetch(`${apiUrl}/${model}/${start ? "image-to-video" : "text-to-video"}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Higgsfield error (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    if (!data.request_id) throw new Error("Higgsfield response missing request_id");
    return { providerJobId: data.request_id };
  }

  async getGenerationStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus> {
    const { apiUrl, headers } = this.config();
    const res = await fetch(
      `${apiUrl}/requests/${encodeURIComponent(handle.providerJobId)}/status`,
      { headers }
    );
    if (!res.ok) {
      return { status: "failed", progress: 0, errorMessage: `Higgsfield error ${res.status}` };
    }
    const data = await res.json();
    switch (data.status) {
      case "completed":
        return { status: "completed", progress: 100, videoUrl: data.video?.url };
      case "failed":
      case "nsfw":
        return {
          status: "failed",
          progress: 0,
          errorMessage: data.status === "nsfw" ? "Blocked by content filter" : String(data.error ?? "Generation failed"),
        };
      case "canceled":
        return { status: "cancelled", progress: 0 };
      case "queued":
        return { status: "queued", progress: 5 };
      default:
        return { status: "processing", progress: 50 };
    }
  }

  async downloadVideo(handle: VideoGenerationHandle): Promise<string> {
    const status = await this.getGenerationStatus(handle);
    if (!status.videoUrl) throw new Error("Video not ready yet");
    return status.videoUrl;
  }

  async cancelGeneration(): Promise<void> {
    // The API has no cancel endpoint in this adapter; the job's credits are refunded by the app.
  }
}
