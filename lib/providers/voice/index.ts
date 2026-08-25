import type { VoiceProvider } from "./types";
import { MockVoiceProvider } from "./mock";
import { RealVoiceProvider } from "./real";

export * from "./types";

let instance: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (instance) return instance;
  const demoMode = process.env.DEMO_MODE === "true" || !process.env.VOICE_API_KEY;
  instance = demoMode ? new MockVoiceProvider() : new RealVoiceProvider();
  return instance;
}
