import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDailyContent, maybeRefreshToken, publishDuePosts } from "@/lib/social/autopilot";
import { SETTINGS_KIND } from "@/lib/social/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Daily jobs (see vercel.json): `task=publish` publishes due Instagram posts;
 * `task=generate` creates tomorrow's content for users with the autopilot on.
 */
export async function GET(req: Request) {
  // With CRON_SECRET set, Vercel sends it as a bearer token. Without it, only
  // accept Vercel's cron runner (the work is idempotent: one run per day).
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? req.headers.get("authorization") === `Bearer ${secret}`
    : (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Split in two daily runs so each fits in the function time limit.
  const task = new URL(req.url).searchParams.get("task") === "generate" ? "generate" : "publish";
  const rows = await db.socialItem.findMany({ where: { kind: SETTINGS_KIND }, select: { userId: true } });
  const report: Record<string, unknown> = {};
  for (const { userId } of rows) {
    try {
      if (task === "publish") {
        await maybeRefreshToken(userId);
        report[userId] = { published: await publishDuePosts(userId) };
      } else {
        report[userId] = { generated: await generateDailyContent(userId) };
      }
    } catch (e) {
      report[userId] = { error: (e as Error).message };
    }
  }
  return NextResponse.json({ ok: true, report });
}
