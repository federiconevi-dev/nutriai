import type { IdeaData, Network, PostData, PostStatus, ProfileData, SocialKind } from "./types";

/** Small deterministic PRNG so demo data is stable for a given seed. */
export function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITLES: Record<Network, string[]> = {
  instagram: [
    "5 hábitos que cambiaron mi mañana",
    "Mi setup de trabajo 2026",
    "Antes y después: rediseño de marca",
    "Carrusel: errores al empezar en redes",
    "Reel: 3 hooks que frenan el scroll",
    "Detrás de escena de la sesión de fotos",
    "Q&A: respondo sus preguntas",
    "Tips para fotos con el celular",
  ],
  tiktok: [
    "El truco de 3 segundos para retener",
    "POV: tu primer cliente",
    "Reacciono a tendencias de la semana",
    "Un día conmigo en 60 segundos",
    "3 apps que uso todos los días",
    "Este error me costó seguidores",
    "Respuesta a comentario: ¿cómo empiezo?",
    "Tutorial rápido: editá un reel en 5 min",
    "Lo que nadie te dice de crecer en TikTok",
  ],
};

const CAPTIONS = [
  "Guardalo para cuando lo necesites 📌",
  "¿Cuál te sirvió más? Te leo en comentarios 👇",
  "Mandáselo a alguien que lo necesita.",
  "Parte 1 de una serie nueva. ¿Quieren la parte 2?",
];

function atHour(base: Date, dayOffset: number, hour: number, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Initial demo content so the hub is never empty on first visit. */
export function buildDemoContent(seed: string, now = new Date()) {
  const rand = seededRandom(seed);
  const items: { kind: SocialKind; data: unknown }[] = [];
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const profile: ProfileData = {
    handle: "federicomarketingg",
    followers: { instagram: 48_250, tiktok: 126_400 },
  };
  items.push({ kind: "PROFILE", data: profile });

  const networks: Network[] = ["instagram", "tiktok"];
  const used = new Set<string>();
  const nextTitle = (n: Network) => {
    const options = TITLES[n].filter((t) => !used.has(t));
    const title = options.length ? pick(options) : pick(TITLES[n]);
    used.add(title);
    return title;
  };

  // Published posts across the last ~60 days, with performance numbers.
  const pastOffsets = [-58, -51, -46, -40, -33, -27, -22, -16, -12, -9, -6, -4, -2, -1];
  pastOffsets.forEach((offset, i) => {
    const network = networks[i % 2];
    const base = network === "tiktok" ? 42_000 : 16_000;
    const growth = 1 + (60 + offset) / 90; // recent posts perform a bit better
    const views = Math.round(base * growth * (0.55 + rand() * 1.1));
    const likes = Math.round(views * (0.04 + rand() * 0.05));
    const post: PostData = {
      title: nextTitle(network),
      caption: pick(CAPTIONS),
      network,
      status: "published",
      scheduledAt: atHour(now, offset, 18 + (i % 3), 30).toISOString(),
      imageUrl: `https://picsum.photos/seed/vx-${seed.slice(0, 6)}-${i}/640/800`,
      metrics: {
        views,
        likes,
        comments: Math.round(likes * (0.05 + rand() * 0.08)),
        shares: Math.round(likes * (0.08 + rand() * 0.15)),
      },
    };
    items.push({ kind: "POST", data: post });
  });

  // Upcoming posts this month and next.
  const futureOffsets = [0, 1, 2, 3, 5, 6, 8, 10, 13, 15, 18, 21, 24, 27];
  futureOffsets.forEach((offset, i) => {
    const network = networks[(i + 1) % 2];
    const status: PostStatus = offset <= 3 ? "ready" : i % 3 === 0 ? "ready" : "draft";
    const post: PostData = {
      title: nextTitle(network),
      caption: pick(CAPTIONS),
      network,
      status,
      scheduledAt: atHour(now, offset, 10 + (i % 4) * 3).toISOString(),
      imageUrl: `https://picsum.photos/seed/vx-${seed.slice(0, 6)}-up-${i}/640/800`,
    };
    items.push({ kind: "POST", data: post });
  });

  const ideas: IdeaData[] = [
    { text: "Serie semanal: 'Lo que nadie te dice de…' con un tema distinto cada lunes", network: "tiktok", tag: "Serie", pinned: true },
    { text: "Mostrar mi proceso de edición completo en un reel acelerado", network: "tiktok", tag: "Reel" },
    { text: "Carrusel con las 7 herramientas gratis que más uso", network: "instagram", tag: "Carrusel" },
    { text: "Responder los 10 comentarios más repetidos en un solo video", tag: "Comunidad" },
    { text: "Colaboración con otra creadora del rubro — proponer live", network: "instagram", tag: "Collab" },
  ];
  ideas.forEach((data) => items.push({ kind: "IDEA", data }));

  return items;
}
