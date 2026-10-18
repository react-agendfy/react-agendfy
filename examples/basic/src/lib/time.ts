/**
 * Tiny time-zone helpers for the demo's forms: the calendar runs in a
 * configurable IANA zone, so "10:00" in the modal means 10:00 THERE, not in
 * the browser's zone. Intl-only, no extra dependency.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();
const formatter = (timeZone: string) => {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
};

export interface ZonedParts {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/** Wall-clock parts of `date` in `timeZone`. */
export function zonedParts(date: Date | string, timeZone: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(date))) p[part.type] = part.value;
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year,
    month,
    day,
    hour,
    minute,
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  };
}

/** The instant whose wall clock in `timeZone` is `date` + `time`. */
export function fromZoned(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = (time || "00:00").split(":").map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset, DST transitions included.
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wanted - seen;
  }
  return new Date(guess);
}

/** "yyyy-MM-dd" of `date` in `timeZone`. */
export const dayKey = (date: Date | string, timeZone: string) => zonedParts(date, timeZone).date;

/** Adds days to a "yyyy-MM-dd" key (calendar arithmetic, zone-free). */
export function addDaysKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function formatTime(date: Date | string, timeZone: string, hour12: boolean, lang = "en") {
  return new Intl.DateTimeFormat(lang, { timeZone, hour: "numeric", minute: "2-digit", hour12 }).format(
    new Date(date)
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const avatarPalette = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#f43f5e", "#8b5cf6", "#22c55e"];
export function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return avatarPalette[Math.abs(h) % avatarPalette.length];
}
