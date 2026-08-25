import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { z } from "zod";

const schema = z.object({ plan: z.enum(["CREATOR", "PRO"]) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  if (!isStripeConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "Stripe is not configured yet. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_ID_* to enable real checkout.",
    });
  }

  const subscription = await db.subscription.findUnique({ where: { userId: session.user.id } });
  const checkout = await createCheckoutSession({
    userId: session.user.id,
    email: session.user.email!,
    plan: parsed.data.plan,
    stripeCustomerId: subscription?.stripeCustomerId,
  });

  if (!checkout) {
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ configured: true, url: checkout.url });
}
