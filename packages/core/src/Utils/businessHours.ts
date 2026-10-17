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
