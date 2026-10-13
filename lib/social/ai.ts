import { scriptSchema } from "./schemas";
import type { CarouselSlide, Network, ScriptData, ScriptFormat } from "./types";
import { seededRandom } from "./demo";

/**
 * AI writers for the social hub. Uses the same OpenAI-compatible endpoint as
 * the video script writer (AI_API_KEY / AI_MODEL / AI_API_URL). Without a key,
 * or in DEMO_MODE, or if the call fails, a deterministic template writer is
 * used so the flow always works.
 */

export type AISource = "ai" | "demo";

const TONE = `Escribís en español rioplatense neutro, con voseo. Tono profesional pero cercano, como si le hablaras a un amigo: frases cortas, concretas, sin relleno ni clichés de marketing, sin emojis en exceso.`;

function useRealAI() {
  return process.env.DEMO_MODE !== "true" && !!process.env.AI_API_KEY;
}

async function chatJSON(system: string, user: string): Promise<unknown> {
  const res = await fetch(process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI provider responded ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned empty content");
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Video scripts
// ---------------------------------------------------------------------------

export type ScriptInput = { topic: string; audience?: string; network?: Network };

export async function writeScript(input: ScriptInput): Promise<{ script: ScriptData; source: AISource }> {
  if (useRealAI()) {
    try {
      const system = `Sos guionista de contenido para redes sociales. ${TONE}
Respondé SOLO con JSON válido con esta forma:
{ "title": string, "hook": string, "points": { "title": string, "detail": string }[], "closing": string, "cta": string, "durationSec": number, "format": "reel" | "long" | "story", "formatReason": string }
- "hook": el gancho de los primeros 3 segundos, literal, listo para decir a cámara.
- "points": 3 a 5 puntos clave; "detail" es lo que se dice en ese punto (2-3 frases).
- "closing": el cierre que resume la idea.
- "cta": la llamada a la acción final, concreta.
- "format": reel (15-90 s, ideas puntuales/virales), long (más de 4 min, tutoriales o temas profundos) o story (15-60 s, cercano, detrás de escena o encuestas).
- "durationSec": duración sugerida en segundos, coherente con el formato.
- "formatReason": una frase explicando por qué ese formato le conviene.`;
      const user = `Tema del video: ${input.topic}
${input.audience ? `Audiencia: ${input.audience}` : ""}
${input.network ? `Red principal: ${input.network}` : ""}`;
      const raw = (await chatJSON(system, user)) as Record<string, unknown>;
      const parsed = scriptSchema.parse({ ...raw, topic: input.topic, durationSec: Math.round(Number(raw.durationSec)) });
      return { script: parsed, source: "ai" };
    } catch (err) {
      console.error("[social/ai] script falling back to demo writer:", err);
    }
  }
  return { script: demoScript(input), source: "demo" };
}

function pickFormat(topic: string, network?: Network): { format: ScriptFormat; durationSec: number; reason: string } {
  const t = topic.toLowerCase();
  if (/(tutorial|guía|guia|paso a paso|completo|explic|cómo funciona|como funciona|review|análisis|analisis)/.test(t) || network === "youtube") {
    return {
      format: "long",
      durationSec: 480,
      reason: "El tema necesita explicación y ejemplos: un video largo te deja ir a fondo y posicionarte como referente.",
    };
  }
  if (/(detrás|detras|mi día|mi dia|rutina|encuesta|novedad|anuncio|backstage|hoy)/.test(t)) {
    return {
      format: "story",
      durationSec: 45,
      reason: "Es un contenido cercano y del momento: en historias se siente auténtico y genera respuestas directas.",
    };
  }
  return {
    format: "reel",
    durationSec: 45,
    reason: "Es una idea concreta que se entiende rápido: un reel corto maximiza el alcance y las veces que lo comparten.",
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function demoScript(input: ScriptInput): ScriptData {
  const topic = input.topic.trim().replace(/[.!?]+$/, "");
  const rand = seededRandom(topic);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const { format, durationSec, reason } = pickFormat(topic, input.network);
  const who = input.audience?.trim() || "vos";

  const hooks = [
    `Si estás con ${topic.toLowerCase()} y sentís que no avanzás, quedate 30 segundos porque esto te cambia la perspectiva.`,
    `Nadie te cuenta esto sobre ${topic.toLowerCase()}, y es justamente lo que hace la diferencia.`,
    `Me costó años entender esto de ${topic.toLowerCase()}. Te lo resumo en un minuto.`,
    `Pará. Antes de hacer otra cosa con ${topic.toLowerCase()}, mirá esto.`,
  ];

  const points = [
    { title: "El error más común", detail: `La mayoría arranca ${topic.toLowerCase()} copiando lo que ve. El problema es que no sabe por qué funciona. Primero entendé el objetivo, después elegí la forma.` },
    { title: "Lo que realmente funciona", detail: `Enfocate en una sola cosa a la vez. Elegí el paso más simple, hacelo bien durante una semana y medí qué cambió. Eso vale más que diez tips sueltos.` },
    { title: "Un ejemplo concreto", detail: `Te muestro cómo lo aplico yo: lo hago siempre a la misma hora, con una plantilla armada, y reviso los resultados cada viernes. Sin magia, con constancia.` },
    { title: "El atajo que te ahorra tiempo", detail: `Armate una checklist de tres pasos y tenela a mano. Cuando tenés el proceso escrito, dejás de depender de la motivación.` },
  ];

  const ctas = [
    "Guardá este video para tenerlo a mano y seguime para la parte 2.",
    "Comentá «QUIERO» y te mando la plantilla que uso.",
    "Mandáselo a alguien que lo necesita y seguime para más.",
  ];

  const titleTemplates = [
    `${capitalize(topic)}: lo que nadie te dice`,
    `${capitalize(topic)} explicado fácil`,
    `Cómo mejorar en ${topic.toLowerCase()} (sin complicarte)`,
  ];

  const usedPoints = format === "long" ? points : format === "story" ? points.slice(1, 3) : points.slice(0, 3);

  return {
    topic: input.topic,
    title: pick(titleTemplates),
    hook: pick(hooks),
    points: usedPoints,
    closing: `En resumen: ${topic.toLowerCase()} no se trata de hacer más, sino de hacer lo correcto de forma constante. Si ${who === "vos" ? "empezás" : `${who} empieza`} hoy con un solo paso, en un mes vas a notar la diferencia.`,
    cta: pick(ctas),
    durationSec,
    format,
    formatReason: reason,
  };
}

// ---------------------------------------------------------------------------
// Carousels
// ---------------------------------------------------------------------------

export type CarouselInput = { topic: string; audience?: string; slideCount: number };

export async function writeCarousel(
  input: CarouselInput
): Promise<{ title: string; slides: CarouselSlide[]; source: AISource }> {
  if (useRealAI()) {
    try {
      const system = `Sos estratega de contenido para carruseles de Instagram. ${TONE}
Respondé SOLO con JSON válido: { "title": string, "slides": { "kind": "hook" | "content" | "cta", "title": string, "body": string }[] }
- Exactamente ${input.slideCount} filminas.
- La primera es "hook": un gancho que frene el scroll (title máx 8 palabras, body una frase corta que genere curiosidad).
- Las del medio son "content": cada una desarrolla UNA idea (title máx 7 palabras, body máx 35 palabras).
- La última es "cta": cierre con llamada a la acción concreta (guardar, compartir, comentar o seguir).`;
      const user = `Tema: ${input.topic}${input.audience ? `\nAudiencia: ${input.audience}` : ""}`;
      const raw = (await chatJSON(system, user)) as { title?: string; slides?: CarouselSlide[] };
      const slides = (raw.slides ?? [])
        .filter((s) => s && typeof s.title === "string")
        .map((s, i, arr) => ({
          kind: (i === 0 ? "hook" : i === arr.length - 1 ? "cta" : "content") as CarouselSlide["kind"],
          title: String(s.title).slice(0, 300),
          body: String(s.body ?? "").slice(0, 1200),
        }));
      if (slides.length >= 3) return { title: raw.title || input.topic, slides, source: "ai" };
      throw new Error("AI returned too few slides");
    } catch (err) {
      console.error("[social/ai] carousel falling back to demo writer:", err);
    }
  }
  return { ...demoCarousel(input), source: "demo" };
}

export function demoCarousel(input: CarouselInput): { title: string; slides: CarouselSlide[] } {
  const topic = input.topic.trim().replace(/[.!?]+$/, "");
  const t = topic.toLowerCase();
  const middleCount = input.slideCount - 2;

  const content: CarouselSlide[] = [
    { kind: "content", title: "Primero, el porqué", body: `Antes de meterte con ${t}, definí qué querés lograr. Un objetivo claro te dice qué hacer y, sobre todo, qué dejar de hacer.` },
    { kind: "content", title: "Empezá por lo simple", body: "Elegí el paso más chico que puedas hacer hoy. La constancia le gana a la intensidad: diez minutos diarios valen más que un día perfecto." },
    { kind: "content", title: "El error que todos cometen", body: "Querer resultados en una semana. Los primeros cambios se notan después de un mes: medí, ajustá y seguí." },
    { kind: "content", title: "Armate un sistema", body: "Una checklist corta, un horario fijo y una plantilla. Cuando el proceso está escrito, no dependés de la motivación." },
    { kind: "content", title: "Medí lo que importa", body: "Elegí un solo número para seguir cada semana. Si mejora, vas bien. Si no, cambiá una cosa por vez." },
    { kind: "content", title: "Aprendé de quien ya lo hizo", body: "Buscá tres referentes y fijate qué tienen en común. Copiá el principio, no la forma." },
    { kind: "content", title: "Celebrá el progreso", body: "Anotá cada pequeño avance. Ver el camino recorrido es lo que te mantiene cuando cuesta." },
    { kind: "content", title: "Pedí feedback", body: "Mostralo antes de que esté perfecto. Una opinión honesta a tiempo te ahorra semanas." },
  ];

  return {
    title: capitalize(topic),
    slides: [
      { kind: "hook", title: `${capitalize(topic)}: lo que nadie te explica`, body: "Deslizá y guardalo, porque lo vas a necesitar →" },
      ...content.slice(0, middleCount).map((s, i) => ({ ...s, title: `${i + 1}. ${s.title}` })),
      { kind: "cta", title: "¿Te sirvió?", body: "Guardalo para tenerlo a mano, compartilo con quien lo necesite y seguime para más contenido así." },
    ],
  };
}
