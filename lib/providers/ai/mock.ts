import type {
  AIProvider,
  GenerateScriptInput,
  GeneratedScript,
  ScriptScene,
} from "./types";

const VISUAL_BEATS = [
  "Product hero shot on a clean, softly lit surface, slow push-in.",
  "Close-up of key details and textures, shallow depth of field.",
  "A person naturally interacting with the product in a real setting.",
  "Lifestyle moment showing the benefit in action, warm lighting.",
  "Dynamic result / after shot, confident and aspirational framing.",
  "Final logo/branding card with a clear call to action.",
];

const VOICE_BEATS_BY_LANGUAGE: Record<string, string[]> = {
  es: [
    "Descubrí una nueva forma de hacer las cosas.",
    "Diseñado para adaptarse a tu día a día.",
    "Simple, rápido y pensado para vos.",
    "Mirá la diferencia desde el primer uso.",
    "Esto es lo que estabas buscando.",
    "Empezá hoy. El cambio es ahora.",
  ],
  en: [
    "Discover a new way to get it done.",
    "Designed to fit right into your day.",
    "Simple, fast, and made for you.",
    "See the difference from the first use.",
    "This is what you've been looking for.",
    "Start today. The change begins now.",
  ],
  pt: [
    "Descubra uma nova forma de fazer.",
    "Feito para se encaixar no seu dia a dia.",
    "Simples, rápido e pensado para você.",
    "Veja a diferença desde o primeiro uso.",
    "Isso é o que você procurava.",
    "Comece hoje. A mudança é agora.",
  ],
  fr: [
    "Découvrez une nouvelle façon de faire.",
    "Pensé pour s'intégrer à votre quotidien.",
    "Simple, rapide, fait pour vous.",
    "Voyez la différence dès la première utilisation.",
    "C'est exactement ce que vous cherchiez.",
    "Commencez aujourd'hui. Le changement, c'est maintenant.",
  ],
  it: [
    "Scopri un nuovo modo di fare le cose.",
    "Pensato per adattarsi alla tua giornata.",
    "Semplice, veloce e fatto per te.",
    "Guarda la differenza dal primo utilizzo.",
    "Questo è ciò che stavi cercando.",
    "Inizia oggi. Il cambiamento è ora.",
  ],
};

function splitDurationIntoScenes(totalSeconds: number): [number, number][] {
  const sceneCount = totalSeconds <= 15 ? 3 : totalSeconds <= 30 ? 4 : 5;
  const base = Math.floor(totalSeconds / sceneCount);
  const ranges: [number, number][] = [];
  let cursor = 0;
  for (let i = 0; i < sceneCount; i++) {
    const isLast = i === sceneCount - 1;
    const end = isLast ? totalSeconds : cursor + base;
    ranges.push([cursor, end]);
    cursor = end;
  }
  return ranges;
}

/**
 * Deterministic, template-based script generator used whenever AI_API_KEY
 * is not configured (or DEMO_MODE=true). It produces a coherent scene-by-scene
 * script so the whole product flow can be exercised without an LLM.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock";

  async generateScript(input: GenerateScriptInput): Promise<GeneratedScript> {
    await delay(600);
    const ranges = splitDurationIntoScenes(input.duration);
    const voiceBeats =
      VOICE_BEATS_BY_LANGUAGE[input.language] ?? VOICE_BEATS_BY_LANGUAGE.en;

    const subject = extractSubject(input.prompt);

    const scenes: ScriptScene[] = ranges.map(([start, end], i) => ({
      order: i + 1,
      startSec: start,
      endSec: end,
      visual: `${VISUAL_BEATS[i % VISUAL_BEATS.length]} Subject: ${subject}.`,
      voice: voiceBeats[i % voiceBeats.length],
      prompt: buildScenePrompt(subject, input.style, VISUAL_BEATS[i % VISUAL_BEATS.length]),
    }));

    return {
      title: await this.generateTitle(input.prompt),
      description: await this.generateDescription(input.prompt, input.videoType),
      scenes,
    };
  }

  async generateScenePrompts(scenes: ScriptScene[], style: string): Promise<string[]> {
    await delay(300);
    return scenes.map((s) => buildScenePrompt(s.visual, style, s.visual));
  }

  async generateTitle(prompt: string): Promise<string> {
    await delay(150);
    const subject = extractSubject(prompt);
    return `${capitalize(subject)} — AI Video`;
  }

  async generateDescription(prompt: string, videoType: string): Promise<string> {
    await delay(150);
    return `An AI-generated ${videoType.toLowerCase().replace(/_/g, " ")} based on: "${prompt}".`;
  }

  async generateVoiceText(scene: ScriptScene, tone: string): Promise<string> {
    await delay(100);
    return `${scene.voice}`;
  }
}

function extractSubject(prompt: string) {
  const cleaned = prompt.replace(/[.!?]+$/g, "").trim();
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildScenePrompt(subject: string, style: string, beat: string) {
  return `${beat} Style: ${style.toLowerCase().replace(/_/g, " ")}. Subject: ${subject}. High production value, professional color grading, 4k.`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
