import { format, startOfDay, endOfDay, addMinutes, differenceInMinutes, setHours, setMinutes, startOfWeek, addDays } from "date-fns";
import { RRule, rrulestr } from "rrule";
import { TZDate } from "@date-fns/tz";
import { EventProps } from "../types/types";
import { ensureDate } from "./DateTrannforms";


export const calculateNumberOfSlots = (slotMin: string, slotMax: string, slotDuration: number): number => {
  const startHour = parseInt(slotMin, 10);
  const endHour = parseInt(slotMax, 10);
  return ((endHour - startHour) * 60) / slotDuration;
};


export const getCurrentWeekStart = (
  currentDate: Date,
  timeZone: string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
): Date => {
  return startOfWeek(new TZDate(currentDate, timeZone), { weekStartsOn });
};


export const generateDaysOfWeek = (): number[] => {
  return Array.from({ length: 7 }, (_, i) => i);
};

export const generateTimeSlots = (numberOfSlots: number): number[] => {
  return Array.from({ length: numberOfSlots }, (_, i) => i);
};


/**
 * Segment metadata attached to a timed event that was clipped to a single
 * day window (professional-calendar behavior: a timed event crossing
 * midnight renders as one clipped segment per day, like Google Calendar /
 * FullCalendar timeGrid — NOT as an all-day banner).
 */
export interface EventSegmentMeta {
  /** This segment contains the event's real start. */
  isStart: boolean;
  /** This segment contains the event's real end. */
  isEnd: boolean;
  /** The event's true bounds (segment start/end are clipped). */
  originalStart: string;
  originalEnd: string;
}

const BANNER_MIN_MINUTES = 24 * 60;

/**
 * Banner (all-day row) classification: explicit all-day events, or timed
 * events spanning >= 24h. Timed events under 24h that merely cross midnight
 * are NOT banners — they render in the time grid as clipped segments.
 */
export const isBannerEvent = (event: EventProps, timeZone?: string): boolean => {
  if (event.isAllDay || event.allDay) return true;
  const start = ensureDate(event.start, timeZone);
  const end = ensureDate(event.end, timeZone);
  return differenceInMinutes(end, start) >= BANNER_MIN_MINUTES;
};

/**
 * Clip a timed event to one day window [00:00, next day 00:00) in the
 * configured timezone.
 *
 * Returns:
 *  - the event untouched when it fits entirely inside the day (fast path);
 *  - a segment copy with clipped start/end and `__segment` metadata when it
 *    overlaps the day partially. Continuation segments (not containing the
 *    real start) get a distinct `id` (`<id>::cont`) so they can never
 *    register a draggable that collides with the start segment's id;
 *  - null when the event does not overlap the day at all.
 */
export const clipEventToDay = (
  event: EventProps,
  dayDate: Date,
  timeZone?: string
): EventProps | null => {
  const dayStart = startOfDay(new TZDate(dayDate, timeZone));
  const nextDayStart = addDays(dayStart, 1);
  const start = ensureDate(event.start, timeZone);
  const end = ensureDate(event.end, timeZone);

  // No overlap with this day.
  if (start.getTime() >= nextDayStart.getTime() || end.getTime() <= dayStart.getTime()) {
    return null;
  }

  const isStart = start.getTime() >= dayStart.getTime();
  const isEnd = end.getTime() <= nextDayStart.getTime();
  if (isStart && isEnd) return event;

  const clippedStart = isStart ? start : dayStart;
  const clippedEnd = isEnd ? end : nextDayStart;
  const meta: EventSegmentMeta = {
    isStart,
    isEnd,
    originalStart: new Date(start.getTime()).toISOString(),
    originalEnd: new Date(end.getTime()).toISOString(),
  };
  return {
    ...event,
    id: isStart ? event.id : `${event.id}::cont`,
    start: new Date(clippedStart.getTime()).toISOString(),
    end: new Date(clippedEnd.getTime()).toISOString(),
    __segment: meta,
  };
};

export const getEventsForSlot = (slotTime: string, events: EventProps[], config: any): EventProps[] => {
  const slotDate = new TZDate(slotTime, config?.timeZone);
  const slotDuration = config?.slotDuration || 30;
  const slotEnd = addMinutes(slotDate, slotDuration);
  // An event belongs to a slot when its start falls within [slotStart, slotStart + slotDuration).
  const startsInSlot = (date: Date) => date.getTime() >= slotDate.getTime() && date.getTime() < slotEnd.getTime();
  return events.reduce((acc: EventProps[], event: EventProps) => {
    if (event.recurrence) {
      try {
        const eventStart = new TZDate(ensureDate(event.start), config?.timeZone);
        const eventEnd = new TZDate(ensureDate(event.end), config?.timeZone);
        // Anchor the recurrence to the event's own start so occurrences are generated correctly.
        const localStart = new Date(
          eventStart.getFullYear(),
          eventStart.getMonth(),
          eventStart.getDate(),
          eventStart.getHours(),
          eventStart.getMinutes(),
          eventStart.getSeconds()
        );
        const ruleOptions = rrulestr(event.recurrence, { forceset: true }).options;
        ruleOptions.dtstart = localStart;
        const rule = new RRule(ruleOptions);
        const occurrences = rule.between(startOfDay(slotDate), endOfDay(slotDate), true);
        occurrences.forEach((occurrence) => {
          const occurrenceStart = setMinutes(
            setHours(new TZDate(occurrence, config?.timeZone), eventStart.getHours()),
            eventStart.getMinutes()
          );
          const occurrenceEnd = addMinutes(
            occurrenceStart,
            differenceInMinutes(eventEnd, eventStart)
          );
          if (startsInSlot(occurrenceStart)) {
            acc.push({
              ...event,
              start: occurrenceStart.toISOString(),
              end: occurrenceEnd.toISOString(),
              isRecurrenceInstance: true,
              originalEventId: event.id,
            });
          }
        });
      } catch (error) {
        console.error("Error parsing recurrence rule:", error);
      }
      return acc;
    }
    // Banner events (all-day, or >= 24h) live in the all-day row, never in
    // the time grid.
    if (isBannerEvent(event, config?.timeZone)) return acc;
    // Timed events are clipped to this slot's day — a 22:00 -> 01:00 event
    // yields a 22:00-24:00 segment on day one and a 00:00-01:00 continuation
    // segment on day two (which starts at midnight and therefore lands in
    // the day's first slot).
    const segment = clipEventToDay(event, slotDate, config?.timeZone);
    if (!segment) return acc;
    if (startsInSlot(new TZDate(ensureDate(segment.start), config?.timeZone))) {
      acc.push(segment);
    }
    return acc;
  }, []);
};