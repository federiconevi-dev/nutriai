/**
 * Demo/placeholder media used only when running in DEMO_MODE (no real
 * video/voice provider configured). These are short, locally generated
 * animated-gradient MP4 clips bundled in /public/demo/videos - fully
 * self-contained (no external network calls), so the full product flow can
 * be exercised end to end before you connect a real VIDEO_API_KEY.
 */
export const DEMO_VIDEO_CLIPS = [
  "/demo/videos/demo-1.mp4",
  "/demo/videos/demo-2.mp4",
  "/demo/videos/demo-3.mp4",
  "/demo/videos/demo-4.mp4",
  "/demo/videos/demo-5.mp4",
];

export const DEMO_THUMBNAILS = [
  "/demo/thumb-1.svg",
  "/demo/thumb-2.svg",
  "/demo/thumb-3.svg",
  "/demo/thumb-4.svg",
  "/demo/thumb-5.svg",
];

export function pickDemoClip(seed: string) {
  const idx = hashString(seed) % DEMO_VIDEO_CLIPS.length;
  return DEMO_VIDEO_CLIPS[idx];
}

export function pickDemoThumbnail(seed: string) {
  const idx = hashString(seed) % DEMO_THUMBNAILS.length;
  return DEMO_THUMBNAILS[idx];
}

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const MUSIC_LIBRARY = [
  { id: "trending-1", name: "Neon Pulse", category: "Trending", duration: 30 },
  { id: "trending-2", name: "Skyline Drift", category: "Trending", duration: 28 },
  { id: "corporate-1", name: "Clear Vision", category: "Corporate", duration: 32 },
  { id: "corporate-2", name: "Momentum", category: "Corporate", duration: 30 },
  { id: "cinematic-1", name: "Wide Horizon", category: "Cinematic", duration: 35 },
  { id: "cinematic-2", name: "Ascend", category: "Cinematic", duration: 33 },
  { id: "energetic-1", name: "Overdrive", category: "Energetic", duration: 27 },
  { id: "energetic-2", name: "Rush Hour", category: "Energetic", duration: 29 },
  { id: "chill-1", name: "Soft Focus", category: "Chill", duration: 34 },
  { id: "chill-2", name: "Slow Bloom", category: "Chill", duration: 31 },
  { id: "emotional-1", name: "Open Hearts", category: "Emotional", duration: 36 },
  { id: "ugc-1", name: "Handheld", category: "UGC", duration: 26 },
] as const;
