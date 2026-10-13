export const LOCALE = "es-AR";

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-based start of week. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 6x7 grid of dates covering the month, Monday first. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function formatMonth(d: Date) {
  const s = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatPostDate(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatShortDate(d: Date) {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }).format(d);
}

export function formatLongDay(d: Date) {
  const s = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatCompact(n: number) {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat(LOCALE).format(Math.round(n));
}

export function formatPct(n: number, digits = 1) {
  return `${new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}%`;
}
