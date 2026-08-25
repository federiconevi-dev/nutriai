import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

export const videoTypeEnum = z.enum([
  "PRODUCT_AD",
  "TIKTOK",
  "INSTAGRAM_REEL",
  "YOUTUBE_SHORT",
  "YOUTUBE",
  "UGC",
  "CINEMATIC",
  "EDUCATIONAL",
]);

export const videoStyleEnum = z.enum([
  "CINEMATIC",
  "REALISTIC",
  "UGC",
  "LUXURY",
  "MINIMAL",
  "FAST_PACED",
  "DOCUMENTARY",
  "SOCIAL_MEDIA",
  "CORPORATE",
]);

export const aspectRatioEnum = z.enum(["RATIO_9_16", "RATIO_16_9", "RATIO_1_1"]);

export const createProjectSchema = z.object({
  prompt: z.string().min(10, "Describe your video in a bit more detail").max(20000),
  videoType: videoTypeEnum,
  style: videoStyleEnum,
  aspectRatio: aspectRatioEnum,
  duration: z.number().int().min(5).max(120),
  language: z.string().min(2).max(8),
  assetIds: z.array(z.string()).optional(),
});

export const updateSceneSchema = z.object({
  visualText: z.string().min(1).max(2000).optional(),
  voiceText: z.string().min(1).max(2000).optional(),
  prompt: z.string().min(1).max(2000).optional(),
  order: z.number().int().optional(),
  musicId: z.string().nullable().optional(),
});

export const brandKitSchema = z.object({
  name: z.string().min(1).max(80),
  logoUrl: z.string().url().optional().or(z.literal("")).optional(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  fontFamily: z.string().max(60).optional(),
  companyName: z.string().max(120).optional(),
  website: z.string().max(200).optional(),
  instagram: z.string().max(100).optional(),
  tiktok: z.string().max(100).optional(),
  youtube: z.string().max(100).optional(),
});

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
