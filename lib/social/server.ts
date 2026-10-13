import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { DEFAULT_AUTOPILOT, DEFAULT_BRAND } from "./brand";
import { SETTINGS_KIND, type AutopilotSettings, type BrandData, type ProfileData, type PublicSettings } from "./types";

export type InstagramCredentials = { token: string; userId: string; username?: string; tokenUpdatedAt: string };
export type RawSettings = { autopilot: AutopilotSettings; instagram?: InstagramCredentials };

export async function getBrand(userId: string): Promise<BrandData> {
  const row = await db.socialItem.findFirst({ where: { userId, kind: "PROFILE" } });
  const profile = row ? (JSON.parse(row.data) as ProfileData) : null;
  return profile?.brand ?? DEFAULT_BRAND;
}

export async function getProfile(userId: string) {
  const row = await db.socialItem.findFirst({ where: { userId, kind: "PROFILE" } });
  return row ? (JSON.parse(row.data) as ProfileData) : null;
}

export async function getSettings(userId: string): Promise<{ id?: string; settings: RawSettings }> {
  const row = await db.socialItem.findFirst({ where: { userId, kind: SETTINGS_KIND } });
  const parsed = row ? (JSON.parse(row.data) as Partial<RawSettings>) : {};
  return {
    id: row?.id,
    settings: { autopilot: { ...DEFAULT_AUTOPILOT, ...(parsed.autopilot ?? {}) }, instagram: parsed.instagram },
  };
}

export async function saveSettings(userId: string, settings: RawSettings) {
  const existing = await db.socialItem.findFirst({ where: { userId, kind: SETTINGS_KIND }, select: { id: true } });
  const data = JSON.stringify(settings);
  if (existing) await db.socialItem.update({ where: { id: existing.id }, data: { data } });
  else await db.socialItem.create({ data: { userId, kind: SETTINGS_KIND, data } });
}

export function toPublicSettings(s: RawSettings): PublicSettings {
  return {
    autopilot: s.autopilot,
    instagram: {
      connected: !!s.instagram?.token,
      username: s.instagram?.username,
      tokenUpdatedAt: s.instagram?.tokenUpdatedAt,
    },
  };
}

/**
 * Public base URL that Instagram can reach. Preview deployments are usually
 * behind Vercel's login, so the production domain is preferred.
 */
export function publicBaseUrl(fallbackOrigin?: string) {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return fallbackOrigin ?? "http://localhost:3000";
}

function secret() {
  return process.env.AUTH_SECRET || "dev-secret";
}

export function signSlide(carouselId: string, index: number, version: string) {
  return createHmac("sha256", secret()).update(`${carouselId}:${index}:${version}`).digest("hex").slice(0, 32);
}

export function verifySlide(carouselId: string, index: number, version: string, sig: string) {
  const expected = Buffer.from(signSlide(carouselId, index, version));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Argentina has no DST: UTC-3 all year. */
export const ART_OFFSET_HOURS = 3;

export function artDayKey(d = new Date()) {
  const x = new Date(d.getTime() - ART_OFFSET_HOURS * 3600_000);
  return x.toISOString().slice(0, 10);
}

/** Date `daysAhead` days from today (Argentina) at `hour` Argentina time. */
export function artDateAt(daysAhead: number, hour: number, now = new Date()) {
  const [y, m, d] = artDayKey(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + daysAhead, hour + ART_OFFSET_HOURS, 0, 0));
}
