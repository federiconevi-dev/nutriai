import type { VideoProvider } from "./types";
import { MockVideoProvider } from "./mock";
import { RealVideoProvider } from "./real";
import { HiggsfieldVideoProvider } from "./higgsfield";

export * from "./types";

let instance: VideoProvider | null = null;

export function isDemoMode() {
  return process.env.DEMO_MODE === "true" || !process.env.VIDEO_API_KEY;
}

export function getVideoProvider(): VideoProvider {
  if (instance) return instance;
  if (isDemoMode()) instance = new MockVideoProvider();
  else if (process.env.VIDEO_PROVIDER === "higgsfield") instance = new HiggsfieldVideoProvider();
  else instance = new RealVideoProvider();
  return instance;
}
