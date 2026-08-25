import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  image: z.string().url().optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await db.user.update({
    where: { id: session.user.id },
    data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.image ? { image: parsed.data.image } : {}) },
  });

  return NextResponse.json({ user: { name: user.name, image: user.image } });
}
