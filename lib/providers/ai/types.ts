export interface ScriptScene {
  order: number;
  startSec: number;
  endSec: number;
  visual: string;
  voice: string;
  prompt: string;
}

export interface GeneratedScript {
  title: string;
  description: string;
  scenes: ScriptScene[];
}

export interface GenerateScriptInput {
  prompt: string;
  videoType: string;
  style: string;
  duration: number;
  language: string;
  productContext?: string;
}

/**
 * AIProvider abstracts the LLM used to turn a user's idea into a script,
 * scene prompts, titles and descriptions. Swap the implementation without
 * touching any calling code - see MockAIProvider and OpenAIProvider.
 */
export interface AIProvider {
  readonly id: string;
  generateScript(input: GenerateScriptInput): Promise<GeneratedScript>;
  generateScenePrompts(scenes: ScriptScene[], style: string): Promise<string[]>;
  generateTitle(prompt: string): Promise<string>;
  generateDescription(prompt: string, videoType: string): Promise<string>;
  generateVoiceText(scene: ScriptScene, tone: string): Promise<string>;
}
