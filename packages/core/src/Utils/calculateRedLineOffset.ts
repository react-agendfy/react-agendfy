import {
    differenceInMinutes,
    isSameDay,
    setHours,
    startOfDay,
  } from "date-fns";
  import { TZDate } from "@date-fns/tz";
  import { DEFAULT_SLOT_HEIGHT } from "./slotHeight";
  
  export const calculateRedLineOffset = (
    currentDate: Date,
    parsedSlotMin: number,
    slotDuration: number,
    timeZone?: string,
    slotHeight: number = DEFAULT_SLOT_HEIGHT
  ): number => {
    const now = new TZDate(new Date(), timeZone);
    const isToday = isSameDay(currentDate, now);
    let redLineOffset = 0;
  
    if (isToday) {
      const viewStart = setHours(startOfDay(now), parsedSlotMin);
      let diffMinutes = differenceInMinutes(now, viewStart);
      if (diffMinutes < 0) diffMinutes = 0;
      redLineOffset = (diffMinutes / (slotDuration || 30)) * slotHeight;
    }
  
    return redLineOffset;
  };
/**
 * Pixel offset of the current-time line inside `day`'s column, or null when
 * the line must not show: `day` is not today, or now falls outside the
 * rendered [slotMin, slotMax] window. (calculateRedLineOffset above returns
 * 0 in those cases, which drew the line at the top of every column.)
 */
export const nowLineOffset = (
  day: Date,
  slotMinHours: number,
  slotMaxHours: number,
  slotDuration: number,
  timeZone?: string,
  now: Date = new Date(),
  /** Height of one slot in px (config.slotHeight). */
  slotHeight: number = DEFAULT_SLOT_HEIGHT
): number | null => {
  const zonedNow = new TZDate(now, timeZone);
  if (!isSameDay(new TZDate(day, timeZone), zonedNow)) return null;
  const minutes = zonedNow.getHours() * 60 + zonedNow.getMinutes() - slotMinHours * 60;
  if (minutes < 0 || minutes > (slotMaxHours - slotMinHours) * 60) return null;
  return (minutes / (slotDuration || 30)) * slotHeight;
};
