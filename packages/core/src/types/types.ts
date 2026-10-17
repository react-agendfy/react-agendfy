import type React from "react";
import { TZDate } from "@date-fns/tz";
import { CalendarPlugin } from "./plugins";
import type { EmailAdapter, NotificationServiceConfig } from "./notification";

/** All view identifiers the calendar can render. */
export type CalendarView = "month" | "week" | "day" | "list" | "agenda";

/** Text direction accepted by the calendar root. "auto" derives from the language. */
export type CalendarDirection = "ltr" | "rtl" | "auto";

/**
 * Narrow escape hatch for locale dictionaries: translation bundles may carry
 * additional string entries keyed dynamically. Values are always strings.
 *
 * Known user-facing message keys are enumerated below (all optional — the
 * built-in catalog in `src/i18n/` supplies defaults per `config.lang`, and
 * explicit config keys always override the catalog).
 */
export interface LocaleStrings {
  [key: string]: string | undefined;
  today?: string;
  monthView?: string;
  weekView?: string;
  dayView?: string;
  listView?: string;
  agenda?: string;
  all_day?: string;
  clear_filter?: string;
  filter_resources?: string;
  calendar_export?: string;
  loading?: string;
  export_error?: string;
  back?: string;
  next?: string;
  go_to_today?: string;
  /** Shown when the requested view has no registered component. */
  unsupported_view?: string;
  /** Empty state for the list view. */
  no_events?: string;
  /** Empty state for the agenda view. Template vars: {days}. */
  agenda_no_events?: string;
  /** Fallback label for events without a title. */
  untitled_event?: string;
  /** Tooltip label for a multi-day event's start time. */
  tooltip_start?: string;
  /** Tooltip label for a multi-day event's end time. */
  tooltip_end?: string;
  /** Week view error for invalid slot configuration. Template vars: {duration}. */
  invalid_slot_duration?: string;
  /** Month-view overflow badge label. Template vars: {count}. */
  hidden_events?: string;
  /** Prefix of week numbers (e.g. "W" → "W42", "S" → "S42"). */
  week_number_label?: string;
  /** Month-view "+N more" link. Template vars: {count}. */
  more_events?: string;
  /** Close button label (day popover). */
  close?: string;
  /** Browser notification title for an upcoming event. */
  notification_title?: string;
  /** Toast title for event reminders. */
  alert_title?: string;
  /** Reminder body. Template vars: {title}, {time}. */
  event_starts_at?: string;
  /** Reminder email subject. Template vars: {title}. */
  email_alert_subject?: string;
  /** Reminder email body. Template vars: {title}, {time}. */
  email_alert_body?: string;
  /** Announced when a data-source plugin fails. Template vars: {source}, {message}. */
  data_source_error?: string;
}

/** Weekday index: 0 = Sunday … 6 = Saturday (JavaScript `Date.getDay()`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Navigable/interactive date window. Both bounds are optional; `end` is
 * EXCLUSIVE (FullCalendar semantics). "YYYY-MM-DD" strings are read as days
 * in the calendar time zone.
 */
export interface ValidRange {
  start?: string | Date;
  end?: string | Date;
}

/**
 * FullCalendar-style recurrence object (rrule.js option names). Weekday
 * strings are "mo".."su"; numeric weekdays follow rrule.js (0 = Monday).
 */
export interface RecurrenceObject {
  freq: "yearly" | "monthly" | "weekly" | "daily" | "hourly" | "minutely" | "secondly" | number;
  interval?: number;
  count?: number;
  until?: string | Date;
  dtstart?: string | Date;
  byweekday?: string | number | (string | number)[];
  bymonthday?: number | number[];
  bymonth?: number | number[];
  bysetpos?: number | number[];
  wkst?: string | number;
}

/** An RRULE string (optionally multi-line with DTSTART/EXDATE) or an object. */
export type RecurrenceInput = string | RecurrenceObject;

