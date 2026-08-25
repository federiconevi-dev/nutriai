import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { startGeneration } from "@/lib/jobs/pipeline";
import { InsufficientCreditsError } from "@/lib/credits";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`generate:${session.user.id}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many generations requested. Please slow down." }, { status: 429 });
  }

  const project = await db.project.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const activeGeneration = await db.generation.findFirst({
    where: { projectId: project.id, stage: { notIn: ["COMPLETED", "FAILED", "CANCELLED"] } },
  });
  if (activeGeneration) {
    return NextResponse.json({ generation: activeGeneration });
  }

  try {
    const generation = await startGeneration(project.id, session.user.id);
    return NextResponse.json({ generation });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Not enough credits to generate this video." }, { status: 402 });
    }
    console.error("[generate] failed to start:", err);
    return NextResponse.json(
      { error: "Something went wrong while starting your video. Please try again." },
      { status: 500 }
    );
  }
}
