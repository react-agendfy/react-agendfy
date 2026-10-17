import { TZDate } from "@date-fns/tz";
import { parseISO } from "date-fns";
import type { EventProps } from "../types/types";
import { expandRecurrences } from "./recurrence";

/**
 * @deprecated Kept for backwards compatibility — use `expandRecurrences`
 * from Utils/recurrence (same behavior; adds exdate and rrule-object support).
 * The calendar context already expands recurring events for every view.
 */
export const expandRecurringEvents = <T extends EventProps>(
  events: T[],
  viewStartDate: Date,
  viewEndDate: Date,
  timezone?: string
): T[] => expandRecurrences(events, viewStartDate, viewEndDate, timezone);

// Função auxiliar para garantir que uma string de data seja um objeto Date válido

export const ensureDate = (
  dateInput: string | Date,
  timeZone?: string
): Date => {
  if (dateInput instanceof Date) {
    return timeZone ? new TZDate(dateInput, timeZone) : dateInput;
  }

  try {
    // parseISO é mais robusto e lida com vários formatos ISO 8601
    const parsedDate = parseISO(dateInput);
    return timeZone ? new TZDate(parsedDate, timeZone) : parsedDate;
  } catch (e) {
    console.error("Error converting date:", dateInput, e);
    // Retornar uma data inválida é mais seguro do que a data atual,
    // pois força o consumidor da função a tratar o erro.
    return new Date('invalid date');
  }
};
