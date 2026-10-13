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

const REEL_RULES = `Sos el mejor guionista de reels y TikToks del mundo: tus videos retienen hasta el último segundo y se comparten.
Reglas que siempre cumplís:
- Gancho en el primer segundo (máx. 12 palabras): curiosidad, contradicción, número concreto, resultado sorprendente o llamado directo a quien mira. Nunca arranques con "Hola", "Hoy les voy a hablar" ni presentaciones.
- Además del gancho hablado, proponé un texto en pantalla corto (máx. 6 palabras) que refuerce el gancho.
- Un solo mensaje por video. Cada punto es una idea, en frases cortas para decir a cámara, con un ejemplo concreto o un dato.
- Cambio de ritmo cada 3-5 segundos: cada punto trae su texto en pantalla o indicación visual (plano, gesto, b-roll) entre corchetes cuando ayude.
- Abrí un bucle al principio ("el último es el que más me cambió") y cerralo al final para que miren hasta el final.
- Cierre que entregue la promesa del gancho en una frase.
- Llamada a la acción específica y fácil: comentar una palabra clave, guardar o compartir con alguien puntual. Una sola acción.
- Reel corto por defecto (20-45 s). Video largo solo si el tema realmente necesita explicación paso a paso (TikTok largo, 1-3 min). Historia si es algo cercano, del momento o de detrás de escena.`;

export async function writeScript(input: ScriptInput): Promise<{ script: ScriptData; source: AISource }> {
  if (useRealAI()) {
    try {
      const system = `${REEL_RULES}
${TONE}
Respondé SOLO con JSON válido con esta forma:
{ "title": string, "hook": string, "hookOnScreen": string, "points": { "title": string, "detail": string, "onScreen": string }[], "closing": string, "cta": string, "durationSec": number, "format": "reel" | "long" | "story", "formatReason": string }
- "points": 3 a 5 puntos (3 para reels de menos de 40 s). "detail" es lo que se dice literal; "onScreen" es el texto en pantalla o la indicación visual.
- "durationSec": duración sugerida en segundos, coherente con el formato y con la cantidad de texto.
- "formatReason": una frase explicando por qué ese formato le conviene.`;
      const user = `Tema del video: ${input.topic}
${input.audience ? `Audiencia: ${input.audience}` : ""}
${input.network ? `Red principal: ${input.network === "tiktok" ? "TikTok" : "Instagram Reels"}` : "Red principal: Instagram Reels y TikTok"}`;
      const raw = (await chatJSON(system, user)) as Record<string, unknown>;
      const parsed = scriptSchema.parse({ ...raw, topic: input.topic, durationSec: Math.round(Number(raw.durationSec)) });
      return { script: parsed, source: "ai" };
    } catch (err) {
      console.error("[social/ai] script falling back to demo writer:", err);
    }
  }
  return { script: demoScript(input), source: "demo" };
}

function pickFormat(topic: string): { format: ScriptFormat; durationSec: number; reason: string } {
  const t = topic.toLowerCase();
  if (/(paso a paso|guía completa|guia completa|tutorial completo|explicado a fondo|curso)/.test(t)) {
    return {
      format: "long",
      durationSec: 120,
      reason: "El tema necesita mostrar cada paso: un TikTok largo de 2 minutos te deja explicarlo bien y posicionarte como referente.",
    };
  }
  if (/(detrás|detras|mi día|mi dia|rutina|encuesta|novedad|anuncio|backstage|hoy)/.test(t)) {
    return {
      format: "story",
      durationSec: 30,
      reason: "Es un contenido cercano y del momento: en historias se siente auténtico y genera respuestas directas.",
    };
  }
  return {
    format: "reel",
    durationSec: 35,
    reason: "Es una idea concreta que se entiende rápido: un reel de 35 segundos maximiza retención, alcance y veces que lo comparten.",
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function demoScript(input: ScriptInput): ScriptData {
  const topic = input.topic.trim().replace(/[.!?]+$/, "");
  const rand = seededRandom(topic + Date.now());
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const { format, durationSec, reason } = pickFormat(topic);
  const t = topic.toLowerCase();

  const T = capitalize(topic);
  const hooks: [string, string][] = [
    [`¿${T}? El 90% lo hace mal. Mirá por qué.`, "El 90% falla acá"],
    [`${T}: 3 cosas que nadie te cuenta. La última es la clave.`, "Nadie te dice esto 🤫"],
    [`Me costó años entender esto. ${T}, resumido en 30 segundos.`, "Ojalá lo sabía antes"],
    [`Si estás con esto, frená: ${t}. Hay un error que te está frenando.`, "Dejá de hacer esto ❌"],
  ];
  const [hook, hookOnScreen] = pick(hooks);

  const points = [
    { title: "El error", detail: "Todos copian lo que ven sin entender por qué funciona. Por eso no les da resultado.", onScreen: "[Plano cerrado] ERROR #1: copiar sin entender" },
    { title: "Lo que sí funciona", detail: "Elegí una sola cosa, hacela siete días seguidos y medí qué cambió. Una cosa bien hecha le gana a diez a medias.", onScreen: "1 cosa × 7 días ✅" },
    { title: "Ejemplo real", detail: "Yo lo hago siempre a la misma hora, con una plantilla armada, y reviso los números cada viernes.", onScreen: "[B-roll de tu pantalla/plantilla]" },
    { title: "La clave (la última)", detail: "Escribí tu proceso en tres pasos. Cuando está escrito, dejás de depender de la motivación.", onScreen: "Proceso escrito = constancia" },
  ];
  const usedPoints = format === "long" ? points : points.slice(0, 3).map((p, i) => (i === 2 ? points[3] : p));

  const ctas = [
    "Comentá «PLAN» y te paso la plantilla que uso.",
    "Guardalo para cuando lo necesites y mandáselo a alguien que lo tenga que ver.",
    "Seguime para la parte 2: ahí te muestro cómo lo aplico paso a paso.",
  ];

  const titles = [`${T}: lo que nadie te dice`, `${T}: el error #1`, `${T} en 30 segundos`];

  return {
    topic: input.topic,
    title: pick(titles),
    hook,
    hookOnScreen,
    points: usedPoints,
    closing: "No se trata de hacer más, sino de hacer lo correcto todos los días. Empezá hoy con un solo paso.",
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
      const system = `Sos el mejor estratega de carruseles de Instagram y TikTok del mundo: tus carruseles se guardan y se comparten. ${TONE}
- El gancho frena el scroll: promesa concreta, número, contradicción o error común. Nada genérico.
- Cada filmina deja con ganas de pasar a la siguiente; ideas accionables, ejemplos concretos, cero relleno.
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
    { kind: "content", title: "Primero, el porqué", body: "Antes de arrancar, definí qué querés lograr. Un objetivo claro te dice qué hacer y, sobre todo, qué dejar de hacer." },
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
