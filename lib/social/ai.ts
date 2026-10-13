import { scriptSchema } from "./schemas";
import { DEFAULT_BRAND, brandPrompt } from "./brand";
import type { BrandData, CarouselSlide, Network, ScriptData, ScriptFormat } from "./types";
import { seededRandom } from "./demo";

/**
 * AI writers for the social hub. Any OpenAI-compatible chat endpoint works
 * (AI_API_KEY / AI_MODEL / AI_API_URL) — e.g. Google Gemini's free tier.
 * Without a key, in DEMO_MODE, or if the call fails, a template writer is used
 * so the flow always works.
 */

export type AISource = "ai" | "demo";

const TONE = `Escribís en español rioplatense, con voseo. Cercano, como si le hablaras a un amigo: frases cortas, concretas, sin relleno ni clichés de marketing.`;

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
      temperature: 0.85,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI provider responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned empty content");
  // Some models wrap JSON in ``` fences even in JSON mode.
  return JSON.parse(content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, ""));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const strArr = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, max).map(String) : undefined;

// ---------------------------------------------------------------------------
// Video scripts
// ---------------------------------------------------------------------------

export type ScriptInput = { topic: string; audience?: string; network?: Network; brand?: BrandData };

const REEL_RULES = `Sos el mejor guionista de reels y TikToks del mundo: tus videos retienen hasta el último segundo y generan guardados, compartidos y comentarios.
Reglas que siempre cumplís:
- El algoritmo premia retención, guardados, compartidos y comentarios: todo se diseña para eso.
- Gancho de 0-3 s: frase hablada + texto en pantalla de máx. 8 palabras. Curiosidad, contradicción, tensión emocional, especificidad o autoridad sutil. Nunca arranques con "Hola" ni presentaciones.
- Desarrollo: frases de menos de 12 palabras, cada línea engancha la siguiente, cortes cada 1-2 s, nada promocional.
- Indicaciones de grabación entre paréntesis dentro del texto cuando ayuden.
- Abrí un bucle al principio y cerralo al final.
- Cierre con UNA llamada a la acción concreta.
- Reel corto por defecto (15-30 s). Video largo solo si el tema necesita paso a paso. Historia si es algo del momento o detrás de escena.`;

export async function writeScript(input: ScriptInput): Promise<{ script: ScriptData; source: AISource }> {
  const brand = input.brand ?? DEFAULT_BRAND;
  if (useRealAI()) {
    try {
      const system = `${REEL_RULES}
${TONE}
${brandPrompt(brand)}
Respondé SOLO con JSON válido con esta forma:
{ "title": string, "hook": string, "hookOnScreen": string, "altHooks": string[], "points": { "title": string, "detail": string, "onScreen": string }[], "closing": string, "cta": string, "durationSec": number, "format": "reel" | "long" | "story", "formatReason": string, "caption": string, "hashtags": string[], "whyShare": string }
- "altHooks": 3 ganchos alternativos.
- "points": 3 a 5 puntos. "detail" es lo que se dice literal; "onScreen" el texto en pantalla o indicación visual.
- "caption": caption corta para el post (sin hashtags). "hashtags": 3 a 5 hashtags de nicho, con #.
- "whyShare": por qué alguien lo guardaría o compartiría.
- "durationSec": duración sugerida en segundos.`;
      const user = `Tema del video: ${input.topic}
${input.audience ? `Audiencia específica: ${input.audience}` : ""}
Red principal: ${input.network === "tiktok" ? "TikTok" : input.network === "instagram" ? "Instagram Reels" : "Instagram Reels y TikTok"}`;
      const raw = (await chatJSON(system, user)) as Record<string, unknown>;
      const parsed = scriptSchema.parse({
        ...raw,
        topic: input.topic,
        durationSec: Math.max(5, Math.round(Number(raw.durationSec) || 30)),
        format: ["reel", "long", "story"].includes(String(raw.format)) ? raw.format : "reel",
        formatReason: String(raw.formatReason ?? ""),
        altHooks: strArr(raw.altHooks, 6),
        hashtags: strArr(raw.hashtags, 15),
      });
      return { script: parsed, source: "ai" };
    } catch (err) {
      console.error("[social/ai] script falling back to demo writer:", err);
    }
  }
  return { script: demoScript({ ...input, brand }), source: "demo" };
}

