import { ReactNode, useCallback, useContext, useMemo } from "react";
import { CalendarContext } from "../context/CalendarContext";
import { useEventContentRenderer, formatEventTimeText } from "../context/EventContentContext";
import { useEventClassNamesResolver } from "../context/ClassNamesContext";
import type { ChangeVerdict, Config, EventChange, EventProps, Resource, Weekday } from "../types/types";
import { formatEventTime, formatIn } from "../Utils/displayOptions";
import { getBusinessHoursIntervalsForDate } from "../Utils/businessHours";
import { getDayRules } from "../Utils/calendarRange";
import { TZDate } from "@date-fns/tz";

/*
 * The stable surface for views and plugins (RFC 001, layer 2). The calendar
 * context stays private; custom views read and act through this hook.
 */

/** Fields a move or resize may change. Dates may be Date objects or ISO strings. */
export type SchedulePatch = Partial<Pick<EventProps, "start" | "end" | "allDay" | "resourceId" | "resourceIds">>;

export interface CalendarViewApi {
  /** Active view name. */
  view: string;
  /** The navigated date. */
  date: Date;
  /** Visible range of the active view, [start, end). */
  range: { start: Date; end: Date };
  /** Events to render: filtered, recurrences expanded over the visible window. */
  events: EventProps[];
  resources: Resource[];
  /** Resolved config (defaults, language catalog and your keys). */
  config: Config;
  timeZone: string;
  lang: string;
  direction: "ltr" | "rtl";
  weekStartsOn: Weekday;

  /** Text for `key` (config, then the view plugins' `messages`), `{var}` filled from `vars`. */
  t: (key: string, vars?: Record<string, string | number>, fallback?: string) => string;
  /** date-fns `pattern` in the calendar time zone and language. */
  formatDate: (date: Date | string, pattern: string) => string;
  /** A time with `eventTimeFormat`. */
  formatTime: (date: Date | string) => string;
  /** Outside `validRange`: no drops, clicks or selection. */
  isDisabled: (date: Date) => boolean;
  /** Weekday hidden by `hiddenDays` / `weekends: false`. */
  isHidden: (date: Date) => boolean;
  /**
   * Business-hours intervals of the day containing `date`: the resource's
   * own `businessHours` when given and set, else the calendar's (empty when off).
   */
  businessHoursFor: (date: Date, resource?: Resource) => { start: Date; end: Date }[];

  navigate: (direction: "prev" | "next" | "today") => void;
  gotoDate: (date: Date | string) => void;
  changeView: (view: string) => void;

  /** Moves `event`: validated, applied, sent to `onEventUpdate`, undoable. */
  moveEvent: (event: EventProps, patch: SchedulePatch) => ChangeVerdict;
  /** Resizes `event` (same pipeline, `onEventResize`). */
  resizeEvent: (event: EventProps, patch: SchedulePatch) => ChangeVerdict;
  /** Checks a change against the rules without applying it. */
  validate: (change: Omit<EventChange, "source">) => ChangeVerdict;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** The host's `onEventClick`. */
  onEventClick: (event: EventProps) => void;
  /** The host's `onSlotClick` (with the resource in resource views). */
  onSlotClick: (date: Date, info?: { resourceId?: string | number }) => void;
  /** Custom body from `eventContent` / an event-rendering plugin, or null for your default. */
  renderEventContent: (event: EventProps, options?: { isStart?: boolean; isEnd?: boolean }) => ReactNode | null;
  /** Classes from the `eventClassNames` prop for `event` in this view. */
  eventClassName: (event: EventProps) => string;
  /** "10:00 - 11:00" with `eventTimeFormat`. */
  timeText: (event: EventProps) => string;
}

const iso = (value: Date | string | undefined) => (value instanceof Date ? value.toISOString() : value);

const applyPatch = (event: EventProps, patch: SchedulePatch): EventProps => {
  const next: EventProps = { ...event };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = key === "start" || key === "end" ? iso(value as Date | string) : value;
  }
  return next;
};

/** Everything a view needs from its calendar. Must be rendered inside <Calendar>. */
export function useCalendarView(): CalendarViewApi {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendarView must be used inside <Calendar> (a view or plugin component).");
  const renderer = useEventContentRenderer();
  const classNamesFor = useEventClassNamesResolver();

  const {
    state,
    localeConfig: config,
    direction,
    resources,
    visibleEvents,
    visibleRange,
    t,
    navigate,
    gotoDate,
    handleViewChange,
    commitChange,
    previewChange,
    undo,
    redo,
    canUndo,
    canRedo,
    onEventClick,
    onSlotClick,
  } = ctx;
  const view = state.currentView;
  const timeZone = config.timeZone;
  const rules = useMemo(() => getDayRules(config), [config]);

  const change = useCallback(
    (kind: "move" | "resize", event: EventProps, patch: SchedulePatch) =>
      commitChange({ kind, event: applyPatch(event, patch), before: event, source: "user" }),
    [commitChange]
  );

  return {
    view,
    date: state.currentDate,
    range: visibleRange,
    events: visibleEvents,
    resources,
    config,
    timeZone,
    lang: config.lang,
    direction,
    weekStartsOn: rules.weekStartsOn,

    t,
    formatDate: (date, pattern) => formatIn(date, pattern, config),
    formatTime: (date) => formatEventTime(date, config),
    isDisabled: rules.isDisabled,
    isHidden: rules.isHidden,
    businessHoursFor: (date, resource) =>
      resource?.businessHours
        ? getBusinessHoursIntervalsForDate(new TZDate(date, timeZone), { enabled: true, intervals: resource.businessHours })
        : config.businessHours?.enabled
          ? getBusinessHoursIntervalsForDate(new TZDate(date, timeZone), config.businessHours)
          : [],

    navigate,
    gotoDate,
    changeView: handleViewChange,

    moveEvent: (event, patch) => change("move", event, patch),
    resizeEvent: (event, patch) => change("resize", event, patch),
    validate: (c) => previewChange({ ...c, source: "user" }),
    undo,
    redo,
    canUndo,
    canRedo,

    onEventClick: (event) => onEventClick?.(event),
    onSlotClick: (date, info) => onSlotClick?.(date, info),
    renderEventContent: (event, options = {}) => {
      if (!renderer) return null;
      const content = renderer({
        event,
        view,
        timeText: formatEventTimeText(event, config),
        isStart: options.isStart ?? true,
        isEnd: options.isEnd ?? true,
      });
      return content === undefined || content === null || content === false ? null : content;
    },
    eventClassName: (event) => classNamesFor(event, view),
    timeText: (event) => formatEventTimeText(event, config),
  };
}

export default useCalendarView;
