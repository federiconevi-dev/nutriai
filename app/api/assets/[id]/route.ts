import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asset = await db.asset.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  await db.asset.delete({ where: { id: asset.id } });
  return NextResponse.json({ success: true });
}
