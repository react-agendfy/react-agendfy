import { useContext } from "react";
import {
  CalendarContext,
  CalendarContextValue,
} from "../context/CalendarContext";

/**
 * Access the shared calendar state, derived data and handlers.
 * Must be used within a <CalendarProvider> (rendered by <Calendar>).
 */
export function useCalendarState(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error("useCalendarState must be used within a CalendarProvider");
  }
  return ctx;
}

export default useCalendarState;
