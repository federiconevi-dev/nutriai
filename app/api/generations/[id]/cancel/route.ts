import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelGenerationJob } from "@/lib/jobs/pipeline";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const generation = await cancelGenerationJob(params.id, session.user.id);
    return NextResponse.json({ generation });
  } catch (err) {
    return NextResponse.json({ error: "Could not cancel this generation." }, { status: 400 });
  }
}
