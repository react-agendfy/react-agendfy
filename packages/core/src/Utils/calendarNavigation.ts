// src/Utils/calendarNavigation.ts
import { addDays, addWeeks, addMonths } from "date-fns";

/** The span a view navigates and shows: resource views follow their base view. */
export const viewSpan = (view: string): string =>
  view === "resourceDay" ? "day" : view === "resourceWeek" ? "week" : view;

export function getNewDate(currentDate: Date, view: string, direction: number): Date {
  switch (viewSpan(view)) {
    case "day":
      return addDays(currentDate, direction);
    case "week":
      return addWeeks(currentDate, direction);
    case "month":
    case "list":
      return addMonths(currentDate, direction);
    default:
      return addWeeks(currentDate, direction);
  }
}
