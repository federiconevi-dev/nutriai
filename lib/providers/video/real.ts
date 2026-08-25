import type {
  VideoProvider,
  VideoGenerationRequest,
  VideoGenerationHandle,
  VideoGenerationStatus,
} from "./types";

/**
 * Real video-generation provider. Talks to an external text/image-to-video
 * API over HTTPS using server-only credentials.
 *
 * Configure via env vars:
 *   VIDEO_API_KEY - secret key, never sent to the client
 *   VIDEO_API_URL - base URL of the provider's REST API
 *
 * This adapter implements a common request/poll/download REST shape. Most
 * commercial video-gen APIs (Runway, Luma, Pika, Kling, etc.) follow this
 * pattern closely - adjust the request/response field names below to match
 * whichever provider you connect, the rest of the app does not change.
 */
export class RealVideoProvider implements VideoProvider {
  readonly id = "real";

  private get apiKey() {
    return process.env.VIDEO_API_KEY;
  }
  private get apiUrl() {
    return process.env.VIDEO_API_URL;
  }

  private assertConfigured() {
    if (!this.apiKey || !this.apiUrl) {
      throw new Error(
        "VIDEO_API_KEY / VIDEO_API_URL are not configured. Set them in your environment or enable DEMO_MODE."
      );
    }
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationHandle> {
    this.assertConfigured();
    const res = await fetch(`${this.apiUrl}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        style: request.style,
        aspect_ratio: request.aspectRatio,
        duration_seconds: request.durationSeconds,
        reference_images: request.referenceImageUrls ?? [],
      }),
    });
    if (!res.ok) {
      throw new Error(`Video provider error (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    return { providerJobId: data.id };
  }

  async getGenerationStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus> {
    this.assertConfigured();
    const res = await fetch(`${this.apiUrl}/generations/${handle.providerJobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      return { status: "failed", progress: 0, errorMessage: `Provider error ${res.status}` };
    }
    const data = await res.json();
    return {
      status: data.status,
      progress: data.progress ?? 0,
      videoUrl: data.video_url,
      errorMessage: data.error,
    };
  }

  async downloadVideo(handle: VideoGenerationHandle): Promise<string> {
    const status = await this.getGenerationStatus(handle);
    if (!status.videoUrl) throw new Error("Video not ready yet");
    return status.videoUrl;
  }

  async cancelGeneration(handle: VideoGenerationHandle): Promise<void> {
    this.assertConfigured();
    await fetch(`${this.apiUrl}/generations/${handle.providerJobId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
  }
}
