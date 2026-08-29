import type {
  VoiceProvider,
  VoiceGenerationRequest,
  VoiceGenerationHandle,
  VoiceGenerationStatus,
} from "./types";

const jobs = new Map<string, { startedAt: number; durationMs: number }>();

/** Simulated TTS provider used in demo mode / when VOICE_API_KEY is unset. */
export class MockVoiceProvider implements VoiceProvider {
  readonly id = "mock";

  async generateVoice(request: VoiceGenerationRequest): Promise<VoiceGenerationHandle> {
    const providerJobId = `mockvoice_${request.jobId}`;
    jobs.set(providerJobId, { startedAt: Date.now(), durationMs: 300 });
    return { providerJobId };
  }

  async getVoiceStatus(handle: VoiceGenerationHandle): Promise<VoiceGenerationStatus> {
    const job = jobs.get(handle.providerJobId);
    if (!job) return { status: "failed", progress: 0, errorMessage: "Job not found" };
    const elapsed = Date.now() - job.startedAt;
    const progress = Math.min(100, Math.round((elapsed / job.durationMs) * 100));
    if (progress >= 100) {
      return { status: "completed", progress: 100, audioUrl: "/demo/voice-placeholder.mp3" };
    }
    return { status: "processing", progress };
  }
}
