import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { addCredits } from "@/lib/credits";
import { PLAN_CREDITS } from "@/lib/config";
import { z } from "zod";

const schema = z.object({ plan: z.enum(["FREE", "CREATOR", "PRO"]) });

/**
 * Demo-mode plan upgrade used only when Stripe isn't configured, so the
 * plan/credits UI can be fully exercised without real payments.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const plan = parsed.data.plan;

  await db.user.update({ where: { id: session.user.id }, data: { plan } });
  await db.subscription.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, plan, status: "ACTIVE" },
    update: { plan, status: "ACTIVE" },
  });
  await addCredits(session.user.id, PLAN_CREDITS[plan], "PLAN_RENEWAL", `Demo upgrade to ${plan}`);

  return NextResponse.json({ success: true });
}
