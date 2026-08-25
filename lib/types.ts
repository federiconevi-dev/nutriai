/**
 * Domain enums modeled as `String` columns in Prisma (SQLite has no native
 * enum support - see prisma/schema.prisma). These types are the source of
 * truth for allowed values across the app and are validated at the edges
 * with zod (see lib/validations.ts).
 */
export type Role = "USER" | "ADMIN";
export type Plan = "FREE" | "CREATOR" | "PRO";

export type ProjectStatus = "DRAFT" | "GENERATING" | "COMPLETED" | "FAILED";
export type VideoStatus = "DRAFT" | "GENERATING" | "COMPLETED" | "FAILED";

export type VideoType =
  | "PRODUCT_AD"
  | "TIKTOK"
  | "INSTAGRAM_REEL"
  | "YOUTUBE_SHORT"
  | "YOUTUBE"
  | "UGC"
  | "CINEMATIC"
  | "EDUCATIONAL";

export type VideoStyle =
  | "CINEMATIC"
  | "REALISTIC"
  | "UGC"
  | "LUXURY"
  | "MINIMAL"
  | "FAST_PACED"
  | "DOCUMENTARY"
  | "SOCIAL_MEDIA"
  | "CORPORATE";

export type AspectRatio = "RATIO_9_16" | "RATIO_16_9" | "RATIO_1_1";

export type GenerationStage =
  | "QUEUED"
  | "ANALYZING_PROMPT"
  | "CREATING_SCRIPT"
  | "CREATING_STORYBOARD"
  | "GENERATING_SCENES"
  | "CREATING_VOICE"
  | "ADDING_SUBTITLES"
  | "RENDERING_VIDEO"
  | "FINALIZING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type AssetType = "PRODUCT_IMAGE" | "LOGO" | "LIFESTYLE_IMAGE" | "OTHER";

export type CreditReason =
  | "SIGNUP_BONUS"
  | "PLAN_RENEWAL"
  | "ADMIN_GRANT"
  | "VIDEO_GENERATION"
  | "SCRIPT_GENERATION"
  | "REFUND";

export type SubscriptionStatus = "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE" | "TRIALING";
