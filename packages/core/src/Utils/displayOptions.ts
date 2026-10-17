import { TZDate } from "@date-fns/tz";
import { format, getISOWeek, getWeek } from "date-fns";
import type { Config } from "../types/types";
import { getLocale } from "./locate";
import { resolveWeekStartsOn } from "./calendarRange";

/*
 * Display options shared by every view (FullCalendar names, same defaults
 * as before they existed — so existing configs render unchanged).
 */

type DisplayConfig = Partial<
  Pick<
    Config,
    | "eventTimeFormat"
    | "slotLabelFormat"
    | "slotLabelInterval"
    | "slotDuration"
    | "dayMaxEvents"
    | "weekNumberCalculation"
    | "weekStartsOn"
    | "lang"
    | "timeZone"
  >
>;

export const DEFAULT_TIME_FORMAT = "HH:mm";
export const DEFAULT_DAY_MAX_EVENTS = 3;

/** Formats an instant with a date-fns pattern in the calendar time zone and language. */
const formatIn = (date: Date | string, pattern: string, config?: DisplayConfig) => {
  const value = typeof date === "string" ? new Date(date) : date;
  const zoned = config?.timeZone ? new TZDate(value, config.timeZone) : value;
  try {
    return format(zoned, pattern, { locale: getLocale(config?.lang) });
  } catch {
    // An invalid user pattern must not break rendering.
    return format(zoned, DEFAULT_TIME_FORMAT);
  }
};

/** Event start/end time, e.g. "14:00" or "2:00 PM" (`eventTimeFormat`). */
export const formatEventTime = (date: Date | string, config?: DisplayConfig) =>
  formatIn(date, config?.eventTimeFormat || DEFAULT_TIME_FORMAT, config);

/** Time-grid label (`slotLabelFormat`). */
export const formatSlotLabel = (date: Date | string, config?: DisplayConfig) =>
  formatIn(date, config?.slotLabelFormat || DEFAULT_TIME_FORMAT, config);

/**
 * Whether the grid label at `minutesFromStart` is shown: every
 * `slotLabelInterval` minutes (default: every slot).
 */
export const showsSlotLabel = (minutesFromStart: number, config?: DisplayConfig) => {
  const interval = Number(config?.slotLabelInterval);
  if (!interval || interval <= 0) return true;
  return minutesFromStart % interval === 0;
};

/** `dayMaxEvents` → number of chips shown per month cell (Infinity = no limit). */
export const resolveDayMaxEvents = (config?: DisplayConfig): number => {
  const value = config?.dayMaxEvents;
  if (value === false) return Infinity;
  if (value === true || value === undefined || value === null) return DEFAULT_DAY_MAX_EVENTS;
  return value > 0 ? Math.floor(value) : DEFAULT_DAY_MAX_EVENTS;
};

/** Week number of `date` (`weekNumberCalculation`: "local" follows weekStartsOn, or "ISO"). */
export const weekNumberOf = (date: Date, config?: DisplayConfig): number => {
  if (config?.weekNumberCalculation === "ISO") return getISOWeek(date);
  const locale = getLocale(config?.lang);
  return getWeek(date, {
    weekStartsOn: resolveWeekStartsOn(config),
    firstWeekContainsDate: locale.options?.firstWeekContainsDate ?? 1,
  });
};
