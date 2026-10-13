import { ImageResponse } from "next/og";
import sharp from "sharp";
import { SLIDE_H, SLIDE_W, getStyle } from "./carousel-render";
import type { CarouselData } from "./types";

/**
 * Server-side slide renderer used for publishing to Instagram (which needs a
 * public JPEG per slide). Mirrors the in-app canvas design.
 */

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: "normal" };
let fontCache: Promise<Font[]> | null = null;

function loadFonts(): Promise<Font[]> {
  if (!fontCache) {
    const get = async (family: string, slug: string, weight: 400 | 700 | 800): Promise<Font | null> => {
      try {
        const res = await fetch(`https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${weight}-normal.woff`);
        if (!res.ok) return null;
        return { name: family, data: await res.arrayBuffer(), weight, style: "normal" };
      } catch {
        return null;
      }
    };
    fontCache = Promise.all([
      get("Inter", "inter", 400),
      get("Inter", "inter", 700),
      get("Inter", "inter", 800),
      get("Playfair", "playfair-display", 800),
    ]).then((list) => list.filter((f): f is Font => !!f));
  }
  return fontCache;
}

function titleSize(text: string, kind: string) {
  const n = text.length;
  if (kind === "content") return n < 28 ? 78 : n < 55 ? 64 : 52;
  if (kind === "hook") return n < 30 ? 112 : n < 60 ? 92 : n < 90 ? 76 : 62;
  return n < 30 ? 100 : n < 60 ? 80 : 64;
}

function bodySize(text: string) {
  const n = text.length;
  return n < 90 ? 46 : n < 160 ? 40 : n < 240 ? 34 : 30;
}

export async function renderSlideJpeg(carousel: CarouselData, index: number) {
  const style = getStyle(carousel.styleId);
  const slide = carousel.slides[index];
  const total = carousel.slides.length;
  const fonts = await loadFonts();
  const hasInter = fonts.some((f) => f.name === "Inter");
  const sans = hasInter ? "Inter" : "sans-serif";
  const titleFamily = style.serif && fonts.some((f) => f.name === "Playfair") ? "Playfair" : sans;
  const align = style.align === "center" ? "center" : "flex-start";
  const textAlign = style.align === "center" ? "center" : "left";
  const handle = carousel.handle ? `@${carousel.handle.replace(/^@/, "")}` : "";
  const title = slide.kind === "content" ? slide.title.replace(/^\d+\.\s*/, "") : slide.title;
  const bg = style.bg.length > 1 ? `linear-gradient(135deg, ${style.bg[0]}, ${style.bg[style.bg.length - 1]})` : style.bg[0];

  const deco =
    style.deco === "glow" ? (
      <div
        style={{
          position: "absolute",
          left: index % 2 ? -540 : SLIDE_W - 840,
          top: -560,
          width: 1440,
          height: 1440,
          borderRadius: 9999,
          backgroundImage: `radial-gradient(circle, ${style.accent}40 0%, ${style.accent}00 60%)`,
        }}
      />
    ) : style.deco === "blobs" ? (
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div style={{ position: "absolute", left: index % 2 ? -220 : SLIDE_W - 360, top: -80, width: 600, height: 600, borderRadius: 9999, background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", left: index % 2 ? SLIDE_W - 320 : -80, top: SLIDE_H - 340, width: 440, height: 440, borderRadius: 9999, background: "rgba(255,255,255,0.08)" }} />
      </div>
    ) : style.deco === "frame" ? (
      <div style={{ position: "absolute", left: 44, top: 44, right: 44, bottom: 44, border: `3px solid ${style.text}` }} />
    ) : style.deco === "grid" ? (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.05) 2px, transparent 2px)",
          backgroundSize: "90px 90px",
        }}
      />
    ) : null;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundImage: style.bg.length > 1 ? bg : undefined,
          backgroundColor: style.bg[0],
          color: style.text,
          fontFamily: sans,
          padding: "96px 104px 100px",
        }}
      >
        {deco}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700, color: style.muted }}>
          <span>{handle}</span>
          <span>{`${index + 1}/${total}`}</span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: align,
            justifyContent: slide.kind === "content" ? "flex-start" : "center",
            marginTop: slide.kind === "content" ? 70 : 0,
            textAlign,
          }}
        >
          {slide.kind === "content" && (
            <div style={{ fontSize: 150, fontWeight: 800, color: style.accent, fontFamily: titleFamily, lineHeight: 1 }}>
              {String(index).padStart(2, "0")}
            </div>
          )}
          {slide.kind === "hook" && <div style={{ width: 100, height: 12, borderRadius: 6, background: style.accent, marginBottom: 44 }} />}
          <div
            style={{
              fontSize: titleSize(title, slide.kind),
              fontWeight: 800,
              lineHeight: 1.06,
              fontFamily: titleFamily,
              marginTop: slide.kind === "content" ? 50 : 0,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: bodySize(slide.body), fontWeight: 400, lineHeight: 1.4, color: style.muted, marginTop: 44 }}>
            {slide.body}
          </div>
          {slide.kind === "cta" && (
            <div
              style={{
                marginTop: 64,
                display: "flex",
                padding: "28px 56px",
                borderRadius: 999,
                background: style.accent,
                color: style.onAccent,
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              {handle ? `Seguime ${handle}` : "Seguime para más"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{ flex: 1, height: 8, borderRadius: 4, background: style.text, opacity: i <= index ? 1 : 0.18, backgroundColor: i <= index ? style.accent : style.text }}
            />
          ))}
        </div>
      </div>
    ),
    { width: SLIDE_W, height: SLIDE_H, fonts: fonts.length ? fonts : undefined, emoji: "twemoji" }
  );

  const png = Buffer.from(await image.arrayBuffer());
  return sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
