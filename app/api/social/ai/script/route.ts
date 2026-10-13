import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBrand } from "@/lib/social/server";
import { writeScript } from "@/lib/social/ai";
import { scriptRequestSchema } from "@/lib/social/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`social-ai:${session.user.id}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Muchas generaciones seguidas. Esperá unos minutos." }, { status: 429 });

  const parsed = scriptRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const result = await writeScript({ ...parsed.data, brand: await getBrand(session.user.id) });
  return NextResponse.json(result);
}
