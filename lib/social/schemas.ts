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
  carouselId: z.string().max(60).optional(),
  videoUrl: z.string().max(2000).optional(),
  autoPublish: z.boolean().optional(),
  ig: z
    .object({
      containerId: z.string().max(100).optional(),
      mediaId: z.string().max(100).optional(),
      permalink: z.string().max(500).optional(),
      error: z.string().max(1000).optional(),
      publishedAt: z.string().max(40).optional(),
    })
    .optional(),
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
  hookOnScreen: z.string().max(300).optional(),
  points: z
    .array(z.object({ title: z.string().max(200), detail: z.string().max(2000), onScreen: z.string().max(500).optional() }))
    .max(12),
  closing: z.string().max(2000),
  cta: z.string().max(1000),
  durationSec: z.number().int().min(5).max(7200),
  format: z.enum(SCRIPT_FORMATS),
  formatReason: z.string().max(1000),
  altHooks: z.array(z.string().max(500)).max(6).optional(),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string().max(60)).max(15).optional(),
  whyShare: z.string().max(1000).optional(),
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
  caption: z.string().max(2200).optional(),
});

const brandText = z.string().max(2000);
export const brandSchema = z.object({
  name: brandText,
  niche: brandText,
  audience: brandText,
  tone: brandText,
  offer: brandText,
  cta: z.string().max(200),
  pains: brandText,
  rules: brandText,
  mix: brandText,
});

export const profileSchema = z.object({
  handle: z.string().max(60),
  followers: z.object({ instagram: count, tiktok: count }),
  brand: brandSchema.optional(),
});

export const autopilotSchema = z.object({
  enabled: z.boolean(),
  carouselsPerDay: z.number().int().min(0).max(3),
  scriptsPerDay: z.number().int().min(0).max(3),
  publishHour: z.number().int().min(0).max(23),
  styleId: z.string().max(40),
  autoPublish: z.boolean(),
  lastRunDay: z.string().max(20).optional(),
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
