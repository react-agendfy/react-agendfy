import { TZDate } from "@date-fns/tz";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Config, ValidRange, Weekday } from "../types/types";
import { getLocale } from "./locate";
import { getNewDate } from "./calendarNavigation";

/*
 * Day-level calendar rules shared by every view: first day of the week,
 * hidden weekdays and the valid (interactive) date range.
 */

type RangeConfig = Partial<
  Pick<Config, "weekStartsOn" | "hiddenDays" | "weekends" | "validRange" | "lang" | "timeZone" | "listRange">
>;

/** Explicit `weekStartsOn`, else the locale's convention, else Sunday. */
export const resolveWeekStartsOn = (config?: RangeConfig): Weekday => {
  if (config?.weekStartsOn !== undefined) return config.weekStartsOn;
  const localeStart = getLocale(config?.lang).options?.weekStartsOn;
  return (localeStart ?? 0) as Weekday;
};

/**
 * Hidden weekdays from `hiddenDays` + `weekends: false`. Hiding all seven
 * days is ignored (nothing could ever render).
 */
export const getHiddenDays = (config?: RangeConfig): Set<number> => {
  const hidden = new Set<number>(
    (config?.hiddenDays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
  if (config?.weekends === false) {
    hidden.add(0);
    hidden.add(6);
  }
  return hidden.size >= 7 ? new Set() : hidden;
};

export const isHiddenDay = (date: Date, hidden: Set<number>) => hidden.has(date.getDay());

/** Offsets (0–6) from the week start of the days that are rendered. */
export const getVisibleDayOffsets = (weekStartsOn: Weekday, hidden: Set<number>): number[] =>
  Array.from({ length: 7 }, (_, i) => i).filter((o) => !hidden.has((weekStartsOn + o) % 7));

/** "YYYY-MM-DD" → that day in the calendar time zone; anything else → its day. */
const toDayStart = (value: string | Date, timeZone?: string): Date => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return timeZone ? new TZDate(y, m - 1, d, timeZone) : new Date(y, m - 1, d);
  }
  const date = value instanceof Date ? value : new Date(value);
  return startOfDay(timeZone ? new TZDate(date, timeZone) : date);
};

export interface ResolvedValidRange {
  /** First valid day (inclusive), or null when unbounded. */
  start: Date | null;
  /** First INVALID day (exclusive end), or null when unbounded. */
  end: Date | null;
}

export const resolveValidRange = (range?: ValidRange, timeZone?: string): ResolvedValidRange => ({
  start: range?.start ? toDayStart(range.start, timeZone) : null,
  end: range?.end ? toDayStart(range.end, timeZone) : null,
});

/** True when the day containing `date` is inside the valid range. */
export const isDayInRange = (date: Date, range: ResolvedValidRange): boolean => {
  const t = date.getTime();
  if (range.start && endOfDay(date).getTime() < range.start.getTime()) return false;
  if (range.end && t >= range.end.getTime()) return false;
  return true;
};

/** Everything a view needs to decide which days render and which are inert. */
export interface DayRules {
  weekStartsOn: Weekday;
  hidden: Set<number>;
  validRange: ResolvedValidRange;
  /** Span of the list view (navigation steps by it). */
  listRange: "day" | "week" | "month";
  isHidden: (date: Date) => boolean;
  isDisabled: (date: Date) => boolean;
}

export const getDayRules = (config?: RangeConfig): DayRules => {
  const hidden = getHiddenDays(config);
  const validRange = resolveValidRange(config?.validRange, config?.timeZone);
  return {
    weekStartsOn: resolveWeekStartsOn(config),
    hidden,
    validRange,
    listRange: config?.listRange ?? "month",
    isHidden: (date) => hidden.has(date.getDay()),
    isDisabled: (date) => !isDayInRange(date, validRange),
  };
};

/** The date span a view displays for `date` (used for navigation limits). */
export const getViewPeriod = (
  view: string,
  date: Date,
  weekStartsOn: Weekday
): { start: Date; end: Date } => {
  switch (view) {
    case "day":
      return { start: startOfDay(date), end: endOfDay(date) };
    case "week":
      return { start: startOfWeek(date, { weekStartsOn }), end: endOfWeek(date, { weekStartsOn }) };
    case "agenda":
      return { start: startOfDay(date), end: endOfDay(addDays(date, 6)) };
    default:
      return { start: startOfMonth(date), end: endOfMonth(date) };
  }
};

/**
 * Window recurring events are expanded over: the whole month grid (with
 * leading/trailing weeks) padded by a week on each side, which covers every
 * built-in view for `date` regardless of the active view.
 */
export const getExpansionWindow = (date: Date, weekStartsOn: Weekday) => ({
  start: addDays(startOfWeek(startOfMonth(date), { weekStartsOn }), -7),
  end: addDays(endOfWeek(endOfMonth(date), { weekStartsOn }), 7),
});

const periodOverlapsRange = (period: { start: Date; end: Date }, range: ResolvedValidRange) =>
  (!range.end || period.start.getTime() < range.end.getTime()) &&
  (!range.start || period.end.getTime() >= range.start.getTime());

/** Moves `date` into the valid range (no-op when already inside). */
export const clampToValidRange = (date: Date, range: ResolvedValidRange): Date => {
  if (range.start && date.getTime() < range.start.getTime()) return range.start;
  if (range.end && date.getTime() >= range.end.getTime()) return addDays(range.end, -1);
  return date;
};

/**
 * Next date for prev/next navigation, or null when the destination period
 * lies entirely outside the valid range. The day view skips hidden weekdays.
 */
export const getNavigationTarget = (
  view: string,
  date: Date,
  direction: 1 | -1,
  rules: DayRules
): Date | null => {
  // The list view navigates by its own span (listRange).
  const stepView = view === "list" ? rules.listRange : view;
  let target = getNewDate(date, stepView, direction);
  if (stepView === "day") {
    for (let i = 0; i < 7 && rules.isHidden(target); i++) target = addDays(target, direction);
  }
  if (!periodOverlapsRange(getViewPeriod(stepView, target, rules.weekStartsOn), rules.validRange)) {
    return null;
  }
  return stepView === "day" ? clampToValidRange(target, rules.validRange) : target;
};

/**
 * The dates a view actually shows, as [start, end) — `end` is EXCLUSIVE
 * (FullCalendar's convention). The month view includes the leading and
 * trailing days of the grid (6 weeks with fixedWeekCount).
 */
export const getVisibleRange = (
  view: string,
  date: Date,
  config?: RangeConfig & { fixedWeekCount?: boolean }
): { start: Date; end: Date } => {
  const weekStartsOn = resolveWeekStartsOn(config);
  const span = view === "list" ? config?.listRange ?? "month" : view;
  switch (span) {
    case "day":
      return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
    case "week":
      return {
        start: startOfWeek(date, { weekStartsOn }),
        end: addDays(startOfWeek(date, { weekStartsOn }), 7),
      };
    case "agenda":
      return { start: startOfDay(date), end: addDays(startOfDay(date), 7) };
    case "month":
      if (view === "list") {
        return { start: startOfMonth(date), end: addDays(endOfMonth(date), 1) };
      }
      {
        const start = startOfWeek(startOfMonth(date), { weekStartsOn });
        const end = config?.fixedWeekCount
          ? addDays(start, 42)
          : addDays(startOfDay(endOfWeek(endOfMonth(date), { weekStartsOn })), 1);
        return { start, end };
      }
    default:
      // Custom views: the month grid is the safest superset.
      return getVisibleRange("month", date, config);
  }
};
