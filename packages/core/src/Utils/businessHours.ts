import { useMemo } from "react";
import { set } from "date-fns";

export interface BusinessHour {
  daysOfWeek: number[]; // Ex.: [1,2,3,4,5] (segunda a sexta)
  startTime: string;    // "HH:mm" ex.: "09:00"
  endTime: string;      // "HH:mm" ex.: "17:00"
}

export interface BusinessHoursConfig {
  enabled: boolean;
  intervals: BusinessHour[];
}


export function getBusinessHoursIntervalsForDate(
  date: Date,
  config: BusinessHoursConfig
): { start: Date; end: Date }[] {
  if (!config.enabled) return [];
  return config.intervals.reduce((acc, interval) => {
    const day = date.getDay(); // 0=Domingo, 1=Segunda, etc.
    if (interval.daysOfWeek.includes(day)) {
      const start = getTimeForDate(date, interval.startTime);
      const end = getTimeForDate(date, interval.endTime);
      acc.push({ start, end });
    }
    return acc;
  }, [] as { start: Date; end: Date }[]);
}

// `set` keeps the input's constructor, so a TZDate stays in the calendar
// time zone (a plain `new Date(...).setHours` used the HOST zone instead).
function getTimeForDate(baseDate: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  return set(baseDate, { hours, minutes: minutes || 0, seconds: 0, milliseconds: 0 });
}


export function useBusinessHours(currentDate: Date, businessHoursConfig?: BusinessHoursConfig) {
  return useMemo(() => {
    if (!businessHoursConfig || !businessHoursConfig.enabled) return [];
    return getBusinessHoursIntervalsForDate(currentDate, businessHoursConfig);
  }, [currentDate, businessHoursConfig]);
}

/**
 * The gaps between `ranges` inside [0, total): the time that is NOT
 * business time, in the same unit (minutes from the grid start). Ranges may
 * overlap or stick out of the window.
 */
export function complementRanges(ranges: { from: number; to: number }[], total: number): { from: number; to: number }[] {
  const sorted = ranges
    .map((r) => ({ from: Math.max(0, r.from), to: Math.min(total, r.to) }))
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from);
  const gaps: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.from > cursor) gaps.push({ from: cursor, to: r.from });
    cursor = Math.max(cursor, r.to);
  }
  if (cursor < total) gaps.push({ from: cursor, to: total });
  return gaps;
}
