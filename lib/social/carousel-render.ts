import type { CarouselSlide } from "./types";

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

export type CarouselStyle = {
  id: string;
  name: string;
  bg: string[];
  text: string;
  muted: string;
  accent: string;
  /** Text color on top of the accent color (CTA pill). */
  onAccent: string;
  serif?: boolean;
  align: "left" | "center";
  deco: "none" | "glow" | "blobs" | "grid" | "frame";
};

export const CAROUSEL_STYLES: CarouselStyle[] = [
  { id: "noche", name: "Noche premium", bg: ["#0b0b10", "#1a1724"], text: "#f6f3ea", muted: "#a8a29e", accent: "#d4b46a", onAccent: "#0b0b10", align: "left", deco: "glow" },
  { id: "gradiente", name: "Gradiente", bg: ["#5a1fe0", "#db2777"], text: "#ffffff", muted: "rgba(255,255,255,0.78)", accent: "#ffffff", onAccent: "#5a1fe0", align: "left", deco: "blobs" },
  { id: "minimal", name: "Minimal", bg: ["#f5f1ea", "#f5f1ea"], text: "#151515", muted: "#57534e", accent: "#151515", onAccent: "#f5f1ea", align: "left", deco: "none" },
  { id: "editorial", name: "Editorial", bg: ["#ffffff", "#ffffff"], text: "#111111", muted: "#525252", accent: "#e11d48", onAccent: "#ffffff", serif: true, align: "center", deco: "frame" },
  { id: "neon", name: "Neón", bg: ["#050505", "#0b0b0b"], text: "#f5f5f5", muted: "#a3a3a3", accent: "#c6ff3d", onAccent: "#050505", align: "left", deco: "grid" },
  { id: "oceano", name: "Océano", bg: ["#0c1f3f", "#0e7490"], text: "#ecfeff", muted: "rgba(236,254,255,0.75)", accent: "#67e8f9", onAccent: "#0c1f3f", align: "center", deco: "glow" },
];

export function getStyle(id: string) {
  return CAROUSEL_STYLES.find((s) => s.id === id) ?? CAROUSEL_STYLES[0];
}

