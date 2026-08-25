import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/providers/storage";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`upload:${session.user.id}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many uploads. Please slow down." }, { status: 429 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const type = (formData?.get("type") as string) || "PRODUCT_IMAGE";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG and WEBP images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large. Max size is 8MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const { url } = await storage.upload(buffer, file.name, file.type);

  const asset = await db.asset.create({
    data: {
      userId: session.user.id,
      type: type as any,
      url,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    },
  });

  return NextResponse.json({ asset });
}
