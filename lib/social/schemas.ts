import { z } from "zod";
import { NETWORKS, POST_STATUSES, SCRIPT_FORMATS, type SocialKind } from "./types";

const network = z.enum(NETWORKS);
const count = z.number().int().min(0).max(10_000_000_000);

export const postSchema = z.object({
  title: z.string().trim().min(1, "Poné un título").max(200),
  caption: z.string().max(5000).optional(),
  network,
  status: z.enum(POST_STATUSES),
  scheduledAt: z.string().datetime({ offset: true }),
  imageUrl: z.string().max(2000).optional(),
  metrics: z.object({ views: count, likes: count, comments: count, shares: count }).optional(),
});

export const ideaSchema = z.object({
  text: z.string().trim().min(1, "Escribí la idea").max(2000),
  network: network.optional(),
  tag: z.string().max(40).optional(),
  pinned: z.boolean().optional(),
});

export const scriptSchema = z.object({
  topic: z.string().max(500),
  title: z.string().min(1).max(200),
  hook: z.string().max(2000),
  points: z.array(z.object({ title: z.string().max(200), detail: z.string().max(2000) })).max(12),
  closing: z.string().max(2000),
  cta: z.string().max(1000),
  durationSec: z.number().int().min(5).max(7200),
  format: z.enum(SCRIPT_FORMATS),
  formatReason: z.string().max(1000),
});

export const carouselSchema = z.object({
  topic: z.string().max(500),
  title: z.string().min(1).max(200),
  styleId: z.string().max(40),
  handle: z.string().max(60),
  slides: z
    .array(
      z.object({
        kind: z.enum(["hook", "content", "cta"]),
        title: z.string().max(300),
        body: z.string().max(1200),
      })
    )
    .min(1)
    .max(20),
});

export const profileSchema = z.object({
  handle: z.string().max(60),
  followers: z.object({ instagram: count, tiktok: count, youtube: count }),
});

export const SCHEMA_BY_KIND: Record<SocialKind, z.ZodTypeAny> = {
  POST: postSchema,
  IDEA: ideaSchema,
  SCRIPT: scriptSchema,
  CAROUSEL: carouselSchema,
  PROFILE: profileSchema,
};

export const scriptRequestSchema = z.object({
  topic: z.string().trim().min(3, "Contame un poco más del tema").max(500),
  audience: z.string().max(200).optional(),
  network: network.optional(),
});

export const carouselRequestSchema = z.object({
  topic: z.string().trim().min(3, "Contame un poco más del tema").max(500),
  audience: z.string().max(200).optional(),
  slideCount: z.number().int().min(4).max(10),
});
