import crypto from "crypto";
import { APP_CONFIG } from "@/lib/config";

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

const PRICE_ENV: Record<"CREATOR" | "PRO", string | undefined> = {
  CREATOR: process.env.STRIPE_PRICE_ID_CREATOR,
  PRO: process.env.STRIPE_PRICE_ID_PRO,
};

/**
 * Creates a Stripe Checkout session via the raw REST API (no SDK dependency).
 * Returns null when Stripe isn't configured so callers can fall back to a
 * demo upgrade flow.
 */
export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  plan: "CREATOR" | "PRO";
  stripeCustomerId?: string | null;
}): Promise<{ url: string } | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = PRICE_ENV[params.plan];
  if (!secretKey || !priceId) return null;

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${APP_CONFIG.url}/credits?checkout=success`,
    cancel_url: `${APP_CONFIG.url}/credits?checkout=cancelled`,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: params.userId,
    ...(params.stripeCustomerId
      ? { customer: params.stripeCustomerId }
      : { customer_email: params.email }),
  });

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    console.error("[stripe] checkout session error:", await res.text());
    return null;
  }
  const data = await res.json();
  return { url: data.url };
}

export async function createBillingPortalSession(customerId: string): Promise<{ url: string } | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  const body = new URLSearchParams({
    customer: customerId,
    return_url: `${APP_CONFIG.url}/credits`,
  });

  const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { url: data.url };
}

/** Verifies a Stripe webhook signature without the SDK (HMAC-SHA256). */
export function verifyStripeSignature(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
