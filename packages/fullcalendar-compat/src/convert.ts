import type { Config, EventProps, RecurrenceInput } from "@react-agendfy/core";
import type {
  BusinessHoursInput,
  DateInput,
  DurationInput,
  EventInput,
  FormatterInput,
  FullCalendarProps,
  ToolbarInput,
} from "./types";

/* ---------------------------------------------------------------------------
 * Views
 * ------------------------------------------------------------------------- */

type AgendfyView = { view: string; listRange?: "day" | "week" | "month" };

const VIEW_MAP: Record<string, AgendfyView> = {
  dayGridMonth: { view: "month" },
  timeGridWeek: { view: "week" },
  dayGridWeek: { view: "week" },
  timeGridDay: { view: "day" },
  dayGridDay: { view: "day" },
  listDay: { view: "list", listRange: "day" },
  listWeek: { view: "list", listRange: "week" },
  listMonth: { view: "list", listRange: "month" },
  listYear: { view: "list", listRange: "month" },
};

/** FullCalendar view name → agendfy view (+ list span). Unknown names pass through. */
export const toAgendfyView = (fcView?: string): AgendfyView =>
  (fcView && VIEW_MAP[fcView]) || { view: fcView || "month" };

/** agendfy view → FullCalendar name (lists use the configured span). */
export const toFcView = (view: string, listRange: "day" | "week" | "month" = "week"): string => {
  switch (view) {
    case "month":
      return "dayGridMonth";
    case "week":
      return "timeGridWeek";
    case "day":
      return "timeGridDay";
    case "list":
      return listRange === "day" ? "listDay" : listRange === "month" ? "listMonth" : "listWeek";
    default:
      return view;
  }
};

const TOOLBAR_BUILTINS = new Set(["prev", "next", "today", "title", "prevYear", "nextYear", ""]);

/** View names listed in headerToolbar, in order (FullCalendar → agendfy). */
export const headerViewsFrom = (toolbar?: ToolbarInput | false): string[] | undefined => {
  if (!toolbar) return undefined;
  const names = [toolbar.left, toolbar.start, toolbar.center, toolbar.right, toolbar.end]
    .filter(Boolean)
    .join(",")
    .split(/[\s,]+/)
    .filter((n) => !TOOLBAR_BUILTINS.has(n));
  const views = [...new Set(names.map((n) => toAgendfyView(n).view))];
  return views.length ? views : undefined;
};

/* ---------------------------------------------------------------------------
 * Durations, formats, locale, time zone
 * ------------------------------------------------------------------------- */

/** FullCalendar duration → minutes (null when unparseable). */
export const durationToMinutes = (input?: DurationInput): number | null => {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input === "number") return input / 60000;
  if (typeof input === "string") {
    const m = /^(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input.trim());
    if (!m) return null;
    return (+(m[1] ?? 0)) * 1440 + +m[2] * 60 + +m[3] + +(m[4] ?? 0) / 60;
  }
  const { days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0 } = input;
  return days * 1440 + hours * 60 + minutes + seconds / 60 + milliseconds / 60000;
};

