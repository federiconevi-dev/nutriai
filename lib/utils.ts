import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function slugifyId() {
  return Math.random().toString(36).slice(2, 10);
}

export function aspectRatioToClass(ratio: string) {
  switch (ratio) {
    case "RATIO_9_16":
      return "aspect-[9/16]";
    case "RATIO_1_1":
      return "aspect-square";
    case "RATIO_16_9":
    default:
      return "aspect-video";
  }
}

export function aspectRatioLabel(ratio: string) {
  switch (ratio) {
    case "RATIO_9_16":
      return "9:16";
    case "RATIO_1_1":
      return "1:1";
    case "RATIO_16_9":
    default:
      return "16:9";
  }
}
