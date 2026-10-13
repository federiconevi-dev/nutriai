import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCHEMA_BY_KIND } from "@/lib/social/schemas";
import type { SocialKind } from "@/lib/social/types";
import { serializeItem } from "../serialize";

async function findOwned(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const row = await db.socialItem.findFirst({ where: { id, userId: session.user.id } });
  if (!row) return { error: NextResponse.json({ error: "No encontrado" }, { status: 404 }) };
  return { row };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { row, error } = await findOwned(params.id);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = SCHEMA_BY_KIND[row.kind as SocialKind].safeParse(body?.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const updated = await db.socialItem.update({ where: { id: row.id }, data: { data: JSON.stringify(parsed.data) } });
  return NextResponse.json({ item: serializeItem(updated) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { row, error } = await findOwned(params.id);
  if (error) return error;
  if (row.kind === "PROFILE") return NextResponse.json({ error: "No se puede borrar el perfil" }, { status: 400 });
  await db.socialItem.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
