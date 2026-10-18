import type { ReactNode } from "react";

/*
 * The subset of FullCalendar's (v6) public API this package accepts. Names
 * and shapes follow FullCalendar so existing code type-checks unchanged;
 * see MIGRATING.md for what is supported, partial or ignored.
 */

export type DateInput = Date | string | number;

/** "01:30", "01:30:00", { hours, minutes, seconds, milliseconds, days } or milliseconds. */
export type DurationInput =
  | string
  | number
  | { days?: number; hours?: number; minutes?: number; seconds?: number; milliseconds?: number };

/** FullCalendar formatter object (Intl-like) or a date-fns pattern string. */
export type FormatterInput =
  | string
  | {
      hour?: "numeric" | "2-digit";
      minute?: "numeric" | "2-digit";
      second?: "numeric" | "2-digit";
      meridiem?: "short" | "narrow" | "lowercase" | false;
      hour12?: boolean;
      omitZeroMinute?: boolean;
    };

export interface EventInput {
  id?: string | number;
  groupId?: string;
  title?: string;
  start?: DateInput;
  end?: DateInput;
  allDay?: boolean;
  /** For recurring events: the occurrence length (FullCalendar `duration`). */
  duration?: DurationInput;
  rrule?: string | Record<string, unknown>;
  exdate?: DateInput | DateInput[];
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  url?: string;
  display?: string;
  editable?: boolean;
  extendedProps?: Record<string, unknown>;
  /** Any other key becomes an extendedProp (FullCalendar behaviour). */
  [key: string]: unknown;
}

export interface FetchInfo {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  timeZone: string;
}

export type EventSourceFunc = (
  info: FetchInfo,
  success: (events: EventInput[]) => void,
  failure: (error: Error) => void
) => void | Promise<EventInput[]>;

/** An array, a function, or a JSON feed URL (called with ?start=…&end=…). */
export type EventSourceInput =
  | EventInput[]
  | EventSourceFunc
  | string
  | { events: EventInput[] | EventSourceFunc | string; color?: string; id?: string };

export interface ViewApi {
  /** FullCalendar view name, e.g. "timeGridWeek". */
  type: string;
  title: string;
  activeStart: Date;
  activeEnd: Date;
  currentStart: Date;
  currentEnd: Date;
}

/** Read-only EventApi (FullCalendar shape, incl. `_def`). */
export interface EventApi {
  id: string;
  groupId: string;
  title: string;
  start: Date | null;
  end: Date | null;
  startStr: string;
  endStr: string;
  allDay: boolean;
  url: string;
  display: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: Record<string, any>;
  /** FullCalendar internals some apps read directly. */
  _def: { publicId: string; groupId: string; title: string; url: string; extendedProps: Record<string, any> };
  _instance: { range: { start: Date | null; end: Date | null } };
  toPlainObject(): Record<string, unknown>;
}

export interface EventClickArg {
  event: EventApi;
  el: HTMLElement | null;
  jsEvent: MouseEvent | null;
  view: ViewApi;
}

export interface DateClickArg {
  date: Date;
  dateStr: string;
  allDay: boolean;
  dayEl: HTMLElement | null;
  jsEvent: MouseEvent | null;
  view: ViewApi;
}

export interface DateSelectArg {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  allDay: boolean;
  jsEvent: MouseEvent | null;
  view: ViewApi;
}

interface Delta {
  years: number;
  months: number;
  days: number;
  milliseconds: number;
}

export interface EventDropArg {
  event: EventApi;
  oldEvent: EventApi;
  delta: Delta;
  revert: () => void;
  relatedEvents: EventApi[];
  el: HTMLElement | null;
  jsEvent: MouseEvent | null;
  view: ViewApi;
}

export interface EventResizeDoneArg {
  event: EventApi;
  oldEvent: EventApi;
  startDelta: Delta;
  endDelta: Delta;
  revert: () => void;
  relatedEvents: EventApi[];
  el: HTMLElement | null;
  jsEvent: MouseEvent | null;
  view: ViewApi;
}

export interface DatesSetArg {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  timeZone: string;
  view: ViewApi;
}

export interface EventContentArg {
  event: EventApi;
  timeText: string;
  isStart: boolean;
  isEnd: boolean;
  view: ViewApi;
}

/** ReactNode, or FullCalendar's `{ html }` (rendered as HTML). */
export type CustomContent = ReactNode | { html: string };

export interface BusinessHoursInput {
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
}

export interface ToolbarInput {
  left?: string;
  center?: string;
  right?: string;
  start?: string;
  end?: string;
}

