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


export const getCurrentWeekStart = (currentDate: Date, timeZone: string, weekStartsOn = 0): Date => {
  return startOfWeek(new TZDate(currentDate, timeZone), { weekStartsOn });
};


export const generateDaysOfWeek = (): number[] => {
  return Array.from({ length: 7 }, (_, i) => i);
};

export const generateTimeSlots = (numberOfSlots: number): number[] => {
  return Array.from({ length: numberOfSlots }, (_, i) => i);
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
    if (event.isMultiDay || event.isAllDay) return acc;
    if (startsInSlot(new TZDate(ensureDate(event.start), config?.timeZone))) {
      acc.push(event);
    }
    return acc;
  }, []);
};