function pickFormat(topic: string): { format: ScriptFormat; durationSec: number; reason: string } {
  const t = topic.toLowerCase();
  if (/(paso a paso|guía completa|guia completa|tutorial completo|explicado a fondo|curso)/.test(t)) {
    return {
      format: "long",
      durationSec: 90,
      reason: "El tema necesita mostrar cada paso: un video de 1-2 minutos te deja explicarlo bien.",
    };
  }
  if (/(detrás|detras|mi día|mi dia|rutina|encuesta|novedad|anuncio|backstage|hoy)/.test(t)) {
    return {
      format: "story",
      durationSec: 20,
      reason: "Es algo cercano y del momento: en historias se siente auténtico y genera respuestas directas.",
    };
  }
  return {
    format: "reel",
    durationSec: 25,
    reason: "Idea concreta que se entiende rápido: un reel de 15-30 s maximiza retención y alcance.",
  };
}

export function demoScript(input: ScriptInput): ScriptData {
  const brand = input.brand ?? DEFAULT_BRAND;
  const topic = input.topic.trim().replace(/[.!?]+$/, "");
  const rand = seededRandom(topic + Date.now());
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const { format, durationSec, reason } = pickFormat(topic);
  const T = capitalize(topic);
  const t = topic.toLowerCase();

  const hooks: [string, string][] = [
    [`¿${T}? Nadie te lo explica así.`, "Nadie te dice esto"],
    [`Si tenés 18 y pensás en ${t}, mirá esto.`, "Si tenés 18, frená"],
    [`Me daba vergüenza contarlo, pero ${t} me cambió la cabeza.`, "Me daba vergüenza"],
    [`Esto de ${t} es lo que nadie te cuenta en el secundario.`, "Esto no te lo enseñan"],
  ];
  const chosen = pick(hooks);

  return {
    topic: input.topic,
    title: pick([`${T}: lo que nadie te dice`, `${T} en 30 segundos`, `${T}, sin humo`]),
    hook: chosen[0],
    hookOnScreen: chosen[1],
    altHooks: hooks.filter((h) => h !== chosen).slice(0, 3).map((h) => h[0]),
    points: [
      { title: "El dolor", detail: "(Plano cerrado) Pedirle plata a tus viejos da vergüenza. Lo sé.", onScreen: "La vergüenza de pedir plata" },
      { title: "El cambio", detail: "(Corte) Un día dejé de esperar. Empecé a aprender algo nuevo.", onScreen: "Dejé de esperar" },
      { title: "La verdad", detail: "(Mirando a cámara) No es magia. Es aprender y ser constante.", onScreen: "No es magia" },
    ],
    closing: "Si estás donde yo estaba, esto es para vos.",
    cta: `${brand.cta} y te cuento cómo arranqué.`,
    durationSec,
    format,
    formatReason: reason,
    caption: `${T}. Sin humo, sin promesas raras. ${brand.cta} 👇`,
    hashtags: ["#ganardinero", "#emprenderjoven", "#trabajodesdecasa", "#argentina"],
    whyShare: "Se identifica con el dolor y se lo manda a un amigo que está igual.",
  };
}

// ---------------------------------------------------------------------------
// Carousels
// ---------------------------------------------------------------------------

export type CarouselInput = { topic: string; audience?: string; slideCount: number; brand?: BrandData };

export async function writeCarousel(
  input: CarouselInput
): Promise<{ title: string; slides: CarouselSlide[]; caption: string; source: AISource }> {
  const brand = input.brand ?? DEFAULT_BRAND;
  if (useRealAI()) {
    try {
      const system = `Sos el mejor estratega de carruseles de Instagram del mundo: tus carruseles se guardan, se comparten y llenan los comentarios. ${TONE}
${brandPrompt(brand)}
- El gancho frena el scroll: dolor real, contradicción o promesa concreta (sin inventar cifras). Nada genérico.
- Cada filmina deja con ganas de pasar a la siguiente; ideas simples, ejemplos concretos, cero relleno.
Respondé SOLO con JSON válido: { "title": string, "caption": string, "slides": { "kind": "hook" | "content" | "cta", "title": string, "body": string }[] }
- Exactamente ${input.slideCount} filminas.
- La primera es "hook" (title máx. 8 palabras, body una frase corta que genere curiosidad).
- Las del medio son "content": UNA idea cada una (title máx. 7 palabras, body máx. 30 palabras).
- La última es "cta": cierre con "${brand.cta}" y una razón concreta.
- "caption": caption para el post con 3-5 hashtags de nicho al final.`;
      const user = `Tema: ${input.topic}${input.audience ? `\nAudiencia específica: ${input.audience}` : ""}`;
      const raw = (await chatJSON(system, user)) as { title?: string; caption?: string; slides?: CarouselSlide[] };
      const slides = (raw.slides ?? [])
        .filter((s) => s && typeof s.title === "string")
        .slice(0, 20)
        .map((s, i, arr) => ({
          kind: (i === 0 ? "hook" : i === arr.length - 1 ? "cta" : "content") as CarouselSlide["kind"],
          title: String(s.title).slice(0, 300),
          body: String(s.body ?? "").slice(0, 1200),
        }));
      if (slides.length >= 3) {
        return {
          title: String(raw.title || input.topic).slice(0, 200),
          slides,
          caption: String(raw.caption ?? "").slice(0, 2200),
          source: "ai",
        };
      }
      throw new Error("AI returned too few slides");
    } catch (err) {
      console.error("[social/ai] carousel falling back to demo writer:", err);
    }
  }
  return { ...demoCarousel({ ...input, brand }), source: "demo" };
}

