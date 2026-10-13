import { db } from "@/lib/db";
import { publicBaseUrl, signSlide, type InstagramCredentials } from "./server";
import type { CarouselData, InstagramPublishState, PostData } from "./types";

/**
 * Instagram publishing via the "Instagram API with Instagram Login"
 * (graph.instagram.com). Works for the owner's own professional account
 * without App Review while the Meta app is in development mode.
 */

const GRAPH = "https://graph.instagram.com/v21.0";

type GraphError = { error?: { message?: string; error_user_msg?: string } };

async function graph<T>(path: string, token: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET"): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(method === "GET" ? `${GRAPH}${path}?${qs}` : `${GRAPH}${path}`, {
    method,
    headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: method === "POST" ? qs : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(json.error?.error_user_msg || json.error?.message || `Instagram respondió ${res.status}`);
  }
  return json;
}

/** Validates a token and returns the account it belongs to. */
export async function getInstagramAccount(token: string) {
  const me = await graph<{ user_id?: string; id: string; username: string }>("/me", token, { fields: "user_id,username" });
  return { userId: me.user_id ?? me.id, username: me.username };
}

/** Long-lived tokens last 60 days; refreshing extends them. */
export async function refreshInstagramToken(token: string) {
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  const json = (await res.json().catch(() => ({}))) as { access_token?: string } & GraphError;
  if (!res.ok || !json.access_token) throw new Error(json.error?.message || "No se pudo renovar el token");
  return json.access_token;
}

async function waitUntilReady(containerId: string, token: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const s = await graph<{ status_code?: string; status?: string }>(`/${containerId}`, token, { fields: "status_code,status" });
    if (s.status_code === "FINISHED" || s.status_code === "PUBLISHED") return true;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram no pudo procesar el archivo (${s.status || s.status_code})`);
    if (Date.now() > until) return false;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

function captionFor(post: PostData, carousel?: CarouselData) {
  return (post.caption?.trim() || carousel?.caption?.trim() || post.title).slice(0, 2200);
}

export class PublishPendingError extends Error {}

/**
 * Publishes one post. Returns the new publish state. Throws
 * PublishPendingError (with the container saved) when a video is still
 * processing, so the next run can finish it.
 */
export async function publishToInstagram(
  post: PostData,
  creds: InstagramCredentials,
  ownerId: string,
  origin?: string
): Promise<InstagramPublishState> {
  const { token, userId } = creds;
  let containerId = post.ig?.containerId;

  if (!containerId) {
    if (post.carouselId) {
      const row = await db.socialItem.findFirst({ where: { id: post.carouselId, userId: ownerId, kind: "CAROUSEL" } });
      if (!row) throw new Error("No encontré el carrusel de este post");
      const carousel = JSON.parse(row.data) as CarouselData;
      if (carousel.slides.length < 2) throw new Error("Un carrusel necesita al menos 2 filminas");
      if (carousel.slides.length > 10) throw new Error("Instagram permite máximo 10 filminas por carrusel");
      const base = publicBaseUrl(origin);
      const v = String(row.updatedAt.getTime());
      const children: string[] = [];
      for (let i = 0; i < carousel.slides.length; i++) {
        const imageUrl = `${base}/api/social/slide/${row.id}/${i}.jpg?v=${v}&sig=${signSlide(row.id, i, v)}`;
        const c = await graph<{ id: string }>(`/${userId}/media`, token, { image_url: imageUrl, is_carousel_item: "true" }, "POST");
        children.push(c.id);
      }
      const parent = await graph<{ id: string }>(
        `/${userId}/media`,
        token,
        { media_type: "CAROUSEL", children: children.join(","), caption: captionFor(post, carousel) },
        "POST"
      );
      containerId = parent.id;
    } else if (post.videoUrl) {
      const c = await graph<{ id: string }>(
        `/${userId}/media`,
        token,
        { media_type: "REELS", video_url: post.videoUrl, caption: captionFor(post), share_to_feed: "true" },
        "POST"
      );
      containerId = c.id;
    } else if (post.imageUrl) {
      const c = await graph<{ id: string }>(`/${userId}/media`, token, { image_url: post.imageUrl, caption: captionFor(post) }, "POST");
      containerId = c.id;
    } else {
      throw new Error("El post no tiene carrusel, imagen ni video para publicar");
    }
  }

  const ready = await waitUntilReady(containerId, token, post.videoUrl ? 45_000 : 20_000);
  if (!ready) {
    const err = new PublishPendingError("Instagram sigue procesando el video; se publica en la próxima pasada");
    (err as PublishPendingError & { containerId: string }).containerId = containerId;
    throw err;
  }

  const published = await graph<{ id: string }>(`/${userId}/media_publish`, token, { creation_id: containerId }, "POST");
  let permalink: string | undefined;
  try {
    permalink = (await graph<{ permalink?: string }>(`/${published.id}`, token, { fields: "permalink" })).permalink;
  } catch {
    // The post is live even if the permalink lookup fails.
  }
  return { mediaId: published.id, permalink, publishedAt: new Date().toISOString() };
}
