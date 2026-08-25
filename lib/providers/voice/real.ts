import type {
  VoiceProvider,
  VoiceGenerationRequest,
  VoiceGenerationHandle,
  VoiceGenerationStatus,
} from "./types";

/**
 * Real text-to-speech provider. Configure via:
 *   VOICE_API_KEY - secret key, server-side only
 *   VOICE_API_URL - base URL of the TTS REST API
 */
export class RealVoiceProvider implements VoiceProvider {
  readonly id = "real";

  private get apiKey() {
    return process.env.VOICE_API_KEY;
  }
  private get apiUrl() {
    return process.env.VOICE_API_URL;
  }

  private assertConfigured() {
    if (!this.apiKey || !this.apiUrl) {
      throw new Error(
        "VOICE_API_KEY / VOICE_API_URL are not configured. Set them in your environment or enable DEMO_MODE."
      );
    }
  }

  async generateVoice(request: VoiceGenerationRequest): Promise<VoiceGenerationHandle> {
    this.assertConfigured();
    const res = await fetch(`${this.apiUrl}/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        text: request.text,
        gender: request.gender,
        tone: request.tone,
        speed: request.speed,
        language: request.language,
      }),
    });
    if (!res.ok) throw new Error(`Voice provider error (${res.status})`);
    const data = await res.json();
    return { providerJobId: data.id };
  }

  async getVoiceStatus(handle: VoiceGenerationHandle): Promise<VoiceGenerationStatus> {
    this.assertConfigured();
    const res = await fetch(`${this.apiUrl}/tts/${handle.providerJobId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) return { status: "failed", progress: 0, errorMessage: `Provider error ${res.status}` };
    const data = await res.json();
    return { status: data.status, progress: data.progress ?? 0, audioUrl: data.audio_url };
  }
}
