export const VIDEO_TYPES = [
  { value: "PRODUCT_AD", label: "Product Ad" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM_REEL", label: "Instagram Reel" },
  { value: "YOUTUBE_SHORT", label: "YouTube Short" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "UGC", label: "UGC" },
  { value: "CINEMATIC", label: "Cinematic" },
  { value: "EDUCATIONAL", label: "Educational" },
] as const;

export const DURATIONS = [10, 15, 20, 30, 60] as const;

export const ASPECT_RATIOS = [
  { value: "RATIO_9_16", label: "9:16", hint: "TikTok, Reels, Shorts" },
  { value: "RATIO_16_9", label: "16:9", hint: "YouTube, landscape" },
  { value: "RATIO_1_1", label: "1:1", hint: "Feed, square" },
] as const;

export const STYLES = [
  { value: "CINEMATIC", label: "Cinematic" },
  { value: "REALISTIC", label: "Realistic" },
  { value: "UGC", label: "UGC" },
  { value: "LUXURY", label: "Luxury" },
  { value: "MINIMAL", label: "Minimal" },
  { value: "FAST_PACED", label: "Fast paced" },
  { value: "DOCUMENTARY", label: "Documentary" },
  { value: "SOCIAL_MEDIA", label: "Social media" },
  { value: "CORPORATE", label: "Corporate" },
] as const;

export const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
] as const;

export const VOICE_GENDERS = ["male", "female", "neutral"] as const;
export const VOICE_TONES = ["professional", "energetic", "calm", "friendly", "ugc", "cinematic"] as const;
export const VOICE_SPEEDS = [0.8, 1, 1.2] as const;
export const CAPTION_STYLES = ["classic", "bold", "minimal", "tiktok", "highlight"] as const;

export function typeParamToVideoType(type: string | null): (typeof VIDEO_TYPES)[number]["value"] {
  const map: Record<string, (typeof VIDEO_TYPES)[number]["value"]> = {
    TEXT_TO_VIDEO: "CINEMATIC",
    PRODUCT_AD: "PRODUCT_AD",
    IMAGE_TO_VIDEO: "PRODUCT_AD",
    UGC: "UGC",
    AVATAR: "EDUCATIONAL",
    RECREATE: "CINEMATIC",
  };
  return (type && map[type]) || "PRODUCT_AD";
}
