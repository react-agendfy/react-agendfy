import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Calendar, expandRecurrences } from "@react-agendfy/core";
import type {
  CalendarApi as AgendfyApi,
  CalendarPlugin,
  Config,
  DateRangeSelection,
  EventChange,
  DatesSetInfo,
  DayCellClassNamesArg as AgendfyDayCellArg,
  EventClassNamesArg as AgendfyEventClassArg,
  EventContentArg as AgendfyContentArg,
  EventProps,
} from "@react-agendfy/core";
import { createEventApi, formatIsoInZone } from "./eventApi";
import { toAgendfyConfig, toAgendfyEvents, toAgendfyView, toConstraint, toFcView } from "./convert";
import type {
  CalendarApi,
  ClassNamesGenerator,
  DateInput,
  DropInfo,
  EventInput,
  EventSourceFunc,
  EventSourceInput,
  FullCalendarComponentProps,
  FullCalendarProps,
  ViewApi,
} from "./types";

/*
 * <FullCalendar> with @fullcalendar/react's props, rendered by react-agendfy.
 *
 * Migration is meant to be an import swap: same option names, the same
 * callback `info` objects (EventApi with startStr/extendedProps/_def,
 * revert() on drops and resizes), and `ref.current.getApi()`.
 */

type Source =
  | { kind: "array"; events: EventInput[]; color?: string }
  | { kind: "func"; fetch: EventSourceFunc; color?: string }
  | { kind: "url"; url: string; color?: string };

const toSources = (events?: EventSourceInput, eventSources?: EventSourceInput[]): Source[] =>
  [...(events !== undefined ? [events] : []), ...(eventSources ?? [])].flatMap((input): Source[] => {
    if (Array.isArray(input)) return [{ kind: "array", events: input }];
    if (typeof input === "function") return [{ kind: "func", fetch: input }];
    if (typeof input === "string") return [{ kind: "url", url: input }];
    if (input && typeof input === "object" && "events" in input) {
      const inner = input.events;
      const color = input.color;
      if (Array.isArray(inner)) return [{ kind: "array", events: inner, color }];
      if (typeof inner === "function") return [{ kind: "func", fetch: inner, color }];
      if (typeof inner === "string") return [{ kind: "url", url: inner, color }];
    }
    return [];
  });

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));
const DAY = 86400000;

const deltaOf = (from: Date | null, to: Date | null) => {
  const diff = from && to ? to.getTime() - from.getTime() : 0;
  const days = Math.trunc(diff / DAY);
  return { years: 0, months: 0, days, milliseconds: diff - days * DAY };
};

/** Options whose changes rebuild the agendfy config (functions/events excluded). */
const OPTION_KEYS = [
  "initialView", "headerToolbar", "locale", "timeZone", "firstDay", "weekends", "hiddenDays",
  "validRange", "businessHours", "slotDuration", "slotLabelInterval", "slotMinTime", "slotMaxTime",
  "slotLabelFormat", "eventTimeFormat", "allDaySlot", "nowIndicator", "weekNumbers",
  "weekNumberCalculation", "dayMaxEvents", "fixedWeekCount", "editable", "eventStartEditable",
  "eventDurationEditable", "selectable", "eventOverlap", "eventConstraint", "selectOverlap",
] as const;

const spanOf = (event: EventProps) => ({
  start: new Date(event.start).getTime(),
  end: new Date(event.end).getTime(),
});

export interface FullCalendarHandle {
  getApi(): CalendarApi;
}

