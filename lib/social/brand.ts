import type { AutopilotSettings, BrandData } from "./types";

/** FedericoMarketing brand profile — editable from Ajustes. */
export const DEFAULT_BRAND: BrandData = {
  name: "Fede · @federicomarketingg",
  niche: "Hacer plata desde casa siendo joven, vendiendo una membresía como afiliado.",
  audience: "Pibes de 17 a 22 años de Argentina, sin laburo o con laburos mal pagos.",
  tone: "Argentino, voseo, informal, cercano. Nada de gurú ni de promesas mágicas.",
  offer: "Membresía para aprender a generar ingresos online como afiliado.",
  cta: "Comentá INFO",
  pains:
    "Vergüenza de pedirle plata a tus viejos. No saber qué hacer después del secundario. Laburo de 8 horas mal pago. Que se rían de vos por intentarlo. Querer tu propio lugar.",
  rules:
    "Prohibido inventar ingresos, cifras o testimonios. Frases de menos de 12 palabras. Hook de 0-3 s con texto en pantalla de máx. 8 palabras. Indicaciones de grabación entre paréntesis. Videos de 15-30 s con subtítulos.",
  mix: "40% dolor/identificación, 30% educación simple, 20% objeciones de la membresía, 10% detrás de escena. El formato que más INFO trae: carrusel de 2 fotos dolor/solución.",
};

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  carouselsPerDay: 1,
  scriptsPerDay: 1,
  publishHour: 18,
  styleId: "noche",
  autoPublish: true,
};

export function brandPrompt(b: BrandData) {
  return `MARCA PARA LA QUE ESCRIBÍS
- Quién: ${b.name}
- Nicho: ${b.niche}
- Público: ${b.audience}
- Tono: ${b.tone}
- Qué ofrece: ${b.offer}
- Llamada a la acción SIEMPRE: "${b.cta}" con una razón concreta.
- Dolores del público para usar: ${b.pains}
- Reglas obligatorias: ${b.rules}
- Mezcla de contenido: ${b.mix}`;
}
