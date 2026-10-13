import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getInstagramAccount } from "@/lib/social/instagram";
import { autopilotSchema } from "@/lib/social/schemas";
import { getSettings, saveSettings, toPublicSettings } from "@/lib/social/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { settings } = await getSettings(session.user.id);
  return NextResponse.json({ settings: toPublicSettings(settings) });
}

const bodySchema = z.object({
  autopilot: autopilotSchema.omit({ lastRunDay: true }).optional(),
  instagramToken: z.string().trim().min(20).max(1000).optional(),
  disconnectInstagram: z.boolean().optional(),
});

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { settings } = await getSettings(session.user.id);
  if (body.data.autopilot) settings.autopilot = { ...settings.autopilot, ...body.data.autopilot };
  if (body.data.disconnectInstagram) settings.instagram = undefined;
  if (body.data.instagramToken) {
    try {
      const account = await getInstagramAccount(body.data.instagramToken);
      settings.instagram = {
        token: body.data.instagramToken,
        userId: account.userId,
        username: account.username,
        tokenUpdatedAt: new Date().toISOString(),
      };
    } catch (e) {
      return NextResponse.json({ error: `Instagram rechazó el código: ${(e as Error).message}` }, { status: 400 });
    }
  }
  await saveSettings(session.user.id, settings);
  return NextResponse.json({ settings: toPublicSettings(settings) });
}
