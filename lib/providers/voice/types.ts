export type VoiceGender = "male" | "female" | "neutral";
export type VoiceTone = "professional" | "energetic" | "calm" | "friendly" | "ugc" | "cinematic";

export interface VoiceGenerationRequest {
  jobId: string;
  text: string;
  gender: VoiceGender;
  tone: VoiceTone;
  speed: number; // 0.8 - 1.2
  language: string;
}

export interface VoiceGenerationHandle {
  providerJobId: string;
}

export interface VoiceGenerationStatus {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  audioUrl?: string;
  errorMessage?: string;
}

/**
 * VoiceProvider abstracts the text-to-speech vendor used for AI voiceover.
 */
export interface VoiceProvider {
  readonly id: string;
  generateVoice(request: VoiceGenerationRequest): Promise<VoiceGenerationHandle>;
  getVoiceStatus(handle: VoiceGenerationHandle): Promise<VoiceGenerationStatus>;
}
