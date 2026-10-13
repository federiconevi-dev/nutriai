import { seededRandom } from "./demo";
import { addDays, startOfDay } from "./dates";
import { NETWORKS, type Network, type PostData, type ProfileData, type SocialItem } from "./types";

export type FollowerPoint = { date: Date } & Record<Network, number>;

const DAILY_GROWTH: Record<Network, number> = { instagram: 0.0032, tiktok: 0.0058, youtube: 0.0027 };

/**
 * Daily follower history ending at the profile's current numbers. Until the
 * networks' APIs are connected this is an estimate shaped from typical growth,
 * anchored to the follower counts the user enters.
 */
export function followerSeries(profile: ProfileData, days = 30, now = new Date()): FollowerPoint[] {
  const today = startOfDay(now);
  const values: Record<Network, number[]> = { instagram: [], tiktok: [], youtube: [] };
  for (const n of NETWORKS) {
    const rand = seededRandom(`${profile.handle}-${n}`);
    let v = profile.followers[n];
    const arr = [v];
    for (let i = 0; i < days; i++) {
      const g = DAILY_GROWTH[n] * (0.2 + rand() * 1.6);
      v = v / (1 + g);
      arr.push(v);
    }
    values[n] = arr.reverse().map((x) => Math.round(x));
  }
  return Array.from({ length: days + 1 }, (_, i) => ({
    date: addDays(today, i - days),
    instagram: values.instagram[i],
    tiktok: values.tiktok[i],
    youtube: values.youtube[i],
  }));
}

export function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

type Published = { id: string; data: PostData & { metrics: NonNullable<PostData["metrics"]> }; at: Date };

export function publishedPosts(posts: SocialItem<"POST">[]): Published[] {
  return posts
    .filter((p) => p.data.status === "published" && p.data.metrics)
    .map((p) => ({ id: p.id, data: p.data as Published["data"], at: new Date(p.data.scheduledAt) }));
}

export function interactions(m: NonNullable<PostData["metrics"]>) {
  return m.likes + m.comments + m.shares;
}

export function engagementRate(list: Published[]) {
  const views = list.reduce((s, p) => s + p.data.metrics.views, 0);
  const inter = list.reduce((s, p) => s + interactions(p.data.metrics), 0);
  return views ? (inter / views) * 100 : 0;
}

function inRange(list: Published[], from: Date, to: Date) {
  return list.filter((p) => p.at >= from && p.at < to);
}

export function computeSummary(posts: SocialItem<"POST">[], profile: ProfileData, now = new Date()) {
  const series = followerSeries(profile, 30, now);
  const first = series[0];
  const last = series[series.length - 1];
  const totalNow = NETWORKS.reduce((s, n) => s + last[n], 0);
  const totalBefore = NETWORKS.reduce((s, n) => s + first[n], 0);

  const pub = publishedPosts(posts);
  const end = addDays(startOfDay(now), 1);
  const d30 = addDays(end, -30);
  const d60 = addDays(end, -60);
  const d7 = addDays(end, -7);
  const d14 = addDays(end, -14);

  const last30 = inRange(pub, d30, end);
  const prev30 = inRange(pub, d60, d30);
  const views30 = last30.reduce((s, p) => s + p.data.metrics.views, 0);
  const viewsPrev = prev30.reduce((s, p) => s + p.data.metrics.views, 0);

  const best = (list: Published[]) =>
    list.reduce<Published | null>((b, p) => (!b || p.data.metrics.views > b.data.metrics.views ? p : b), null);
  const bestWeek = best(inRange(pub, d7, end));
  const bestPrevWeek = best(inRange(pub, d14, d7));

  const byNetwork = NETWORKS.map((n) => {
    const list = last30.filter((p) => p.data.network === n);
    return {
      network: n,
      views: list.reduce((s, p) => s + p.data.metrics.views, 0),
      interactions: list.reduce((s, p) => s + interactions(p.data.metrics), 0),
      engagement: engagementRate(list),
      posts: list.length,
      followers: last[n],
      followersChange: pctChange(last[n], first[n]),
    };
  });

  return {
    series,
    followers: { value: totalNow, change: pctChange(totalNow, totalBefore) },
    engagement: { value: engagementRate(last30), change: engagementRate(last30) - engagementRate(prev30) },
    views: { value: views30, change: pctChange(views30, viewsPrev) },
    bestWeek: bestWeek
      ? {
          post: bestWeek,
          change: bestPrevWeek ? pctChange(bestWeek.data.metrics.views, bestPrevWeek.data.metrics.views) : 0,
        }
      : null,
    byNetwork,
    topPosts: [...last30].sort((a, b) => b.data.metrics.views - a.data.metrics.views).slice(0, 3),
  };
}
