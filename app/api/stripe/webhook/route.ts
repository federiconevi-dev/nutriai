import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/stripe";
import { addCredits } from "@/lib/credits";
import { PLAN_CREDITS } from "@/lib/config";

/**
 * Stripe webhook handler. Configure this URL (`/api/stripe/webhook`) in your
 * Stripe dashboard and set STRIPE_WEBHOOK_SECRET so signatures verify.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (userId) {
        await db.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: "CREATOR",
            status: "ACTIVE",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
          update: {
            status: "ACTIVE",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const existing = await db.subscription.findFirst({ where: { stripeSubscriptionId: sub.id } });
      if (existing) {
        await db.subscription.update({
          where: { id: existing.id },
          data: {
            status: sub.status === "active" ? "ACTIVE" : sub.status === "past_due" ? "PAST_DUE" : "CANCELED",
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
          },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const existing = await db.subscription.findFirst({ where: { stripeSubscriptionId: sub.id } });
      if (existing) {
        await db.subscription.update({ where: { id: existing.id }, data: { status: "CANCELED", plan: "FREE" } });
        await db.user.update({ where: { id: existing.userId }, data: { plan: "FREE" } });
      }
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      const existing = await db.subscription.findFirst({ where: { stripeCustomerId: invoice.customer } });
      if (existing) {
        await addCredits(
          existing.userId,
          PLAN_CREDITS[existing.plan as keyof typeof PLAN_CREDITS],
          "PLAN_RENEWAL",
          "Stripe invoice paid"
        );
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
