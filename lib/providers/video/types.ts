export interface VideoGenerationRequest {
  jobId: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  durationSeconds: number;
  referenceImageUrls?: string[];
}

export type VideoJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface VideoGenerationHandle {
  providerJobId: string;
}

export interface VideoGenerationStatus {
  status: VideoJobStatus;
  progress: number; // 0-100
  videoUrl?: string;
  errorMessage?: string;
}

/**
 * VideoProvider abstracts the underlying text/image-to-video AI service.
 * The rest of the app only talks to this interface, never to a specific
 * vendor SDK, so a new vendor can be added by writing one adapter.
 */
export interface VideoProvider {
  readonly id: string;
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationHandle>;
  getGenerationStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus>;
  downloadVideo(handle: VideoGenerationHandle): Promise<string>; // returns a URL
  cancelGeneration(handle: VideoGenerationHandle): Promise<void>;
}