const FullCalendar = forwardRef<FullCalendarHandle, FullCalendarComponentProps>(function FullCalendar(props, ref) {
  const agendfyApi = useRef<AgendfyApi>(null);
  const initialView = useMemo(() => toAgendfyView(props.initialView), []); // eslint-disable-line react-hooks/exhaustive-deps
  // The list span is part of the FullCalendar view name (listWeek/listMonth),
  // so it can change with changeView().
  const [listRange, setListRange] = useState(initialView.listRange ?? "week");
  const [initialDate] = useState(() => (props.initialDate !== undefined ? toDate(props.initialDate) : undefined));

  // Callbacks are read through a ref so a new function identity on every
  // render does not rebuild the config; only their presence does.
  const propsRef = useRef(props);
  propsRef.current = props;
  const zoneRef = useRef("UTC");
  const optionsKey = JSON.stringify([
    ...OPTION_KEYS.map((k) => (props as FullCalendarProps)[k]),
    typeof props.eventOverlap,
    typeof props.selectOverlap,
    !!props.eventAllow,
    !!props.selectAllow,
  ]);
  const config = useMemo(() => {
    const base: Partial<Config> = { ...toAgendfyConfig(props, initialView), listRange };
    const zone = base.timeZone as string;
    const toApi = (event: EventProps) => createEventApi(event, zone);
    if (typeof props.eventOverlap === "function") {
      base.eventOverlap = (still, moving) =>
        (propsRef.current.eventOverlap as (s: unknown, m: unknown) => boolean)(toApi(still), toApi(moving));
    }
    if (props.eventAllow) {
      base.eventAllow = (change: EventChange) =>
        propsRef.current.eventAllow?.(dropInfoOf(change.event, zone), toApi(change.before ?? change.event)) !== false;
    }
    if (props.selectAllow || (props.selectOverlap !== undefined && props.selectOverlap !== true)) {
      base.selectAllow = (selection) => selectionAllowed(selection);
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, listRange]);
  const timeZone = config.timeZone as string;
  zoneRef.current = timeZone;

  /* --- rules: eventAllow / selectAllow / selectOverlap / group constraints --- */
  // Called by the config's wrappers during a drag or selection (never while
  // rendering); they read the latest view, events and props through refs.
  const dropInfoOf = (event: EventProps, zone: string): DropInfo => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const allDay = !!event.allDay;
    return {
      start,
      end,
      startStr: formatIsoInZone(start, zone, allDay),
      endStr: formatIsoInZone(end, zone, allDay),
      allDay,
    };
  };
  const selectInfoOf = (selection: DateRangeSelection): DropInfo => {
    const zone = zoneRef.current;
    const start = new Date(selection.start);
    let end = new Date(selection.end);
    // agendfy's month selection ends on the last day; FullCalendar's end is exclusive.
    const allDay = end.getTime() <= start.getTime() || viewRef.current.type === "dayGridMonth";
    if (allDay) end = new Date(end.getTime() + DAY);
    return {
      start,
      end,
      startStr: formatIsoInZone(start, zone, allDay),
      endStr: formatIsoInZone(end, zone, allDay),
      allDay,
    };
  };
  const selectionAllowed = (selection: DateRangeSelection): boolean => {
    if (!selection || !("isMultiDay" in selection)) return true;
    const info = selectInfoOf(selection);
    const { selectOverlap, selectAllow } = propsRef.current;
    if (selectOverlap !== undefined && selectOverlap !== true) {
      const from = info.start.getTime();
      const to = info.end.getTime();
      const hits = expandRecurrences(eventsRef.current(), info.start, info.end, zoneRef.current).filter((e) => {
        const span = spanOf(e);
        return span.start < to && from < span.end;
      });
      const blocked =
        selectOverlap === false
          ? hits.length > 0
          : hits.some((e) => selectOverlap(createEventApi(e, zoneRef.current)) === false);
      if (blocked) return false;
    }
    return selectAllow ? selectAllow(info) !== false : true;
  };

  /* --- view state (for ViewApi) ----------------------------------------- */
  const [range, setRange] = useState<DatesSetInfo | null>(null);
  const viewApi = useMemo<ViewApi>(() => {
    const type = toFcView(range?.view ?? initialView.view, listRange);
    const start = range?.start ?? new Date();
    const end = range?.end ?? new Date();
    const title = new Intl.DateTimeFormat(config.lang ?? "en", { month: "long", year: "numeric" }).format(
      range?.date ?? start
    );
    return { type, title, activeStart: start, activeEnd: end, currentStart: start, currentEnd: end };
  }, [range, listRange, initialView.view, config.lang]);
  const viewRef = useRef(viewApi);
  viewRef.current = viewApi;

  /* --- event sources ----------------------------------------------------- */
  const sources = useMemo(() => toSources(props.events, props.eventSources), [props.events, props.eventSources]);
  const [fetched, setFetched] = useState<Record<number, EventInput[]>>({});
  const [reload, setReload] = useState(0);
  const loadingRef = useRef(props.loading);
  loadingRef.current = props.loading;

  useEffect(() => {
    if (!range) return;
    const remote = sources.map((s, i) => [s, i] as const).filter(([s]) => s.kind !== "array");
    if (remote.length === 0) return;
    let cancelled = false;
    const info = {
      start: range.start,
      end: range.end,
      startStr: formatIsoInZone(range.start, timeZone),
      endStr: formatIsoInZone(range.end, timeZone),
      timeZone,
    };
    loadingRef.current?.(true);
    Promise.all(
      remote.map(async ([source, index]) => {
        let events: EventInput[] = [];
        try {
          if (source.kind === "func") {
            events = await new Promise<EventInput[]>((resolve, reject) => {
              const result = source.fetch(info, resolve, reject);
              if (result && typeof (result as Promise<EventInput[]>).then === "function") {
                (result as Promise<EventInput[]>).then(resolve, reject);
              }
            });
          } else if (source.kind === "url") {
            const url = new URL(source.url, typeof window !== "undefined" ? window.location.href : "http://localhost");
            url.searchParams.set("start", info.startStr);
            url.searchParams.set("end", info.endStr);
            url.searchParams.set("timeZone", timeZone);
            const response = await fetch(url.toString());
            events = response.ok ? await response.json() : [];
          }
        } catch (error) {
          console.error("Event source failed", error);
        }
        return [index, events] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      setFetched((prev) => {
        const next = { ...prev };
        results.forEach(([index, events]) => (next[index] = Array.isArray(events) ? events : []));
        return next;
      });
      loadingRef.current?.(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sources, range?.start.getTime(), range?.end.getTime(), timeZone, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo<EventProps[]>(
    () =>
      sources.flatMap((source, index) =>
        source.kind === "array"
          ? toAgendfyEvents(source.events, source.color)
          : toAgendfyEvents(fetched[index] ?? [], source.color)
      ),
    [sources, fetched]
  );
  // Moves/resizes that were not reverted, by id — FullCalendar keeps them in
  // its own store, so oldEvent, getEvents() and getEventById() must see
  // them even when the app does not update its events. New events from the
  // app replace them (it now owns the truth).
  const changesRef = useRef(new Map<string, EventProps>());
  const lastEventsRef = useRef(events);
  if (lastEventsRef.current !== events) {
    lastEventsRef.current = events;
    changesRef.current = new Map();
  }
  const currentEvents = () =>
    events.map((e) => changesRef.current.get(String(e.id)) ?? e);
  const eventsRef = useRef(currentEvents);
  eventsRef.current = currentEvents;

  /* --- callbacks ----------------------------------------------------------- */
  const api = useCallback((event: EventProps) => createEventApi(event, timeZone), [timeZone]);

  const handleDatesSet = useCallback(
    (info: DatesSetInfo) => {
      setRange(info);
      const view = { ...viewRef.current, type: toFcView(info.view, listRange), activeStart: info.start, activeEnd: info.end };
      props.datesSet?.({
        start: info.start,
        end: info.end,
        startStr: formatIsoInZone(info.start, timeZone),
        endStr: formatIsoInZone(info.end, timeZone),
        timeZone,
        view,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.datesSet, timeZone, listRange]
  );

  const findOriginal = (changed: EventProps) => {
    const id = String(changed.originalEventId ?? changed.id).replace(/::cont$/, "");
    return eventsRef.current().find((e) => String(e.id) === id || String(e.id) === String(changed.id));
  };

  // A drop/resize resolves through a Promise: calling info.revert() rejects
  // it, and agendfy puts the event back (its native revert).
  const changeHandler = (kind: "drop" | "resize") => (changed: EventProps) =>
    new Promise<void>((_resolve, reject) => {
      const before = findOriginal(changed) ?? changed;
      const oldEvent = api(before);
      const event = api(changed);
      const key = String(before.id);
      const previousChange = changesRef.current.get(key);
      changesRef.current.set(key, { ...before, start: changed.start, end: changed.end });
      const common = {
        event,
        oldEvent,
        revert: () => {
          if (previousChange) changesRef.current.set(key, previousChange);
          else changesRef.current.delete(key);
          reject(new Error("reverted"));
        },
        relatedEvents: [],
        el: null,
        jsEvent: null,
        view: viewRef.current,
      };
      if (kind === "drop") {
        props.eventDrop?.({ ...common, delta: deltaOf(oldEvent.start, event.start) });
      } else {
        props.eventResize?.({
          ...common,
          startDelta: deltaOf(oldEvent.start, event.start),
          endDelta: deltaOf(oldEvent.end, event.end),
        });
      }
    });

  const editable = props.editable ?? false; // FullCalendar default
  const canMove = props.eventStartEditable ?? editable;
  const canResize = props.eventDurationEditable ?? editable;

  const handleSelect = (selection: EventProps | DateRangeSelection) => {
    if (!("isMultiDay" in selection)) return;
    props.select?.({ ...selectInfoOf(selection as DateRangeSelection), jsEvent: null, view: viewRef.current });
  };

  const dateClick = (date: Date, allDay: boolean) =>
    props.dateClick?.({
      date,
      dateStr: formatIsoInZone(date, timeZone, allDay),
      allDay,
      dayEl: null,
      jsEvent: null,
      view: viewRef.current,
    });

  const eventContent = props.eventContent
    ? (arg: AgendfyContentArg) => {
        const result = props.eventContent!({
          event: api(arg.event),
          timeText: arg.timeText,
          isStart: arg.isStart,
          isEnd: arg.isEnd,
          view: viewRef.current,
        });
        if (result && typeof result === "object" && "html" in (result as object)) {
          return <span dangerouslySetInnerHTML={{ __html: (result as { html: string }).html }} />;
        }
        return result as React.ReactNode;
      }
    : undefined;

  /* --- eventClassNames / dayCellClassNames ------------------------------------ */
  // FullCalendar's ClassNamesGenerator: a string, a list, or a function.
  const resolveClassNames = <Arg,>(generator: ClassNamesGenerator<Arg> | undefined, arg: () => Arg) =>
    generator === undefined ? undefined : typeof generator === "function" ? generator(arg()) : generator;

  const eventClassNames = props.eventClassNames
    ? (arg: AgendfyEventClassArg) =>
        resolveClassNames(props.eventClassNames, () => {
          const now = Date.now();
          const event = api(arg.event);
          return {
            event,
            view: viewRef.current,
            isPast: (event.end ?? event.start ?? new Date(0)).getTime() <= now,
            isFuture: (event.start ?? new Date(0)).getTime() > now,
          };
        })
    : undefined;

  const dayCellClassNames = props.dayCellClassNames
    ? (arg: AgendfyDayCellArg) =>
        resolveClassNames(props.dayCellClassNames, () => {
          // Calendar days compared in the calendar's zone ("YYYY-MM-DD").
          const day = formatIsoInZone(arg.date, timeZone, true);
          const today = formatIsoInZone(new Date(), timeZone, true);
          return {
            date: arg.date,
            view: viewRef.current,
            isToday: arg.isToday,
            isPast: day < today,
            isFuture: day > today,
            isOther: Boolean(arg.isOtherMonth),
            isDisabled: arg.isDisabled,
          };
        })
    : undefined;

  /* --- getApi() ------------------------------------------------------------ */
  useImperativeHandle(
    ref,
    () => ({
      getApi: (): CalendarApi => ({
        next: () => agendfyApi.current?.next(),
        prev: () => agendfyApi.current?.prev(),
        today: () => agendfyApi.current?.today(),
        gotoDate: (date) => agendfyApi.current?.gotoDate(toDate(date)),
        changeView: (viewName, date) => {
          const target = toAgendfyView(viewName);
          if (target.listRange) setListRange(target.listRange);
          agendfyApi.current?.changeView(target.view, date !== undefined ? toDate(date) : undefined);
        },
        getDate: () => agendfyApi.current?.getDate() ?? new Date(),
        get view() {
          return viewRef.current;
        },
        getEvents: () => eventsRef.current().map(api),
        getEventById: (id) => {
          const found = eventsRef.current().find((e) => String(e.id) === String(id));
          return found ? api(found) : null;
        },
        refetchEvents: () => {
          setReload((n) => n + 1);
          agendfyApi.current?.refetchEvents();
        },
        unselect: () => {},
        select: () => {},
        updateSize: () => {},
        destroy: () => {},
      }),
    }),
    [api]
  );

  /* --- eventConstraint by groupId (not expressible in the core) ------------- */
  const globalGroup = toConstraint(props.eventConstraint).groupId;
  const groupRef = useRef(globalGroup);
  groupRef.current = globalGroup;
  const plugins = useMemo<CalendarPlugin[] | undefined>(() => {
    const groupConstraint: CalendarPlugin = {
      key: "fc-compat-group-constraint",
      type: "middleware",
      validate: (change, { eventsInRange }) => {
        const moving = change.event;
        const group = (moving.fc?.constraintGroupId as string | undefined) ?? groupRef.current;
        if (!group) return true;
        const span = spanOf(moving);
        const inside = eventsInRange(new Date(span.start), new Date(span.end)).some((e) => {
          if (e.id === moving.id || e.fc?.groupId !== group) return false;
          const host = spanOf(e);
          return host.start <= span.start && span.end <= host.end;
        });
        return inside || { ok: false, reason: "constraint" };
      },
    };
    return [...(props.agendfyPlugins ?? []), groupConstraint];
  }, [props.agendfyPlugins]);

  const height = props.height ?? props.contentHeight;
  const style: React.CSSProperties | undefined =
    height !== undefined && height !== "auto"
      ? { height: typeof height === "number" ? `${height}px` : height, overflow: "auto" }
      : undefined;
  const theme = props.themeSystem === "dark" || props.themeSystem === "light" ? props.themeSystem : undefined;

  return (
    <div className="fc-compat" style={style}>
      <Calendar
        events={events}
        config={config}
        theme={theme}
        currentDate={initialDate}
        apiRef={agendfyApi}
        onDatesSet={handleDatesSet}
        onEventClick={(event) =>
          props.eventClick?.({ event: api(event), el: null, jsEvent: null, view: viewRef.current })
        }
        onSlotClick={props.dateClick ? (date) => dateClick(date, false) : undefined}
        onDayClick={props.dateClick ? (date) => dateClick(date, true) : undefined}
        onDateRangeSelect={props.selectable ? handleSelect : undefined}
        onEventUpdate={canMove ? changeHandler("drop") : undefined}
        onEventResize={canResize ? changeHandler("resize") : undefined}
        eventContent={eventContent}
        eventClassNames={eventClassNames}
        dayCellClassNames={dayCellClassNames}
        plugins={plugins}
      />
    </div>
  );
});

export default FullCalendar;