export function demoCarousel(input: CarouselInput): { title: string; slides: CarouselSlide[]; caption: string } {
  const brand = input.brand ?? DEFAULT_BRAND;
  const topic = input.topic.trim().replace(/[.!?]+$/, "");
  const middleCount = input.slideCount - 2;
  const content: CarouselSlide[] = [
    { kind: "content", title: "El problema", body: "Terminás el secundario y nadie te dice qué hacer. Y pedir plata en casa da vergüenza." },
    { kind: "content", title: "Lo que nadie te cuenta", body: "No necesitás un título para aprender algo que te sirva. Necesitás empezar." },
    { kind: "content", title: "El error más común", body: "Esperar a tener todo claro. Nadie arranca sabiendo. Se aprende haciendo." },
    { kind: "content", title: "Lo que sí funciona", body: "Aprender una habilidad, practicarla todos los días y no compararte con nadie." },
    { kind: "content", title: "Si se ríen de vos", body: "Es normal. Los que se ríen hoy, mañana te preguntan cómo hiciste." },
    { kind: "content", title: "Tu primer paso", body: "Elegí hoy una cosa para aprender. Una sola. Y dale 30 días." },
    { kind: "content", title: "Sin humo", body: "No hay plata fácil. Hay aprender, constancia y paciencia." },
    { kind: "content", title: "Tu lugar", body: "Lo que querés es tu independencia. Se construye de a poco." },
  ];
  return {
    title: capitalize(topic),
    slides: [
      { kind: "hook", title: capitalize(topic), body: "Deslizá. Esto es para vos si tenés 17-22 →" },
      ...content.slice(0, middleCount).map((s, i) => ({ ...s, title: `${i + 1}. ${s.title}` })),
      { kind: "cta", title: "¿Querés arrancar?", body: `${brand.cta} y te cuento por dónde empezar.` },
    ],
    caption: `${capitalize(topic)}. Guardalo y mandáselo a quien lo necesite. ${brand.cta} 👇\n\n#ganardinero #emprenderjoven #trabajodesdecasa #argentina`,
  };
}

// ---------------------------------------------------------------------------
// Topic planning (autopilot)
// ---------------------------------------------------------------------------

const DEMO_TOPICS = [
  "La vergüenza de pedirle plata a tus viejos",
  "Qué hacer después del secundario si no sabés qué estudiar",
  "Por qué un laburo de 8 horas mal pago no es tu única opción",
  "Cuando se ríen de vos por intentar algo distinto",
  "Cómo empezar a generar ingresos online sin experiencia",
  "Lo que nadie te dice de ser afiliado",
  "Mi rutina para aprender algo nuevo todos los días",
  "Objeción: ¿esto es una estafa?",
  "Objeción: ¿necesito plata para empezar?",
  "Querer tu propio lugar a los 18",
];

export async function suggestTopics(brand: BrandData, count: number, avoid: string[]): Promise<string[]> {
  if (count <= 0) return [];
  if (useRealAI()) {
    try {
      const system = `Sos estratega de contenido para Instagram y TikTok. ${brandPrompt(brand)}
Respondé SOLO con JSON: { "topics": string[] } con exactamente ${count} temas nuevos para publicar, respetando la mezcla de contenido. Cada tema en una frase corta y concreta.`;
      const user = `No repitas estos temas recientes:\n${avoid.slice(0, 40).join("\n") || "(ninguno)"}`;
      const raw = (await chatJSON(system, user)) as { topics?: unknown };
      const topics = strArr(raw.topics, count);
      if (topics?.length) return topics;
    } catch (err) {
      console.error("[social/ai] topics falling back to demo list:", err);
    }
  }
  const lower = new Set(avoid.map((a) => a.toLowerCase()));
  const fresh = DEMO_TOPICS.filter((t) => !lower.has(t.toLowerCase()));
  const pool = fresh.length >= count ? fresh : DEMO_TOPICS;
  const start = Math.floor(Math.random() * pool.length);
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}
