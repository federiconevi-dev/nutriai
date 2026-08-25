import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addCredits } from "@/lib/credits";
import { z } from "zod";

const schema = z.object({ amount: z.number().int().min(1).max(100000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const balance = await addCredits(params.id, parsed.data.amount, "ADMIN_GRANT", `Granted by admin ${session.user.email}`);
  return NextResponse.json({ balance });
}
