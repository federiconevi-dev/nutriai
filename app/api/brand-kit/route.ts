import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { brandKitSchema } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brandKit = await db.brandKit.findFirst({ where: { userId: session.user.id } });
  return NextResponse.json({ brandKit });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = brandKitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await db.brandKit.findFirst({ where: { userId: session.user.id } });
  const data = parsed.data;

  const brandKit = existing
    ? await db.brandKit.update({ where: { id: existing.id }, data })
    : await db.brandKit.create({ data: { ...data, userId: session.user.id } });

  return NextResponse.json({ brandKit });
}