function fontFamilies(style: CarouselStyle) {
  const sans = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "system-ui, sans-serif";
  return { title: style.serif ? 'Georgia, "Times New Roman", serif' : sans, body: sans };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

type TextBlock = { lines: string[]; size: number; lineHeight: number; font: string; color: string };

/** Fits text into a box, shrinking the font size until it fits. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: { family: string; weight: number; size: number; min: number; maxWidth: number; maxHeight: number; lh: number; color: string }
): TextBlock {
  let size = opts.size;
  for (;;) {
    const font = `${opts.weight} ${size}px ${opts.family}`;
    ctx.font = font;
    const lines = wrap(ctx, text, opts.maxWidth);
    const h = lines.length * size * opts.lh;
    if (h <= opts.maxHeight || size <= opts.min) return { lines, size, lineHeight: size * opts.lh, font, color: opts.color };
    size -= 4;
  }
}

function blockHeight(b: TextBlock) {
  return b.lines.length * b.lineHeight;
}

function drawBlock(ctx: CanvasRenderingContext2D, b: TextBlock, x: number, y: number, align: "left" | "center") {
  ctx.font = b.font;
  ctx.fillStyle = b.color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  b.lines.forEach((l, i) => ctx.fillText(l, x, y + i * b.lineHeight + (b.lineHeight - b.size) / 2));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D, s: CarouselStyle, index: number) {
  const g = ctx.createLinearGradient(0, 0, SLIDE_W, SLIDE_H);
  s.bg.forEach((c, i) => g.addColorStop(s.bg.length === 1 ? 0 : i / (s.bg.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

  if (s.deco === "glow") {
    const cx = index % 2 ? 180 : SLIDE_W - 120;
    const rg = ctx.createRadialGradient(cx, 160, 0, cx, 160, 720);
    rg.addColorStop(0, `${s.accent}38`);
    rg.addColorStop(1, `${s.accent}00`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
  } else if (s.deco === "blobs") {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(index % 2 ? 80 : SLIDE_W - 60, 220, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(index % 2 ? SLIDE_W - 100 : 140, SLIDE_H - 120, 220, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.deco === "grid") {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= SLIDE_W; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SLIDE_H);
      ctx.stroke();
    }
    for (let y = 0; y <= SLIDE_H; y += 90) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SLIDE_W, y);
      ctx.stroke();
    }
  } else if (s.deco === "frame") {
    ctx.strokeStyle = s.text;
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, SLIDE_W - 88, SLIDE_H - 88);
  }
}

export function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: CarouselSlide,
  index: number,
  total: number,
  style: CarouselStyle,
  handle: string
) {
  const f = fontFamilies(style);
  const pad = 104;
  const innerW = SLIDE_W - pad * 2;
  const x = style.align === "center" ? SLIDE_W / 2 : pad;

  ctx.clearRect(0, 0, SLIDE_W, SLIDE_H);
  drawBackground(ctx, style, index);

  // Header: handle + counter
  ctx.textBaseline = "top";
  ctx.font = `600 30px ${f.body}`;
  ctx.fillStyle = style.muted;
  ctx.textAlign = "left";
  ctx.fillText(handle ? `@${handle.replace(/^@/, "")}` : "", pad, 96);
  ctx.textAlign = "right";
  ctx.fillText(`${index + 1}/${total}`, SLIDE_W - pad, 96);

  // Progress bar
  const barY = SLIDE_H - 110;
  const gap = 10;
  const segW = (innerW - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i <= index ? style.accent : style.text;
    ctx.globalAlpha = i <= index ? 1 : 0.18;
    roundRect(ctx, pad + i * (segW + gap), barY, segW, 8, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const top = 190;
  const bottom = barY - 70;
  const avail = bottom - top;

  if (slide.kind === "content") {
    const num = String(index).padStart(2, "0");
    ctx.font = `800 150px ${f.title}`;
    ctx.fillStyle = style.accent;
    ctx.textAlign = style.align;
    ctx.textBaseline = "top";
    ctx.fillText(num, x, top);
    const title = fitText(ctx, slide.title.replace(/^\d+\.\s*/, ""), {
      family: f.title, weight: 750, size: 78, min: 44, maxWidth: innerW, maxHeight: avail * 0.42, lh: 1.12, color: style.text,
    });
    const body = fitText(ctx, slide.body, {
      family: f.body, weight: 400, size: 44, min: 28, maxWidth: innerW, maxHeight: avail - 200 - blockHeight(title) - 48, lh: 1.42, color: style.muted,
    });
    const ty = top + 200;
    drawBlock(ctx, title, x, ty, style.align);
    drawBlock(ctx, body, x, ty + blockHeight(title) + 44, style.align);
    return;
  }

  if (slide.kind === "hook") {
    const title = fitText(ctx, slide.title, {
      family: f.title, weight: 800, size: 112, min: 56, maxWidth: innerW, maxHeight: avail * 0.66, lh: 1.04, color: style.text,
    });
    const body = fitText(ctx, slide.body, {
      family: f.body, weight: 500, size: 46, min: 30, maxWidth: innerW, maxHeight: avail * 0.24, lh: 1.35, color: style.muted,
    });
    const total = blockHeight(title) + 56 + blockHeight(body);
    const y0 = top + Math.max(0, (avail - total) / 2);
    // Accent rule above the title
    ctx.fillStyle = style.accent;
    roundRect(ctx, style.align === "center" ? SLIDE_W / 2 - 50 : pad, y0 - 56, 100, 12, 6);
    ctx.fill();
    drawBlock(ctx, title, x, y0, style.align);
    drawBlock(ctx, body, x, y0 + blockHeight(title) + 56, style.align);
    return;
  }

  // CTA
  const title = fitText(ctx, slide.title, {
    family: f.title, weight: 800, size: 100, min: 52, maxWidth: innerW, maxHeight: avail * 0.4, lh: 1.06, color: style.text,
  });
  const body = fitText(ctx, slide.body, {
    family: f.body, weight: 400, size: 44, min: 28, maxWidth: innerW, maxHeight: avail * 0.32, lh: 1.4, color: style.muted,
  });
  const pillText = handle ? `Seguime @${handle.replace(/^@/, "")}` : "Seguime para más";
  ctx.font = `700 40px ${f.body}`;
  const pillW = Math.min(innerW, ctx.measureText(pillText).width + 100);
  const pillH = 104;
  const total2 = blockHeight(title) + 48 + blockHeight(body) + 72 + pillH;
  const y0 = top + Math.max(0, (avail - total2) / 2);
  drawBlock(ctx, title, x, y0, style.align);
  const by = y0 + blockHeight(title) + 48;
  drawBlock(ctx, body, x, by, style.align);
  const py = by + blockHeight(body) + 72;
  const px = style.align === "center" ? SLIDE_W / 2 - pillW / 2 : pad;
  ctx.fillStyle = style.accent;
  roundRect(ctx, px, py, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = style.onAccent;
  ctx.font = `700 40px ${f.body}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, px + pillW / 2, py + pillH / 2 + 2);
}

export async function renderSlideBlob(slide: CarouselSlide, index: number, total: number, style: CarouselStyle, handle: string) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;
  const ctx = canvas.getContext("2d")!;
  drawSlide(ctx, slide, index, total, style, handle);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png")
  );
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "carrusel"
  );
}
