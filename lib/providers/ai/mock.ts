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

    const subject = extractCoreIdea(input.prompt);
    // When the user pastes a long, detailed brief (their own shot list,
    // restrictions, CTA, etc.) instead of a short idea, pull real chunks of
    // it into each scene's visual description instead of generic filler -
    // and always carry the FULL original text into the generation prompt
    // (below) so nothing the user wrote is lost once a real video provider
    // is connected.
    const segments = splitIntoSegments(input.prompt);
    const useSegments = segments.length >= ranges.length;

    const scenes: ScriptScene[] = ranges.map(([start, end], i) => {
      const beat = VISUAL_BEATS[i % VISUAL_BEATS.length];
      const visual = useSegments ? segments[i % segments.length] : `${beat} Subject: ${subject}.`;
      return {
        order: i + 1,
        startSec: start,
        endSec: end,
        visual,
        voice: voiceBeats[i % voiceBeats.length],
        prompt: buildScenePrompt(input.prompt, input.style, useSegments ? visual : beat),
      };
    });

    return {
      title: await this.generateTitle(input.prompt),
      description: await this.generateDescription(input.prompt, input.videoType),
      scenes,
    };
  }

  async generateScenePrompts(scenes: ScriptScene[], style: string): Promise<string[]> {
    await delay(300);
    const styleLabel = style.toLowerCase().replace(/_/g, " ");
    return scenes.map(
      (s) => `${s.visual} Style: ${styleLabel}. High production value, professional color grading, 4k.`
    );
  }

  async generateTitle(prompt: string): Promise<string> {
    await delay(150);
    const subject = extractCoreIdea(prompt);
    return `${capitalize(subject)} — AI Video`;
  }

  async generateDescription(prompt: string, videoType: string): Promise<string> {
    await delay(150);
    return `An AI-generated ${videoType.toLowerCase().replace(/_/g, " ")} based on: "${extractCoreIdea(prompt)}".`;
  }

  async generateVoiceText(scene: ScriptScene, tone: string): Promise<string> {
    await delay(100);
    return `${scene.voice}`;
  }
}

/** A short, natural-reading summary used for titles/descriptions - the
 * first meaningful sentence or line, not a mid-word character cutoff. */
function extractCoreIdea(prompt: string) {
  const firstLine = prompt.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? prompt;
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  const cleaned = firstSentence.replace(/[.!?]+$/g, "").trim();
  return cleaned.length > 90 ? cleaned.slice(0, 90).trim() + "…" : cleaned;
}

/**
 * Splits a long, detailed prompt (a full creative brief, shot list, or
 * generation instructions - as opposed to a one-line idea) into meaningful
 * chunks that can be distributed across scenes, so the storyboard reflects
 * what the user actually wrote instead of generic filler text.
 */
function splitIntoSegments(prompt: string): string[] {
  if (prompt.length < 200) return [];
  const raw = prompt
    .split(/\r?\n|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = raw.filter((s) => {
    if (s.length < 12 || s.length > 220) return false;
    // Skip meta/restriction lists (e.g. "SIN MARCA DE AGUA. SIN LOGOS...")
    // and section headers - they belong in the generation prompt, not as a
    // human-readable "what happens in this scene" description.
    const letters = s.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    const isMostlyUppercase = letters.length > 6 && letters === letters.toUpperCase();
    const looksLikeHeader = /^[-#=*\s]{2,}/.test(s) || /RESTRICCION|RESULTADO FINAL|CTA:/i.test(s);
    return !isMostlyUppercase && !looksLikeHeader;
  });

  return segments;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildScenePrompt(fullPromptOrSubject: string, style: string, beat: string) {
  const styleLabel = style.toLowerCase().replace(/_/g, " ");
  return `${beat}\nStyle: ${styleLabel}. High production value, professional color grading, 4k.\n\nFull creative brief:\n${fullPromptOrSubject}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
