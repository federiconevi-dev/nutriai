export const NETWORKS = ["instagram", "tiktok"] as const;
export type Network = (typeof NETWORKS)[number];

export const POST_STATUSES = ["draft", "ready", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const SOCIAL_KINDS = ["POST", "IDEA", "SCRIPT", "CAROUSEL", "PROFILE"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];

export type PostMetrics = { views: number; likes: number; comments: number; shares: number };

export type PostData = {
  title: string;
  caption?: string;
  network: Network;
  status: PostStatus;
  /** ISO timestamp */
  scheduledAt: string;
  imageUrl?: string;
  metrics?: PostMetrics;
};

export type IdeaData = {
  text: string;
  network?: Network;
  tag?: string;
  pinned?: boolean;
};

export const SCRIPT_FORMATS = ["reel", "long", "story"] as const;
export type ScriptFormat = (typeof SCRIPT_FORMATS)[number];

export type ScriptData = {
  topic: string;
  title: string;
  hook: string;
  /** Short text overlay for the first second. */
  hookOnScreen?: string;
  points: { title: string; detail: string; onScreen?: string }[];
  closing: string;
  cta: string;
  durationSec: number;
  format: ScriptFormat;
  formatReason: string;
};

export type CarouselSlideKind = "hook" | "content" | "cta";
export type CarouselSlide = { kind: CarouselSlideKind; title: string; body: string };

export type CarouselData = {
  topic: string;
  title: string;
  styleId: string;
  handle: string;
  slides: CarouselSlide[];
};

export type ProfileData = {
  handle: string;
  followers: Record<Network, number>;
};

export type SocialDataByKind = {
  POST: PostData;
  IDEA: IdeaData;
  SCRIPT: ScriptData;
  CAROUSEL: CarouselData;
  PROFILE: ProfileData;
};

export type SocialItem<K extends SocialKind = SocialKind> = {
  id: string;
  kind: K;
  data: SocialDataByKind[K];
  createdAt: string;
  updatedAt: string;
};

export const NETWORK_META: Record<Network, { label: string; color: string }> = {
  // Validated as a categorical set against the dark surface (CVD + contrast).
  instagram: { label: "Instagram", color: "#db2777" },
  tiktok: { label: "TikTok", color: "#0891b2" },
};

export const STATUS_META: Record<PostStatus, { label: string; className: string }> = {
  draft: { label: "Borrador", className: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/20" },
  ready: { label: "Listo", className: "bg-amber-500/15 text-amber-300 ring-amber-400/25" },
  published: { label: "Publicado", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25" },
};

export const FORMAT_META: Record<ScriptFormat, { label: string; short: string }> = {
  reel: { label: "Reel corto", short: "Reel" },
  long: { label: "Video largo", short: "Video largo" },
  story: { label: "Historia", short: "Historia" },
};
