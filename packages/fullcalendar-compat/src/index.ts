/**
 * @react-agendfy/fullcalendar-compat — @fullcalendar/react's API on top of
 * react-agendfy. Swap the import:
 *
 *   import FullCalendar from "@react-agendfy/fullcalendar-compat";
 *
 * and keep your options, callbacks and `ref.current.getApi()` calls.
 * Remember to load the calendar styles once: `@react-agendfy/core/core.css`.
 */
import FullCalendar from "./FullCalendar";

export default FullCalendar;
export { FullCalendar };
export type { FullCalendarHandle } from "./FullCalendar";
export { createEventApi, formatIsoInZone } from "./eventApi";
export {
  durationToMinutes,
  formatterToPattern,
  headerViewsFrom,
  toAgendfyConfig,
  toAgendfyEvent,
  toAgendfyEvents,
  toAgendfyView,
  toFcView,
  toLang,
} from "./convert";
export type * from "./types";