/** Imperative API returned by `ref.current.getApi()`. */
export interface CalendarApi {
  next(): void;
  prev(): void;
  today(): void;
  gotoDate(date: DateInput): void;
  changeView(viewName: string, date?: DateInput): void;
  getDate(): Date;
  readonly view: ViewApi;
  getEvents(): EventApi[];
  getEventById(id: string): EventApi | null;
  refetchEvents(): void;
  /** Kept for compatibility; the selection clears itself, so it is a no-op. */
  unselect(): void;
  /** Kept for compatibility; programmatic selection is not supported (no-op). */
  select(start?: DateInput, end?: DateInput): void;
  /** Kept for compatibility; layout is responsive so it is a no-op. */
  updateSize(): void;
  /** Kept for compatibility; nothing to tear down. */
  destroy(): void;
}

export interface FullCalendarProps {
  /** Accepted and ignored: every feature is built in. */
  plugins?: unknown[];
  initialView?: string;
  initialDate?: DateInput;
  headerToolbar?: ToolbarInput | false;
  footerToolbar?: ToolbarInput | false;
  locale?: string;
  /** Accepted and ignored: built-in catalogs cover en, pt, pt-BR, es, fr, ar. */
  locales?: unknown[];
  timeZone?: string;
  firstDay?: number;
  weekends?: boolean;
  hiddenDays?: number[];
  validRange?: { start?: DateInput; end?: DateInput };
  businessHours?: boolean | BusinessHoursInput | BusinessHoursInput[];
  slotDuration?: DurationInput;
  slotLabelInterval?: DurationInput;
  slotMinTime?: DurationInput;
  slotMaxTime?: DurationInput;
  slotLabelFormat?: FormatterInput;
  eventTimeFormat?: FormatterInput;
  allDaySlot?: boolean;
  nowIndicator?: boolean;
  weekNumbers?: boolean;
  weekNumberCalculation?: "local" | "ISO";
  dayMaxEvents?: boolean | number;
  fixedWeekCount?: boolean;
  height?: number | string;
  contentHeight?: number | string;
  editable?: boolean;
  eventStartEditable?: boolean;
  eventDurationEditable?: boolean;
  selectable?: boolean;
  selectMirror?: boolean;
  /** "light" | "dark" — agendfy theme (not in FullCalendar). */
  themeSystem?: string;

  events?: EventSourceInput;
  eventSources?: EventSourceInput[];

  eventClick?: (arg: EventClickArg) => void;
  dateClick?: (arg: DateClickArg) => void;
  select?: (arg: DateSelectArg) => void;
  eventDrop?: (arg: EventDropArg) => void;
  eventResize?: (arg: EventResizeDoneArg) => void;
  datesSet?: (arg: DatesSetArg) => void;
  eventContent?: (arg: EventContentArg) => CustomContent;
  loading?: (isLoading: boolean) => void;

  /**
   * Escape hatch (not FullCalendar): native react-agendfy plugins — custom
   * views, export, themes, data sources.
   */
  agendfyPlugins?: import("@react-agendfy/core").CalendarPlugin[];
}

/**
 * FullCalendar options that are ACCEPTED AND IGNORED, so existing code keeps
 * compiling after the import swap (see MIGRATING.md for alternatives).
 * Kept as an explicit list: an index signature would erase the types of
 * every supported option through React's forwardRef.
 */
export interface IgnoredFullCalendarOptions {
  aspectRatio?: unknown;
  buttonText?: unknown;
  customButtons?: unknown;
  dayCellClassNames?: unknown;
  dayCellContent?: unknown;
  dayCellDidMount?: unknown;
  dayHeaderFormat?: unknown;
  dayMaxEventRows?: unknown;
  displayEventEnd?: unknown;
  displayEventTime?: unknown;
  droppable?: unknown;
  drop?: unknown;
  eventAdd?: unknown;
  eventAllow?: unknown;
  eventChange?: unknown;
  eventClassNames?: unknown;
  eventDidMount?: unknown;
  eventDisplay?: unknown;
  eventMouseEnter?: unknown;
  eventMouseLeave?: unknown;
  eventOrder?: unknown;
  eventOverlap?: unknown;
  eventReceive?: unknown;
  eventRemove?: unknown;
  eventWillUnmount?: unknown;
  expandRows?: unknown;
  handleWindowResize?: unknown;
  lazyFetching?: unknown;
  moreLinkClick?: unknown;
  navLinkDayClick?: unknown;
  navLinkWeekClick?: unknown;
  navLinks?: unknown;
  progressiveEventRendering?: unknown;
  scrollTime?: unknown;
  selectAllow?: unknown;
  selectOverlap?: unknown;
  stickyHeaderDates?: unknown;
  titleFormat?: unknown;
  unselect?: unknown;
  viewDidMount?: unknown;
  views?: unknown;
  weekNumberFormat?: unknown;
}

export type FullCalendarComponentProps = FullCalendarProps & IgnoredFullCalendarOptions;
