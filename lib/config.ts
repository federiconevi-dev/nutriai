/**
 * Central branding configuration. Change the app name/description here
 * and it propagates through the landing page, dashboard, emails and metadata.
 */
export const APP_CONFIG = {
  name: "Videora AI",
  shortName: "Videora",
  tagline: "Create professional videos with AI",
  description:
    "Turn your ideas, products and images into engaging videos in minutes.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "support@videora.ai",
};

export const PLAN_CREDITS: Record<"FREE" | "CREATOR" | "PRO", number> = {
  FREE: 100,
  CREATOR: 1000,
  PRO: 5000,
};

export const PLAN_PRICE_USD: Record<"FREE" | "CREATOR" | "PRO", number> = {
  FREE: 0,
  CREATOR: 29,
  PRO: 99,
};

export const GENERATION_COSTS = {
  script: 5,
  scene: 15,
  voice: 5,
  video: 40, // full pipeline (script + scenes + voice + captions + render)
};

export const DEMO_MODE =
  process.env.DEMO_MODE === "true" || !process.env.VIDEO_API_KEY;
