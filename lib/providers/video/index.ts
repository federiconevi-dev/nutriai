import type { VideoProvider } from "./types";
import { MockVideoProvider } from "./mock";
import { RealVideoProvider } from "./real";

export * from "./types";

let instance: VideoProvider | null = null;

export function isDemoMode() {
  return process.env.DEMO_MODE === "true" || !process.env.VIDEO_API_KEY;
}

export function getVideoProvider(): VideoProvider {
  if (instance) return instance;
  instance = isDemoMode() ? new MockVideoProvider() : new RealVideoProvider();
  return instance;
}
