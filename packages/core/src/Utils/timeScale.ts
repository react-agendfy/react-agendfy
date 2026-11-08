import { TZDate } from "@date-fns/tz";
import { addDays, startOfDay } from "date-fns";

/*
 * The time axis of the time-grid views (RFC 001, layer 3): maps instants to
 * pixels and back along one axis (`y` for week/day/resource columns, `x`
 * for timelines).
 *
 * The axis is made of one segment per visible day: the day's window
 * [dayStart, dayEnd) in the calendar time zone, laid end to end. Hidden
 * weekdays are left out, so the axis is not linear in time.
 *
 * Positions follow the WALL CLOCK, like Google Calendar and FullCalendar:
 * 10:00 is always at the 10:00 grid line, also on a DST day, whose real
 * length is 23 or 25 hours. Times that do not exist (spring forward) still
 * have a place; the repeated hour (fall back) maps twice to the same place.
 */

export interface TimeScaleOptions {
  /** First instant of the axis (rounded down to its day). */
  start: Date;
  /** End of the axis, exclusive (a day is included when it starts before `end`). */
  end: Date;
  timeZone: string;
  /** Minutes in one unit (a slot). */
  unitMinutes: number;
  /** Pixels per unit. */
  unitPx: number;
  /** Visible window of each day, in minutes from midnight. Default 0. */
  dayStartMinutes?: number;
  /** Default 1440 (end of the day). */
  dayEndMinutes?: number;
  /** Weekdays left out (0 = Sunday). */
  hiddenDays?: number[];
  orientation?: "x" | "y";
}

export interface TimeScaleSegment {
  /** Midnight of the day, in the calendar zone. */
  day: Date;
  /** Offset of the day's window on the axis, px. */
  offsetPx: number;
  lengthPx: number;
}

export interface TimeScale {
  orientation: "x" | "y";
  timeZone: string;
  /** Visible days, in order. */
  segments: TimeScaleSegment[];
  totalPx: number;
  pxPerMinute: number;
  /** Position of `date`. Outside the axis or a day's window: the nearest edge. */
  toPx: (date: Date | string) => number;
  /** The instant at `px` (clamped to the axis). */
  toDate: (px: number) => Date;
  /** `date` rounded to the nearest `stepMinutes` of its day's window. */
  snap: (date: Date, stepMinutes?: number) => Date;
  /** One tick every `stepMinutes` of every visible day, from the window start. */
  ticks: (stepMinutes: number) => { date: Date; px: number }[];
  /** The segment of the day containing `date`, or null when hidden/outside. */
  segmentOf: (date: Date | string) => TimeScaleSegment | null;
}

const DAY_MINUTES = 1440;

const wallMinutes = (date: TZDate) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

/** The instant at `minutes` of the wall clock on `day` (midnight, calendar zone). */
const atWallMinutes = (day: Date, minutes: number, timeZone: string): Date => {
  const d = new TZDate(day.getTime(), timeZone);
  const whole = Math.floor(minutes);
  const result = new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), 0, whole, Math.round((minutes - whole) * 60), timeZone);
  return new Date(result.getTime());
};

const dayKey = (date: TZDate) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function createTimeScale(options: TimeScaleOptions): TimeScale {
  const {
    timeZone,
    unitMinutes,
    unitPx,
    dayStartMinutes = 0,
    dayEndMinutes = DAY_MINUTES,
    hiddenDays = [],
    orientation = "y",
  } = options;
  const pxPerMinute = unitPx / unitMinutes;
  const windowMinutes = Math.max(0, dayEndMinutes - dayStartMinutes);
  const lengthPx = windowMinutes * pxPerMinute;
  const hidden = new Set(hiddenDays);

  const segments: TimeScaleSegment[] = [];
  const byKey = new Map<string, TimeScaleSegment>();
  const endMs = options.end.getTime();
  for (let day = startOfDay(new TZDate(options.start.getTime(), timeZone)); day.getTime() < endMs; day = addDays(day, 1)) {
    if (hidden.has(day.getDay())) continue;
    const segment = { day: new Date(day.getTime()), offsetPx: segments.length * lengthPx, lengthPx };
    segments.push(segment);
    byKey.set(dayKey(day), segment);
  }
  const totalPx = segments.length * lengthPx;

  const segmentOf = (date: Date | string) =>
    byKey.get(dayKey(new TZDate(new Date(date).getTime(), timeZone))) ?? null;

  const toPx = (date: Date | string): number => {
    if (!segments.length) return 0;
    const instant = new Date(date).getTime();
    const zoned = new TZDate(instant, timeZone);
    const segment = byKey.get(dayKey(zoned));
    if (segment) {
      const minutes = Math.min(dayEndMinutes, Math.max(dayStartMinutes, wallMinutes(zoned)));
      return segment.offsetPx + (minutes - dayStartMinutes) * pxPerMinute;
    }
    // A hidden day or outside the axis: the end of the last day before it.
    let px = 0;
    for (const s of segments) {
      if (s.day.getTime() > instant) break;
      px = s.offsetPx + s.lengthPx;
    }
    return px;
  };

  const toDate = (px: number): Date => {
    if (!segments.length) return new Date(options.start.getTime());
    const clamped = Math.min(totalPx, Math.max(0, px));
    const index = Math.min(segments.length - 1, lengthPx > 0 ? Math.floor(clamped / lengthPx) : 0);
    const segment = segments[index];
    return atWallMinutes(segment.day, dayStartMinutes + (clamped - segment.offsetPx) / pxPerMinute, timeZone);
  };

  const snap = (date: Date, stepMinutes = unitMinutes): Date => {
    const zoned = new TZDate(date.getTime(), timeZone);
    const day = startOfDay(zoned);
    const minutes = wallMinutes(zoned);
    const snapped = dayStartMinutes + Math.round((minutes - dayStartMinutes) / stepMinutes) * stepMinutes;
    return atWallMinutes(day, snapped, timeZone);
  };

  const ticks = (stepMinutes: number) =>
    segments.flatMap((segment) => {
      const out: { date: Date; px: number }[] = [];
      for (let m = dayStartMinutes; m < dayEndMinutes; m += stepMinutes) {
        out.push({ date: atWallMinutes(segment.day, m, timeZone), px: segment.offsetPx + (m - dayStartMinutes) * pxPerMinute });
      }
      return out;
    });

  return { orientation, timeZone, segments, totalPx, pxPerMinute, toPx, toDate, snap, ticks, segmentOf };
}

/** "HH:mm" → minutes from midnight; "23:59" (the old "end of day") counts as 1440. */
export const clockToMinutes = (clock: string | undefined, fallback: number): number => {
  if (!clock) return fallback;
  const [h, m] = clock.split(":").map(Number);
  if (!Number.isFinite(h)) return fallback;
  const minutes = h * 60 + (Number.isFinite(m) ? m : 0);
  return minutes >= DAY_MINUTES - 1 ? DAY_MINUTES : minutes;
};