export interface Config {
  timeZone: string;
  /**
   * First day of the week (0 = Sunday). Defaults to the locale's convention
   * for `lang` (Monday for pt/es/fr…, Sunday for en-US).
   */
  weekStartsOn?: Weekday;
  /** Weekdays never rendered in week/month/list/agenda views (0 = Sunday). */
  hiddenDays?: number[];
  /** `false` hides Saturday and Sunday (merged with `hiddenDays`). Default true. */
  weekends?: boolean;
  /** Days outside this range are disabled and navigation is clamped to it. */
  validRange?: ValidRange;
  /**
   * date-fns pattern for event times (e.g. "HH:mm", "h:mm a"). Default
   * "HH:mm". Used by every view and by `EventContentArg.timeText`.
   */
  eventTimeFormat?: string;
  /** Minutes between time labels in week/day grids. Default: slotDuration. */
  slotLabelInterval?: number;
  /** Show week numbers (month rows, week view corner). Default false. */
  weekNumbers?: boolean;
  /** "local" follows weekStartsOn; "ISO" is ISO-8601 (Monday, week 1 has Jan 4). Default "local". */
  weekNumberCalculation?: "local" | "ISO";
  /**
   * Max events per month cell before the "+N" link (which opens a popover
   * with the day's events). `true` = 3, `false` = no limit. Default 3.
   */
  dayMaxEvents?: number | boolean;
  /** Month view always renders 6 rows. Default false (only the weeks of the month). */
  fixedWeekCount?: boolean;
  /** Span of the list view. Default "month". */
  listRange?: "day" | "week" | "month";
  /** Show the all-day row in the week view. Default true. */
  allDaySlot?: boolean;
  /** Show the current-time line. Default true. */
  nowIndicator?: boolean;
  defaultView: CalendarView;
  slotDuration: number;
  slotLabelFormat: string;
  slotMin: string;
  slotMax: string;
  lang: string;
  today: string;
  monthView: string;
  weekView: string;
  dayView: string;
  listView: string;
  agenda: string;
  all_day: string;
  filter_resources: string;
  clear_filter?: string;
  businessHours: {
    enabled: boolean;
    intervals: {
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
    }[];
  };
  alerts?: {
    enabled: boolean;
    thresholdMinutes: number;
  };
  emailAdapter?: EmailAdapter | null;
  emailConfig?: NotificationServiceConfig["emailConfig"];
  export?: boolean;
  calendar_export: string;
  /** Announced while data-source plugins are fetching events. */
  loading?: string;
  /** Message prefix used when an export fails or has no matching plugin. */
  export_error?: string;
  /** Accessible label for the "previous" navigation button. */
  back?: string;
  /** Accessible label for the "next" navigation button. */
  next?: string;
  /** Accessible label for the "today" navigation button. */
  go_to_today?: string;
  /** Shown when the requested view has no registered component. */
  unsupported_view?: string;
  /** Empty state for the list view. */
  no_events?: string;
  /** Empty state for the agenda view. Template vars: {days}. */
  agenda_no_events?: string;
  /** Fallback label for events without a title. */
  untitled_event?: string;
  /** Tooltip label for a multi-day event's start time. */
  tooltip_start?: string;
  /** Tooltip label for a multi-day event's end time. */
  tooltip_end?: string;
  /** Week view error for invalid slot configuration. Template vars: {duration}. */
  invalid_slot_duration?: string;
  /** Month-view overflow badge label. Template vars: {count}. */
  hidden_events?: string;
  /** Prefix of week numbers (e.g. "W" → "W42", "S" → "S42"). */
  week_number_label?: string;
  /** Month-view "+N more" link. Template vars: {count}. */
  more_events?: string;
  /** Close button label (day popover). */
  close?: string;
  /** Browser notification title for an upcoming event. */
  notification_title?: string;
  /** Toast title for event reminders. */
  alert_title?: string;
  /** Reminder body. Template vars: {title}, {time}. */
  event_starts_at?: string;
  /** Reminder email subject. Template vars: {title}. */
  email_alert_subject?: string;
  /** Reminder email body. Template vars: {title}, {time}. */
  email_alert_body?: string;
  /** Announced when a data-source plugin fails. Template vars: {source}, {message}. */
  data_source_error?: string;
}

/** Alias kept for helpers that reference the config under an older name. */
export type CalendarConfig = Config;

