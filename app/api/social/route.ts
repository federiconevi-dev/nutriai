import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildDemoContent } from "@/lib/social/demo";
import { SCHEMA_BY_KIND } from "@/lib/social/schemas";
import { SOCIAL_KINDS } from "@/lib/social/types";
import { serializeItem } from "./serialize";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // First visit: seed example content so the hub never starts empty. The
  // PROFILE row doubles as the "already seeded" marker.
  const hasProfile = await db.socialItem.findFirst({ where: { userId, kind: "PROFILE" }, select: { id: true } });
  if (!hasProfile) {
    await db.socialItem.createMany({
      data: buildDemoContent(userId).map((i) => ({ userId, kind: i.kind, data: JSON.stringify(i.data) })),
    });
  }

  const rows = await db.socialItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items: rows.map(serializeItem) });
}

const createSchema = z.object({ kind: z.enum(SOCIAL_KINDS), data: z.unknown() });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const parsed = SCHEMA_BY_KIND[body.data.kind].safeParse(body.data.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  if (body.data.kind === "PROFILE") {
    return NextResponse.json({ error: "El perfil se actualiza, no se crea" }, { status: 400 });
  }

  const count = await db.socialItem.count({ where: { userId: session.user.id } });
  if (count >= 5000) return NextResponse.json({ error: "Llegaste al límite de elementos" }, { status: 400 });

  const row = await db.socialItem.create({
    data: { userId: session.user.id, kind: body.data.kind, data: JSON.stringify(parsed.data) },
  });
  return NextResponse.json({ item: serializeItem(row) });
}
