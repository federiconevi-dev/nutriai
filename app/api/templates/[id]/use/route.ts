import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { deductCredits, InsufficientCreditsError } from "@/lib/credits";
import { GENERATION_COSTS } from "@/lib/config";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await db.template.findUnique({ where: { id: params.id } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  try {
    await deductCredits(session.user.id, GENERATION_COSTS.script, "SCRIPT_GENERATION", `From template: ${template.name}`);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Not enough credits to use this template." }, { status: 402 });
    }
    throw err;
  }

  const project = await db.project.create({
    data: {
      userId: session.user.id,
      title: template.name,
      prompt: template.promptSeed,
      videoType: template.videoType,
      style: template.style,
      aspectRatio: template.aspectRatio,
      duration: template.duration,
      language: "en",
      status: "DRAFT",
      thumbnail: template.previewUrl,
    },
  });

  return NextResponse.json({ project });
}