/** Locale-only subset used by locale helpers. */
export interface LocaleConfig {
  today: string;
  monthView: string;
  weekView: string;
  dayView: string;
}
export interface WeekProps  {
  events:EventProps[],
  onEventUpdate?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onDayClick?: (day: Date) => void;
  onSlotClick?: (slotTime: Date) => void;
  onEventResize?: (event: EventProps) => void;
  onDateRangeSelect?: (selection: EventProps | DateRangeSelection) => void;
  currentDate: TZDate,
  slotMin: string,
  slotMax: string,
  config: Config,
  interactionPlugin?: CalendarPlugin[];
  eventRenderingPlugins?: CalendarPlugin[];
}

export interface CalendarDayProps {
  day: TZDate | Date | null;
  events?: EventProps[];
  onDayClick?: (day: Date) => void;
  onEventClick?: (event: EventProps) => void;
  /** Resize lifecycle callback: "start" marks resize begin, "stop" delivers the resized event. */
  onEventResize?: (status: "start" | "stop", event?: EventProps) => void;
  onMouseDown?: (day: Date) => void;
  onMouseMove?: (day: Date) => void;
  isSelected?: boolean;
  monthDate?: TZDate | Date;
  isDroppable?: boolean;
  isDropTarget?: boolean;
  /** Rendered days of this cell's week row (hidden weekdays excluded). */
  rowDays?: Date[];
  /** Day outside validRange: no click, selection or drop. */
  isDisabled?: boolean;
  /** Week number shown in the row's first cell (`weekNumbers`). */
  weekNumber?: number;
  config: Config;
  /** Roving-tabindex navigation props supplied by useGridNavigation. */
  navProps?: import("../hooks/useGridNavigation").GridCellNavProps;
}
export interface BaseEventProps {
  event: EventProps;
  onEventClick?: (event: EventProps) => void;
  onEventUpdate?: (event: EventProps) => void;
  onEventResize?: (event: EventProps) => void;
  positionStyle?: PositionStyle;
  isPreview?: boolean;
  isMultiDay?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  config?: Config;
  dayDate?: any;
  isDraggable?: boolean;
  customClassName?: string;
  parsedSlotMax?: number;
}

export interface PositionStyle {
  top?: string | number;
  height?: string | number;
  [key: string]: any;
}

export type TimeSlotData = {
  [key: string]: number[];
};

export interface EventPositionStyle {
  left: string;
  width: string;
  top: string;
  marginLeft: string;
}

export interface MonthViewProps {
  events?: EventProps[];
  resources?: Resource[];
  currentDate?: TZDate;
  onEventUpdate?: (updatedEvent: EventProps) => void;
  onEventResize?: (updatedEvent: EventProps) => void;
  onDateRangeSelect?: (range: EventProps | DateRangeSelection) => void;
  onDayClick?: (day: Date) => void;
  onEventClick?: (event: EventProps) => void;
  config: Config;
  showResourceView?: boolean;
}

export interface EventProps {
  id: string;
  title: string;
  start: Date | string;
  end: Date | string;
  allDay?: boolean;
  color?: string;
  resourceId?: string | number;
  resourceIds?: (string | number)[];
  /** Recurrence rule; `start`/`end` give the first occurrence and its duration. */
  recurrence?: RecurrenceInput;
  /** FullCalendar alias of `recurrence`. */
  rrule?: RecurrenceInput;
  /** Excluded occurrences: "YYYY-MM-DD" (whole day) or date-times. */
  exdate?: string | Date | (string | Date)[];
  [key: string]: any;
}

/** Views that render events (built-in names, or a custom view's name). */
export type EventContentView = CalendarView | (string & {});

/** Argument for `eventContent` and event-rendering plugin components. */
export interface EventContentArg {
  event: EventProps;
  view: EventContentView;
  /** Pre-formatted "HH:mm - HH:mm" for the event. */
  timeText: string;
  /** For multi-day pieces: whether this piece holds the event's start/end. */
  isStart: boolean;
  isEnd: boolean;
}

/**
 * Custom event body. Return `null`/`undefined` to keep the default content.
 * Only the INNER content is replaced — positioning, drag and resize stay.
 */
export type EventContentRenderer = (arg: EventContentArg) => React.ReactNode;

export interface Resource {
  id: string | number;
  title?: string;
  name?: string;
  type?: string;
  children?: Resource[];
  [key: string]: any;
}

/** Selection emitted when a user drags across a date range. */
export interface DateRangeSelection {
  start: string;
  end: string;
  isMultiDay: boolean;
}

