import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateDailyContent } from "@/lib/social/autopilot";

export const maxDuration = 60;

/** "Generar ahora": runs today's autopilot generation on demand. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = checkRateLimit(`social-autopilot:${session.user.id}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Esperá un rato antes de generar otra tanda." }, { status: 429 });
  try {
    const result = await generateDailyContent(session.user.id, { force: true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
