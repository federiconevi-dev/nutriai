import { db } from "@/lib/db";
import { renderSlideJpeg } from "@/lib/social/slide-image";
import { verifySlide } from "@/lib/social/server";
import type { CarouselData } from "@/lib/social/types";

export const runtime = "nodejs";

/**
 * Public, signed JPEG of one carousel slide. Instagram downloads slides from
 * here when publishing, so it can't sit behind the login.
 */
export async function GET(req: Request, { params }: { params: { id: string; index: string } }) {
  const url = new URL(req.url);
  const index = Number(params.index.replace(/\.jpe?g$/, ""));
  const v = url.searchParams.get("v") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  if (!Number.isInteger(index) || index < 0 || !verifySlide(params.id, index, v, sig)) {
    return new Response("Not found", { status: 404 });
  }

  const row = await db.socialItem.findFirst({ where: { id: params.id, kind: "CAROUSEL" } });
  if (!row) return new Response("Not found", { status: 404 });
  const carousel = JSON.parse(row.data) as CarouselData;
  if (index >= carousel.slides.length) return new Response("Not found", { status: 404 });

  const jpeg = await renderSlideJpeg(carousel, index);
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