export interface CalendarProps {
  events: EventProps[];
  resources?: Resource[];
  plugins?: CalendarPlugin[];
  /** Partial config; unspecified keys fall back to the built-in defaults. */
  config?: Partial<Config>;
  /**
   * Text direction of the calendar root. Defaults to "auto": derived from the
   * resolved language (ar/he/fa/ur → "rtl", anything else → "ltr").
   */
  direction?: CalendarDirection;
  theme?: string;
  filteredResources?: string[];
  emailAdapter?: EmailAdapter;
  emailConfig?: NotificationServiceConfig["emailConfig"];
  /** Date shown initially; later changes move the calendar to the new date. */
  currentDate?: Date;
  /**
   * Called after a drag. Return a Promise that rejects to revert the move
   * (like FullCalendar's `info.revert()`); a void return keeps it.
   */
  onEventUpdate?: (event: EventProps) => void | Promise<unknown>;
  /** Called after a resize. A rejected Promise reverts it. */
  onEventResize?: (event: EventProps) => void | Promise<unknown>;
  onEventClick?: (event: EventProps) => void;
  onDayClick?: (day: Date) => void;
  onSlotClick?: (slotTime: Date) => void;
  onDateRangeSelect?: (selection: EventProps | DateRangeSelection) => void;
  /** Called with the displayed date on mount and after every navigation. */
  onDateChange?: (date: Date) => void;
  /** Custom event body for every view (takes precedence over plugins). */
  eventContent?: EventContentRenderer;
}

export interface TimeSlotProps {
  index: number;
  slotEvents: EventProps[];
  onEventUpdate?: (event: EventProps) => void;
  onSlotClick?: (event: Date) => void;
  onEventClick?: (event: EventProps) => void;
  onEventResize?: (event: EventProps) => void;
  parsedSlotMax: number;
  dayDate: any;
  slotMin: number;
  config?: Config;
  isDraggable?: boolean;
  /** Slot falls inside a business-hours interval (shaded like the week view). */
  isBusinessHour?: boolean;
  /** Day outside validRange: no click or drop. */
  isDisabled?: boolean;
  /** Column placement for the whole day (see computeDayLayout). */
  dayLayout?: Map<string, import("../Utils/positionedEventsHelper").DayLayoutSlot>;
}
export interface DayColumnProps {
  dayDate: any;
  events: EventProps[];
  /** Returns the events for a slot, keyed by the slot's ISO timestamp. */
  getEventsForDay: (slotKey: string) => EventProps[];
  timeSlots: number[];
  onEventUpdate?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onSlotClick?: (slotTime: Date) => void;
  onEventResize?: (event: EventProps) => void;
  /** Day outside validRange: rendered inert. */
  isDisabled?: boolean;
    onSelectionMouseDown?: (date: Date) => void;
    onSelectionMouseMove: (date: Date) => void;
    isSlotSelected: (date: Date) => boolean;
  parsedSlotMin: number;
  parsedSlotMax: number;
  redLineOffset: number;
  config?: Config;
  isDraggable: boolean;
}

export interface DayViewProps {
  events: EventProps[];
  currentDate: TZDate;
  config: Config;
  onEventUpdate?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onSlotClick?: (slotTime: Date) => void;
  onEventResize?: (event: EventProps) => void;
}

export interface ListViewProps {
  events: EventProps[];
  currentDate?: TZDate | Date;
  config?: Config;
  onEventClick?: (event: EventProps) => void;
  onEventUpdate?: (event: EventProps) => void;
}

export interface ListEventProps {
  event: EventProps;
  currentDate?: TZDate | Date;
  config?: Config;
  onEventClick?: (event: EventProps) => void;
}

export interface ExportOption {
  formatName: string;
  label: string;
}

export interface CalendarHeaderProps {
  currentView: string;
  availableViews: { name: string; label: string }[];
  onViewChange: (view: string) => void;
  currentDate: TZDate | Date;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  localeConfig: Config;
  onExport?: (format: string) => void;
  exportOptions?: ExportOption[];
  headerLeftPlugins?: React.ReactNode[];
  headerRightPlugins?: React.ReactNode[];
  /** Disables the prev/next buttons (e.g. outside `validRange`). */
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
}
