import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publishPostRow } from "@/lib/social/autopilot";
import { serializeItem } from "../../serialize";
import { db } from "@/lib/db";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await publishPostRow(params.id, session.user.id, new URL(req.url).origin);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const row = await db.socialItem.findFirst({ where: { id: params.id, userId: session.user.id } });
  return NextResponse.json({ item: row ? serializeItem(row) : null });
}
