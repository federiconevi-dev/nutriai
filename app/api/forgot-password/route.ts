import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { APP_CONFIG } from "@/lib/config";

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`forgot:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email } });

  // Always respond the same way so we never leak whether an email is registered.
  const genericResponse = NextResponse.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });

  if (!user || !user.passwordHash) return genericResponse;

  const token = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const resetUrl = `${APP_CONFIG.url}/reset-password?token=${token}`;

  // No email provider is configured yet - print the link to the server log so
  // the flow can be tested end to end. Wire up a real provider (Resend,
  // Postmark, SES, etc.) here when you're ready to send real emails.
  console.log(`[Videora AI] Password reset link for ${email}: ${resetUrl}`);

  const demoMode = process.env.DEMO_MODE === "true";
  return NextResponse.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...(demoMode ? { demoResetUrl: resetUrl } : {}),
  });
}