/** slotMinTime/slotMaxTime → "HH:mm". */
export const durationToClock = (input?: DurationInput): string | undefined => {
  const minutes = durationToMinutes(input);
  if (minutes === null) return undefined;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * FullCalendar formatter object → date-fns pattern. A string is taken as a
 * date-fns pattern already.
 */
export const formatterToPattern = (input?: FormatterInput): string | undefined => {
  if (!input) return undefined;
  if (typeof input === "string") return input;
  const twelve = input.hour12 === true || (input.hour12 !== false && !!input.meridiem);
  const hour = twelve ? (input.hour === "2-digit" ? "hh" : "h") : input.hour === "numeric" ? "H" : "HH";
  const minute = input.minute === undefined ? "" : ":mm";
  const second = input.second === undefined ? "" : ":ss";
  const meridiem = twelve ? (input.meridiem === "lowercase" || input.meridiem === "narrow" ? " aaa" : " a") : "";
  return `${hour}${minute}${second}${meridiem}`;
};

/** FullCalendar locale code → agendfy lang ("pt-br" → "pt-BR"). */
export const toLang = (locale?: string): string | undefined => {
  if (!locale) return undefined;
  const [base, region] = locale.split(/[-_]/);
  return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
};

/** "local" (FullCalendar's default) → the browser's IANA zone. */
export const toTimeZone = (timeZone?: string): string =>
  !timeZone || timeZone === "local"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : timeZone;

const toBusinessHours = (input: FullCalendarProps["businessHours"]): Config["businessHours"] => {
  if (!input) return { enabled: false, intervals: [] };
  if (input === true) {
    return { enabled: true, intervals: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" }] };
  }
  const list: BusinessHoursInput[] = Array.isArray(input) ? input : [input];
  return {
    enabled: true,
    intervals: list.map((b) => ({
      daysOfWeek: b.daysOfWeek ?? [1, 2, 3, 4, 5],
      startTime: durationToClock(b.startTime) ?? "09:00",
      endTime: durationToClock(b.endTime) ?? "17:00",
    })),
  };
};

const toDateValue = (value?: DateInput): string | Date | undefined =>
  value === undefined ? undefined : typeof value === "number" ? new Date(value) : value;

/** FullCalendar options → agendfy config. Only keys that were given are set. */
export const toAgendfyConfig = (props: FullCalendarProps, view: AgendfyView): Partial<Config> => {
  const config: Partial<Config> = {
    timeZone: toTimeZone(props.timeZone),
    defaultView: view.view as Config["defaultView"],
    // FullCalendar never shows browser notifications.
    alerts: { enabled: false, thresholdMinutes: 0 },
    export: false,
    // FullCalendar's businessHours default is off.
    businessHours: toBusinessHours(props.businessHours),
  };
  const set = <K extends keyof Config>(key: K, value: Config[K] | undefined) => {
    if (value !== undefined) config[key] = value;
  };

  set("lang", toLang(props.locale));
  set("listRange", view.listRange ?? "week");
  if (props.firstDay !== undefined) set("weekStartsOn", (((props.firstDay % 7) + 7) % 7) as Config["weekStartsOn"]);
  set("weekends", props.weekends);
  set("hiddenDays", props.hiddenDays);
  if (props.validRange) {
    set("validRange", {
      ...(props.validRange.start !== undefined && { start: toDateValue(props.validRange.start) }),
      ...(props.validRange.end !== undefined && { end: toDateValue(props.validRange.end) }),
    });
  }
  const slot = durationToMinutes(props.slotDuration);
  if (slot) set("slotDuration", slot);
  const label = durationToMinutes(props.slotLabelInterval);
  if (label) set("slotLabelInterval", label);
  set("slotMin", durationToClock(props.slotMinTime));
  set("slotMax", durationToClock(props.slotMaxTime));
  set("eventTimeFormat", formatterToPattern(props.eventTimeFormat));
  set("slotLabelFormat", formatterToPattern(props.slotLabelFormat));
  set("allDaySlot", props.allDaySlot);
  set("nowIndicator", props.nowIndicator ?? false); // FullCalendar default: off
  set("weekNumbers", props.weekNumbers);
  set("weekNumberCalculation", props.weekNumberCalculation);
  // FullCalendar default: no limit (dayMaxEvents false).
  set("dayMaxEvents", props.dayMaxEvents ?? false);
  // FullCalendar default: 6 rows.
  set("fixedWeekCount", props.fixedWeekCount ?? true);
  // FullCalendar defaults: not editable, not selectable.
  set("editable", props.editable ?? false);
  set("eventStartEditable", props.eventStartEditable);
  set("eventDurationEditable", props.eventDurationEditable);
  set("selectable", props.selectable ?? false);
  set("headerViews", headerViewsFrom(props.headerToolbar));
  if (props.headerToolbar === false) set("showHeader", false);
  return config;
};

/* ---------------------------------------------------------------------------
 * Events
 * ------------------------------------------------------------------------- */

const STANDARD_KEYS = new Set([
  "id", "groupId", "title", "start", "end", "allDay", "duration", "rrule", "exdate",
  "color", "backgroundColor", "borderColor", "textColor", "url", "display", "editable",
  "extendedProps", "startTime", "endTime", "daysOfWeek", "startRecur", "endRecur",
]);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 3600000;

const toInstant = (value?: DateInput): Date | null => {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : typeof value === "number" ? new Date(value) : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

const toIso = (date: Date) => new Date(date.getTime()).toISOString();

let autoId = 0;

/**
 * FullCalendar EventInput → agendfy event. Non-standard keys go to
 * `extendedProps` (as in FullCalendar) and are also kept on the event so
 * agendfy features (resourceId, …) still see them.
 */
export const toAgendfyEvent = (input: EventInput, sourceColor?: string): EventProps | null => {
  const rrule = input.rrule as RecurrenceInput | undefined;
  const ruleStart =
    rrule && typeof rrule === "object" ? toInstant((rrule as { dtstart?: DateInput }).dtstart) : null;
  const start = ruleStart ?? toInstant(input.start);
  if (!start) return null;

  const allDay = input.allDay ?? (typeof input.start === "string" && DATE_ONLY.test(input.start));
  const explicitEnd = toInstant(input.end);
  const duration = durationToMinutes(input.duration);
  const end =
    duration !== null
      ? new Date(start.getTime() + duration * 60000)
      : explicitEnd && !ruleStart
        ? explicitEnd
        : new Date(start.getTime() + (allDay ? 24 * HOUR : HOUR));

  const extendedProps: Record<string, unknown> = { ...(input.extendedProps ?? {}) };
  for (const [key, value] of Object.entries(input)) {
    if (!STANDARD_KEYS.has(key)) extendedProps[key] = value;
  }

  const event: EventProps = {
    ...extendedProps,
    id: input.id !== undefined ? String(input.id) : `fc-${++autoId}`,
    title: input.title ?? "",
    start: toIso(start),
    end: toIso(end),
    allDay,
    color: input.backgroundColor ?? input.color ?? sourceColor,
    extendedProps,
    fc: {
      groupId: input.groupId ?? "",
      url: input.url ?? "",
      display: input.display ?? "auto",
      borderColor: input.borderColor ?? input.color ?? "",
      textColor: input.textColor ?? "",
      editable: input.editable,
    },
  };
  if (rrule) {
    if (typeof rrule === "object") {
      const { dtstart: _dtstart, ...rest } = rrule as unknown as Record<string, unknown>;
      event.recurrence = rest as unknown as RecurrenceInput;
    } else {
      event.recurrence = rrule;
    }
    if (input.exdate !== undefined) {
      const list = Array.isArray(input.exdate) ? input.exdate : [input.exdate];
      event.exdate = list.map((d) => (typeof d === "number" ? new Date(d) : d));
    }
  }
  return event;
};

export const toAgendfyEvents = (inputs: EventInput[] = [], sourceColor?: string): EventProps[] =>
  inputs.map((e) => toAgendfyEvent(e, sourceColor)).filter((e): e is EventProps => e !== null);
