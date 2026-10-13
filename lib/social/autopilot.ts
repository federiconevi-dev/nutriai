import { db } from "@/lib/db";
import { suggestTopics, writeCarousel, writeScript } from "./ai";
import { PublishPendingError, publishToInstagram, refreshInstagramToken } from "./instagram";
import { artDateAt, artDayKey, getBrand, getProfile, getSettings, saveSettings } from "./server";
import type { CarouselData, PostData, ScriptData } from "./types";

/** Publishes one stored post to Instagram and saves the outcome on the post. */
export async function publishPostRow(rowId: string, userId: string, origin?: string) {
  const row = await db.socialItem.findFirst({ where: { id: rowId, userId, kind: "POST" } });
  if (!row) throw new Error("Post no encontrado");
  const post = JSON.parse(row.data) as PostData;
  const { settings } = await getSettings(userId);
  if (!settings.instagram?.token) throw new Error("Conectá tu Instagram en Ajustes");
  if (post.ig?.mediaId) return post;

  let next: PostData;
  try {
    const ig = await publishToInstagram(post, settings.instagram, userId, origin);
    next = { ...post, network: "instagram", status: "published", ig };
  } catch (e) {
    const containerId = (e as { containerId?: string }).containerId;
    next = { ...post, ig: { ...post.ig, containerId: containerId ?? post.ig?.containerId, error: (e as Error).message } };
    await db.socialItem.update({ where: { id: row.id }, data: { data: JSON.stringify(next) } });
    if (e instanceof PublishPendingError) return next;
    throw e;
  }
  await db.socialItem.update({ where: { id: row.id }, data: { data: JSON.stringify(next) } });
  return next;
}

/** Publishes every auto-publish Instagram post whose time has come. */
export async function publishDuePosts(userId: string, now = new Date()) {
  const rows = await db.socialItem.findMany({ where: { userId, kind: "POST" } });
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const row of rows) {
    const p = JSON.parse(row.data) as PostData;
    const due = new Date(p.scheduledAt).getTime() <= now.getTime() + 3 * 3600_000;
    if (!p.autoPublish || p.network !== "instagram" || p.status !== "ready" || p.ig?.mediaId || !due) continue;
    try {
      await publishPostRow(row.id, userId);
      results.push({ id: row.id, ok: true });
    } catch (e) {
      results.push({ id: row.id, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

/** Keeps the 60-day Instagram token alive. */
export async function maybeRefreshToken(userId: string) {
  const { settings } = await getSettings(userId);
  const ig = settings.instagram;
  if (!ig?.token) return;
  const age = Date.now() - new Date(ig.tokenUpdatedAt).getTime();
  if (age < 20 * 86400_000) return;
  try {
    const token = await refreshInstagramToken(ig.token);
    await saveSettings(userId, { ...settings, instagram: { ...ig, token, tokenUpdatedAt: new Date().toISOString() } });
  } catch (e) {
    console.error("[autopilot] token refresh failed:", e);
  }
}

/**
 * Creates tomorrow's content: carousels (scheduled to auto-publish on
 * Instagram) and reel scripts (put on the calendar to record).
 */
export async function generateDailyContent(userId: string, opts: { force?: boolean } = {}) {
  const { settings } = await getSettings(userId);
  const ap = settings.autopilot;
  const today = artDayKey();
  if (!opts.force && (!ap.enabled || ap.lastRunDay === today)) return { created: 0 };

  const [brand, profile, recent] = await Promise.all([
    getBrand(userId),
    getProfile(userId),
    db.socialItem.findMany({ where: { userId, kind: { in: ["POST", "SCRIPT", "CAROUSEL"] } }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const avoid = recent.map((r) => {
    const d = JSON.parse(r.data) as { title?: string; topic?: string };
    return d.topic || d.title || "";
  });

  const carousels = Math.max(0, Math.min(3, ap.carouselsPerDay));
  const scripts = Math.max(0, Math.min(3, ap.scriptsPerDay));
  const topics = await suggestTopics(brand, carousels + scripts, avoid);
  const handle = profile?.handle && profile.handle !== "tumarca" ? profile.handle : "federicomarketingg";
  let created = 0;

  for (let i = 0; i < carousels; i++) {
    const topic = topics[i] ?? topics[0];
    if (!topic) break;
    const c = await writeCarousel({ topic, slideCount: 6, brand });
    const carousel: CarouselData = { topic, title: c.title, styleId: ap.styleId, handle, slides: c.slides, caption: c.caption };
    const cRow = await db.socialItem.create({ data: { userId, kind: "CAROUSEL", data: JSON.stringify(carousel) } });
    const post: PostData = {
      title: c.title,
      caption: c.caption,
      network: "instagram",
      status: "ready",
      scheduledAt: artDateAt(1, ap.publishHour + i).toISOString(),
      carouselId: cRow.id,
      autoPublish: ap.autoPublish,
    };
    await db.socialItem.create({ data: { userId, kind: "POST", data: JSON.stringify(post) } });
    created++;
  }

  for (let i = 0; i < scripts; i++) {
    const topic = topics[carousels + i] ?? topics[i];
    if (!topic) break;
    const { script } = await writeScript({ topic, brand });
    await db.socialItem.create({ data: { userId, kind: "SCRIPT", data: JSON.stringify(script satisfies ScriptData) } });
    const post: PostData = {
      title: `🎬 Grabar: ${script.title}`,
      caption: [script.caption, script.hashtags?.join(" ")].filter(Boolean).join("\n\n"),
      network: "tiktok",
      status: "draft",
      scheduledAt: artDateAt(1, Math.max(0, ap.publishHour - 2 + i)).toISOString(),
    };
    await db.socialItem.create({ data: { userId, kind: "POST", data: JSON.stringify(post) } });
    created++;
  }

  const fresh = await getSettings(userId);
  await saveSettings(userId, { ...fresh.settings, autopilot: { ...fresh.settings.autopilot, lastRunDay: today } });
  return { created };
}
