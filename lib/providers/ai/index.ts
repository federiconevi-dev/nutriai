import type { AIProvider } from "./types";
import { MockAIProvider } from "./mock";
import { RealAIProvider } from "./real";

export * from "./types";

let instance: AIProvider | null = null;

/**
 * Returns the active AIProvider. Uses the real provider when AI_API_KEY is
 * configured and DEMO_MODE is not forced; otherwise falls back to the mock
 * provider so the app is fully usable without any external API key.
 */
export function getAIProvider(): AIProvider {
  if (instance) return instance;
  const demoMode = process.env.DEMO_MODE === "true";
  const hasKey = !!process.env.AI_API_KEY;
  instance = !demoMode && hasKey ? new RealAIProvider() : new MockAIProvider();
  return instance;
}
