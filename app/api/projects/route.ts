import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createProjectSchema } from "@/lib/validations";
import { deductCredits, InsufficientCreditsError } from "@/lib/credits";
import { GENERATION_COSTS } from "@/lib/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`create-project:${session.user.id}`, 20, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { prompt, videoType, style, aspectRatio, duration, language, assetIds } = parsed.data;

  try {
    await deductCredits(session.user.id, GENERATION_COSTS.script, "SCRIPT_GENERATION", "Project draft created");
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Not enough credits to start a new project." }, { status: 402 });
    }
    throw err;
  }

  const project = await db.project.create({
    data: {
      userId: session.user.id,
      title: prompt.slice(0, 60),
      prompt,
      videoType,
      style,
      aspectRatio,
      duration,
      language,
      status: "DRAFT",
      ...(assetIds?.length
        ? { assets: { create: assetIds.map((assetId) => ({ assetId, role: "product" })) } }
        : {}),
    },
  });

  return NextResponse.json({ project });
}
