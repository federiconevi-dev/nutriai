import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeCarousel } from "@/lib/social/ai";
import { carouselRequestSchema } from "@/lib/social/schemas";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`social-ai:${session.user.id}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Muchas generaciones seguidas. Esperá unos minutos." }, { status: 429 });

  const parsed = carouselRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const result = await writeCarousel(parsed.data);
  return NextResponse.json(result);
}
