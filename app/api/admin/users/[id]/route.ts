import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  disabled: z.boolean().optional(),
  plan: z.enum(["FREE", "CREATOR", "PRO"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (params.id === session.user.id && (parsed.data.disabled || parsed.data.role === "USER")) {
    return NextResponse.json({ error: "You cannot disable or demote your own account." }, { status: 400 });
  }

  const user = await db.user.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ user });
}
