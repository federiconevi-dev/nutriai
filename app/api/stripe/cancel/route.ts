import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await db.subscription.findUnique({ where: { userId: session.user.id } });
  if (!subscription) return NextResponse.json({ error: "No active subscription" }, { status: 404 });

  if (isStripeConfigured() && subscription.stripeSubscriptionId) {
    await fetch(`https://api.stripe.com/v1/subscriptions/${subscription.stripeSubscriptionId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "cancel_at_period_end=true",
    }).catch(() => null);
  }

  const updated = await db.subscription.update({
    where: { userId: session.user.id },
    data: { cancelAtPeriodEnd: true },
  });

  return NextResponse.json({ subscription: updated });
}
