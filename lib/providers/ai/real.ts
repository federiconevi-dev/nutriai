import type {
  AIProvider,
  GenerateScriptInput,
  GeneratedScript,
  ScriptScene,
} from "./types";
import { MockAIProvider } from "./mock";

/**
 * Real AI provider. Connects to any OpenAI-compatible chat completions API
 * (OpenAI, Azure OpenAI, Anthropic via a compatible proxy, local models, etc).
 *
 * Configure via env vars:
 *   AI_API_KEY  - secret key, server-side only, never exposed to the client
 *   AI_MODEL    - model id, e.g. "gpt-4o-mini"
 *   AI_API_URL  - optional, defaults to https://api.openai.com/v1/chat/completions
 *
 * If the request fails for any reason, this provider transparently falls back
 * to the deterministic MockAIProvider so the user's flow is never blocked.
 */
export class RealAIProvider implements AIProvider {
  readonly id = "real";
  private fallback = new MockAIProvider();

  private get apiKey() {
    return process.env.AI_API_KEY;
  }
  private get apiUrl() {
    return process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  }
  private get model() {
    return process.env.AI_MODEL || "gpt-4o-mini";
  }

  async generateScript(input: GenerateScriptInput): Promise<GeneratedScript> {
    if (!this.apiKey) return this.fallback.generateScript(input);

    const system = `You are a professional video script writer for short-form ads. Respond ONLY with valid JSON matching this TypeScript type:
type Script = { title: string; description: string; scenes: { order: number; startSec: number; endSec: number; visual: string; voice: string; prompt: string }[] }
Divide the total duration into 3-5 scenes that add up to exactly ${input.duration} seconds. Write "voice" lines in ${input.language}.`;

    const user = `Idea: ${input.prompt}
Video type: ${input.videoType}
Style: ${input.style}
Duration: ${input.duration} seconds
${input.productContext ? `Product context: ${input.productContext}` : ""}`;

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) throw new Error(`AI provider responded ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI provider returned empty content");
      const parsed = JSON.parse(content) as GeneratedScript;
      if (!parsed.scenes?.length) throw new Error("AI provider returned no scenes");
      return parsed;
    } catch (err) {
      console.error("[RealAIProvider] falling back to mock:", err);
      return this.fallback.generateScript(input);
    }
  }

  async generateScenePrompts(scenes: ScriptScene[], style: string): Promise<string[]> {
    if (!this.apiKey) return this.fallback.generateScenePrompts(scenes, style);
    try {
      return scenes.map((s) => `${s.visual} — ${style} style, cinematic, high detail`);
    } catch {
      return this.fallback.generateScenePrompts(scenes, style);
    }
  }

  async generateTitle(prompt: string): Promise<string> {
    if (!this.apiKey) return this.fallback.generateTitle(prompt);
    return this.fallback.generateTitle(prompt);
  }

  async generateDescription(prompt: string, videoType: string): Promise<string> {
    if (!this.apiKey) return this.fallback.generateDescription(prompt, videoType);
    return this.fallback.generateDescription(prompt, videoType);
  }

  async generateVoiceText(scene: ScriptScene, tone: string): Promise<string> {
    if (!this.apiKey) return this.fallback.generateVoiceText(scene, tone);
    return this.fallback.generateVoiceText(scene, tone);
  }
}
