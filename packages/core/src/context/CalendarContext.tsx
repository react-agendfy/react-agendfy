import React, {
  createContext,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  ReactNode,
  FC,
  Dispatch,
} from "react";
import { TZDate } from "@date-fns/tz";
import {
  CalendarProps,
  CalendarView,
  ChangeVerdict,
  Config,
  DateRangeSelection,
  EventChange,
  EventProps,
  ExportOption,
  Resource,
} from "../types/types";
import {
  CalendarPlugin,
  ExportPlugin,
  ThemePlugin,
  ViewPlugin,
} from "../types/plugins";
import { getLocale } from "../Utils/locate";
import { formatMessage, getMessages, getTextDirection } from "../i18n";
import { normalizeEvents } from "../Utils/calendarHelpers";
import { toPublicEvent } from "../Utils/resources";
import { getFilteredEventsList, updateEventsList } from "../Utils/CalendarUtils";
import { downloadBlob } from "../Utils/pluginUtils";
import { useToast } from "../Components/Toast/Toast";
import { useEventReminder } from "../hooks/useEventReminder";
import { NotificationService } from "../Notify/NotificationService";
import useCalendarNavigation from "../hooks/useCalendarNavigation";
import usePluginManagement from "../hooks/usePluginManagement";
import useDataSourceEvents from "../hooks/useDataSourceEvents";
import { clampToValidRange, getDayRules, getExpansionWindow, getVisibleRange } from "../Utils/calendarRange";
import { expandRecurrences } from "../Utils/recurrence";
import { eventSpan, validateChange } from "../Utils/changeRules";
import { ChangeHistory, HistoryEntry, sameSchedule, withSchedule } from "../Utils/changeHistory";

export const defaultConfig: Config = {
  timeZone: "America/Sao_Paulo",
  defaultView: "week",
  slotDuration: 15,
  slotLabelFormat: "HH:mm",
  slotMin: "00:00",
  slotMax: "23:59",
  lang: "en",
  today: "Today",
  monthView: "Month",
  weekView: "Week",
  dayView: "Day",
  listView: "List",
  agenda: "Agenda",
  all_day: "All Day",
  clear_filter: "Clear Filters",
  filter_resources: "Filter Resources",
  businessHours: {
    enabled: true,
    intervals: [
      { daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" },
    ],
  },
  alerts: {
    enabled: false,
    thresholdMinutes: 15,
  },
  export: true,
  calendar_export: "Export",
};

/* -------------------------------------------------------------------------- */
/* Reducer                                                                     */
/* -------------------------------------------------------------------------- */

export interface CalendarState {
  currentDate: TZDate;
  events: EventProps[];
  localFilteredResources: string[];
  /**
   * Ids a filter plugin (`onFilterChange`) lets through; null when no plugin
   * filter is active. Kept across `events` updates.
   */
  pluginFilterIds: Set<EventProps["id"]> | null;
  /** Ids matching the active plugin search (`onSearch`); null when not searching. */
  pluginSearchIds: Set<EventProps["id"]> | null;
  currentView: string;
}

export type CalendarAction =
  | { type: "SET_CURRENT_DATE"; payload: TZDate }
  | { type: "SET_VIEW"; payload: string }
  | { type: "UPDATE_EVENT"; payload: EventProps }
  | { type: "ADD_EVENT"; payload: EventProps }
  | { type: "REMOVE_EVENT"; payload: EventProps["id"] }
  | { type: "SYNC_EVENTS"; payload: EventProps[] }
  | {
      type: "SET_RESOURCE_FILTER";
      payload: string[] | ((prev: string[]) => string[]);
    }
  | { type: "SET_PLUGIN_FILTER"; payload: Set<EventProps["id"]> | null }
  | { type: "SET_PLUGIN_SEARCH"; payload: { searchTerm: string; results: EventProps[] } };

export function calendarReducer(
  state: CalendarState,
  action: CalendarAction
): CalendarState {
  switch (action.type) {
    case "SET_CURRENT_DATE":
      return { ...state, currentDate: action.payload };
    case "SET_VIEW":
      return { ...state, currentView: action.payload };
    case "UPDATE_EVENT":
      return { ...state, events: updateEventsList(state.events, action.payload) };
    case "ADD_EVENT": {
      if (state.events.some((e) => e.id === action.payload.id)) {
        return { ...state, events: updateEventsList(state.events, action.payload) };
      }
      // An event the user just dropped shows even under an active plugin
      // filter or search.
      const withId = (ids: Set<EventProps["id"]> | null) => (ids ? new Set(ids).add(action.payload.id) : ids);
      return {
        ...state,
        events: [...state.events, action.payload],
        pluginFilterIds: withId(state.pluginFilterIds),
        pluginSearchIds: withId(state.pluginSearchIds),
      };
    }
    case "REMOVE_EVENT":
      return { ...state, events: state.events.filter((e) => e.id !== action.payload) };
    case "SYNC_EVENTS":
      // Plugin filter/search stay as they are: the host saving a drag must
      // not silently clear them.
      return { ...state, events: action.payload };
    case "SET_RESOURCE_FILTER":
      return {
        ...state,
        localFilteredResources:
          typeof action.payload === "function"
            ? action.payload(state.localFilteredResources)
            : action.payload,
      };
    case "SET_PLUGIN_FILTER":
      return { ...state, pluginFilterIds: action.payload };
    case "SET_PLUGIN_SEARCH":
      return {
        ...state,
        pluginSearchIds: action.payload.searchTerm.length > 0
          ? new Set(action.payload.results.map((e) => e.id))
          : null,
      };
    default:
      return state;
  }
}

/* -------------------------------------------------------------------------- */
/* Context value                                                               */
/* -------------------------------------------------------------------------- */

export interface CalendarContextValue {
  state: CalendarState;
  dispatch: Dispatch<CalendarAction>;

  // configuration / meta
  config: Partial<Config>;
  localeConfig: Config;
  /** Resolved text direction for the calendar root ("auto" already applied). */
  direction: "ltr" | "rtl";
  theme: string;
  resources: Resource[];

  // derived data
  normalizedEvents: EventProps[];
  /** Filtered master events (recurring events still carry their rule). */
  filteredEvents: EventProps[];
  /** Filtered events with recurrences expanded around the current date — what views render. */
  visibleEvents: EventProps[];
  availableViews: { name: string; label: string }[];
  customViews: Record<string, FC<any>>;
  exportOptions: ExportOption[];
  headerLeftPlugins: ReactNode[];
  headerRightPlugins: ReactNode[];

  // plugin categories consumed by views
  interactionPlugins: CalendarPlugin[];
  eventRenderingPlugins: CalendarPlugin[];
  themePlugins: ThemePlugin[];

  // data-source status
  isDataSourceLoading: boolean;
  dataSourceError: string | null;

  // user callbacks (pass-through)
  onEventClick?: (event: EventProps) => void;
  onDayClick?: (day: Date) => void;
  onSlotClick?: (slotTime: Date, info?: { resourceId?: string | number }) => void;

  /** Visible range of the active view, [start, end). */
  visibleRange: { start: Date; end: Date };

  // change pipeline (RFC 001)
  /** Validates, applies, calls back and records a move/resize. */
  commitChange: (change: EventChange) => ChangeVerdict;
  /** Validation only, no side effects (drag previews). */
  previewChange: (change: EventChange) => ChangeVerdict;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // handlers
  handleEventUpdate: (event: EventProps) => void;
  handleEventResize: (event: EventProps) => void;
  /** Undefined when the calendar accepts no external drops (no `onEventReceive`). */
  handleEventReceive?: (event: EventProps, data?: unknown) => void;
  handleDateRangeSelect: (event: EventProps | DateRangeSelection) => void;
  handleViewChange: (view: string) => void;
  handleResourceFilterChange: (selected: string[] | ((prev: string[]) => string[])) => void;
  handleExport: (format: string) => void;
  navigate: (direction: "prev" | "next" | "today") => void;
  /** Moves to `date` (clamped to `validRange`). */
  gotoDate: (date: Date | string) => void;
  /**
   * Text for `key`: `config[key]`, else the view plugins' `messages` for the
   * language (exact, base, English), else `fallback` (default: the key).
   * `{name}` placeholders are filled from `vars`.
   */
  t: (key: string, vars?: Record<string, string | number>, fallback?: string) => string;
  /** False when prev/next would leave `validRange`. */
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  /** Custom event body from the `eventContent` prop. */
  eventContent?: CalendarProps["eventContent"];
  /** Styling hooks from the `eventClassNames` / `dayCellClassNames` props. */
  eventClassNames?: CalendarProps["eventClassNames"];
  dayCellClassNames?: CalendarProps["dayCellClassNames"];
}

export const CalendarContext = createContext<CalendarContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

type CalendarProviderProps = CalendarProps & { children: ReactNode };

export const CalendarProvider: FC<CalendarProviderProps> = ({
  events: initialEvents = [],
  config = defaultConfig,
  direction: directionProp = "auto",
  resources = [],
  theme = "default",
  filteredResources = [],
  plugins = [],
  emailAdapter,
  emailConfig,
  onEventUpdate,
  onEventResize,
  onEventClick,
  onDayClick,
  onSlotClick,
  onDateRangeSelect,
  onChangeRejected,
  onEventReceive,
  onDateChange,
  onDatesSet,
  onViewChange,
  apiRef,
  eventContent,
  eventClassNames,
  dayCellClassNames,
  currentDate: currentDateProp,
  children,
}) => {
  const timeZone = config.timeZone || defaultConfig.timeZone;

  const [state, dispatch] = useReducer(calendarReducer, undefined, () => ({
    // Start inside validRange when today falls outside it.
    currentDate: new TZDate(
      clampToValidRange(
        new TZDate(currentDateProp ?? new Date(), timeZone),
        getDayRules({ ...config, timeZone }).validRange
      ),
      timeZone
    ),
    events: initialEvents,
    localFilteredResources: filteredResources,
    pluginFilterIds: null,
    pluginSearchIds: null,
    currentView: config.defaultView || defaultConfig.defaultView,
  }));

  const addToast = useToast();

  // resolvedConfig merges, in override order: built-in defaults → bundled
  // message catalog for config.lang → explicit user config keys (user
  // overrides always win). Stable across view changes.
  const resolvedConfig = useMemo(
    () => ({
      ...defaultConfig,
      ...getMessages(config.lang ?? defaultConfig.lang),
      ...config,
    }),
    [config]
  );

  // localeConfig is derived: resolved config + date-fns locale, with the
  // active view reflected in `defaultView` (keeps parity with the previous
  // behavior where switching views also updated the config passed to views).
  const localeConfig = useMemo(() => {
    return {
      ...resolvedConfig,
      ...getLocale(resolvedConfig.lang),
      defaultView: state.currentView as CalendarView,
    } as Config;
  }, [resolvedConfig, state.currentView]);

  // Text direction: explicit prop wins; "auto" derives from the language.
  const direction = useMemo<"ltr" | "rtl">(
    () =>
      directionProp === "ltr" || directionProp === "rtl"
        ? directionProp
        : getTextDirection(resolvedConfig.lang),
    [directionProp, resolvedConfig.lang]
  );

  const {
    filterPlugins,
    searchPlugins,
    dataSourcePlugins,
    customViewPlugins,
    eventRenderingPlugins,
    interactionPlugins,
    themePlugins,
    exportPlugins,
    middlewarePlugins,
  } = usePluginManagement(plugins);

  // Theme css variables are applied by CalendarView to the calendar's own
  // root element (scoped, multi-instance safe) — never to
  // document.documentElement. See the theme effect in View/Calendar.tsx.

  /* --- keep events in sync with the `events` prop ------------------------ */
  useEffect(() => {
    dispatch({ type: "SYNC_EVENTS", payload: initialEvents });
     
  }, [initialEvents]);

  /* --- `currentDate` prop: follow changes (navigation stays internal) ---- */
  const currentDatePropMs = currentDateProp ? currentDateProp.getTime() : null;
  useEffect(() => {
    if (currentDatePropMs === null || isNaN(currentDatePropMs)) return;
    dispatch({ type: "SET_CURRENT_DATE", payload: new TZDate(currentDatePropMs, timeZone) });
  }, [currentDatePropMs, timeZone]);

  /* --- report date changes (initial date included) ----------------------- */
  const stateDateMs = state.currentDate.getTime();
  useEffect(() => {
    onDateChange?.(new Date(stateDateMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateDateMs]);

  /* --- notification permission ------------------------------------------- */
  useEffect(() => {
    if (
      localeConfig.alerts?.enabled &&
      "Notification" in window &&
      Notification.permission !== "granted"
    ) {
      Notification.requestPermission();
    }
  }, [localeConfig.alerts?.enabled]);

  const notificationService = useMemo(
    () => new NotificationService({ emailAdapter, emailConfig }),
    [emailAdapter, emailConfig]
  );

  useEventReminder({
    events: state.events,
    notificationService,
    addToast,
    alertConfig: localeConfig.alerts ?? { enabled: false },
    config: localeConfig,
  });

  /* --- day rules + the active custom view's own range ------------------- */
  const dayRules = useMemo(() => getDayRules(localeConfig), [localeConfig]);

  const activeViewPlugin = useMemo(
    () => customViewPlugins.find((p: ViewPlugin) => p.viewName === state.currentView),
    [customViewPlugins, state.currentView]
  );
  // A view plugin with `range` reports its own [start, end); used for
  // recurrence expansion, data sources, onDatesSet, getView() and prev/next.
  const customRangeOf = useMemo(
    () =>
      activeViewPlugin?.range
        ? (date: Date) =>
            activeViewPlugin.range!(date, {
              weekStartsOn: dayRules.weekStartsOn,
              timeZone,
              config: localeConfig,
            })
        : undefined,
    [activeViewPlugin, dayRules.weekStartsOn, timeZone, localeConfig]
  );
  const customRange = useMemo(
    () => customRangeOf?.(state.currentDate),
    [customRangeOf, state.currentDate]
  );

  /* --- data-source plugins (phase-0: fetched events merge into pipeline) -- */
  const stableDataSourcePlugins = useMemo(
    () => dataSourcePlugins,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dataSourcePlugins)]
  );
  const { dataSourceEvents, isDataSourceLoading, dataSourceError, refetch: refetchDataSources } =
    // localeConfig carries the ACTIVE view (resolvedConfig only the initial
    // one), so fetch ranges follow view switches.
    useDataSourceEvents(stableDataSourcePlugins, localeConfig, state.currentDate, customRange);

  // Merge events fetched by data-source plugins with the user-provided events,
  // without clobbering user events (user events win on id collisions).
  const mergedEvents = useMemo(() => {
    if (!dataSourceEvents || dataSourceEvents.length === 0) return state.events;
    const existingIds = new Set(state.events.map((e) => e.id));
    return [
      ...state.events,
      ...dataSourceEvents.filter((e) => !existingIds.has(e.id)),
    ];
  }, [state.events, dataSourceEvents]);

  /* --- derived event pipeline -------------------------------------------- */
  const normalizedEvents = useMemo(
    // resourceIds/resourceId resolved against the `resources` prop (icons,
    // tooltips, resource filter).
    () => normalizeEvents(mergedEvents, resources),
    [mergedEvents, resources]
  );

  const filteredEvents = useMemo(
    () =>
      getFilteredEventsList(
        normalizedEvents,
        state.localFilteredResources,
        state.pluginFilterIds,
        state.pluginSearchIds
      ),
    [
      normalizedEvents,
      state.localFilteredResources,
      state.pluginFilterIds,
      state.pluginSearchIds,
    ]
  );

  /* --- recurrence expansion ---------------------------------------------- */
  // Expanded once for a window covering every built-in view of the current
  // date (month grid ± 1 week), widened to a custom view's own range, so
  // views never deal with rules themselves.
  const expansionWindow = getExpansionWindow(state.currentDate, dayRules.weekStartsOn);
  const windowStart = Math.min(
    expansionWindow.start.getTime(),
    customRange ? customRange.start.getTime() : Infinity
  );
  const windowEnd = Math.max(
    expansionWindow.end.getTime(),
    customRange ? customRange.end.getTime() : -Infinity
  );
  const visibleEvents = useMemo(
    () => expandRecurrences(filteredEvents, new Date(windowStart), new Date(windowEnd), timeZone),
    [filteredEvents, windowStart, windowEnd, timeZone]
  );

  /* --- change pipeline (RFC 001, layer 1) --------------------------------- */
  // validate → apply optimistically → host callback (a rejected Promise
  // reverts, like FullCalendar's info.revert()) → undo history.
  const eventsRef = useRef(state.events);
  eventsRef.current = state.events;
  const visibleEventsRef = useRef(visibleEvents);
  visibleEventsRef.current = visibleEvents;
  const normalizedEventsRef = useRef(normalizedEvents);
  normalizedEventsRef.current = normalizedEvents;

  const historyRef = useRef<ChangeHistory | null>(null);
  if (!historyRef.current) historyRef.current = new ChangeHistory();
  const history = historyRef.current;
  history.limit = localeConfig.historyLimit ?? 100;
  // Re-render when the stacks change (canUndo/canRedo).
  const [, bumpHistory] = useReducer((n: number) => n + 1, 0);

  /** The event as it is now: a stored event, else a rendered occurrence. */
  const findCurrent = useCallback((id: EventProps["id"]) => {
    const found = eventsRef.current.find((e) => e.id === id) ?? visibleEventsRef.current.find((e) => e.id === id);
    return found && toPublicEvent(found);
  }, []);

  const eventsInRange = useCallback(
    (start: Date, end: Date) => {
      const from = start.getTime();
      const to = end.getTime();
      return expandRecurrences(normalizedEventsRef.current, start, end, timeZone).filter((e) => {
        const span = eventSpan(e);
        return span.start < to && from < span.end;
      });
    },
    [timeZone]
  );

  const previewChange = useCallback(
    (change: EventChange): ChangeVerdict => {
      // Dropping in place, or replaying history, is always fine.
      if (change.source === "history") return true;
      if (change.before && sameSchedule(change.before, change.event)) return true;
      return validateChange(change, { config: localeConfig, eventsInRange, resources }, middlewarePlugins);
    },
    [localeConfig, eventsInRange, middlewarePlugins, resources]
  );

  const runChange = useCallback(
    (change: EventChange, onReverted?: () => void): ChangeVerdict => {
      const unchanged = !!change.before && sameSchedule(change.before, change.event);

      const verdict = previewChange(change);
      if (verdict !== true) {
        onChangeRejected?.({
          change,
          reason: verdict.reason,
          message: verdict.message,
          conflicts: verdict.conflicts,
        });
        return verdict;
      }

      // A received event is new: added, and removed again on revert. It is
      // not recorded (undoing it would need a remove callback).
      const isReceive = change.kind === "receive";
      // The host gets its own shape back: no resources the calendar derived.
      const event = toPublicEvent(change.event);
      const before = change.before && toPublicEvent(change.before);
      dispatch({ type: isReceive ? "ADD_EVENT" : "UPDATE_EVENT", payload: event });
      const entryId =
        change.kind !== "receive" && change.source === "user" && before && !unchanged
          ? history.record(change.kind, before, event)
          : null;
      if (entryId !== null) bumpHistory();
      middlewarePlugins.forEach((p) => p.onCommit?.(change));

      const result = isReceive
        ? onEventReceive?.(event, change.data)
        : (change.kind === "resize" ? onEventResize : onEventUpdate)?.(event);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(undefined, () => {
          if (isReceive) dispatch({ type: "REMOVE_EVENT", payload: event.id });
          else if (before) dispatch({ type: "UPDATE_EVENT", payload: before });
          if (entryId !== null) {
            history.remove(entryId);
            bumpHistory();
          }
          onReverted?.();
          middlewarePlugins.forEach((p) => p.onRevert?.(change));
        });
      }
      return true;
    },
    [previewChange, middlewarePlugins, onChangeRejected, history, onEventUpdate, onEventResize, onEventReceive]
  );

  const commitChange = useCallback((change: EventChange) => runChange(change), [runChange]);

  /** Re-applies one side of a history entry; puts the entry back if the host refuses. */
  const replay = useCallback(
    (entry: HistoryEntry, target: "before" | "after", onDone: () => void, onFailed: () => void) => {
      const current = findCurrent(entry.after.id) ?? entry[target === "before" ? "after" : "before"];
      runChange(
        { kind: entry.kind, event: withSchedule(current, entry[target]), before: current, source: "history" },
        () => {
          onFailed();
          bumpHistory();
        }
      );
      onDone();
      bumpHistory();
    },
    [findCurrent, runChange]
  );

  const undo = useCallback(() => {
    const entry = history.takeUndo();
    if (!entry) return;
    replay(
      entry,
      "before",
      () => history.pushRedo(entry),
      () => {
        history.remove(entry.id);
        history.pushUndo(entry);
      }
    );
  }, [history, replay]);

  const redo = useCallback(() => {
    const entry = history.takeRedo();
    if (!entry) return;
    replay(
      entry,
      "after",
      () => history.pushUndo(entry),
      () => {
        history.remove(entry.id);
        history.pushRedo(entry);
      }
    );
  }, [history, replay]);

  const handleEventUpdate = useCallback(
    (updatedEvent: EventProps) => {
      runChange({ kind: "move", event: updatedEvent, before: findCurrent(updatedEvent.id), source: "user" });
    },
    [runChange, findCurrent]
  );

  const handleEventResize = useCallback(
    (resizeEvent: EventProps) => {
      runChange({ kind: "resize", event: resizeEvent, before: findCurrent(resizeEvent.id), source: "user" });
    },
    [runChange, findCurrent]
  );

  const handleEventReceive = useCallback(
    (event: EventProps, data?: unknown) => {
      runChange({ kind: "receive", event, data, source: "user" });
    },
    [runChange]
  );

  const selectAllow = localeConfig.selectAllow;
  const handleDateRangeSelect = useCallback(
    (rangeEvent: EventProps | DateRangeSelection) => {
      if (selectAllow && selectAllow(rangeEvent as DateRangeSelection) === false) return;
      // A bare range selection has no id, so updateEventsList leaves the
      // events list untouched (parity with the pre-refactor behavior).
      dispatch({ type: "UPDATE_EVENT", payload: rangeEvent as EventProps });
      onDateRangeSelect?.(rangeEvent);
    },
    [onDateRangeSelect, selectAllow]
  );

  const handleViewChange = useCallback((newView: string) => {
    dispatch({ type: "SET_VIEW", payload: newView });
  }, []);

  const handleResourceFilterChange = useCallback(
    (selected: string[] | ((prev: string[]) => string[])) => {
      dispatch({ type: "SET_RESOURCE_FILTER", payload: selected });
    },
    []
  );

  // A filter plugin passes the events it keeps. Keeping all of them (its
  // "clear") turns the filter off, so later events (data sources, new ones)
  // are not hidden by a stale list.
  const handleFilterChangeFromPlugin = useCallback((filtered: EventProps[]) => {
    const ids = new Set(filtered.map((e) => e.id));
    const keepsAll = normalizedEventsRef.current.every((e) => ids.has(e.id));
    dispatch({ type: "SET_PLUGIN_FILTER", payload: keepsAll ? null : ids });
  }, []);

  const handleSearchFromPlugin = useCallback(
    (searchTerm: string, results: EventProps[]) => {
      dispatch({ type: "SET_PLUGIN_SEARCH", payload: { searchTerm, results } });
    },
    []
  );

  const setCurrentDate = useCallback(
    (date: Date) => {
      dispatch({ type: "SET_CURRENT_DATE", payload: new TZDate(date, timeZone) });
    },
    [timeZone]
  );

  const customNavigation = useMemo(
    () =>
      activeViewPlugin && (activeViewPlugin.range || activeViewPlugin.step)
        ? { step: activeViewPlugin.step, rangeOf: customRangeOf }
        : undefined,
    [activeViewPlugin, customRangeOf]
  );

  const {
    navigateToday,
    navigateBack,
    navigateForward,
    canNavigateBack,
    canNavigateForward,
  } = useCalendarNavigation({
    currentDate: state.currentDate,
    defaultView: state.currentView,
    timeZone,
    setCurrentDate,
    dayRules,
    custom: customNavigation,
  });

  /* --- visible range: onDatesSet / onViewChange / imperative API -------- */
  const visibleRange = useMemo(
    () => customRange ?? getVisibleRange(state.currentView, state.currentDate, localeConfig),
    [customRange, state.currentView, state.currentDate, localeConfig]
  );
  const rangeStartMs = visibleRange.start.getTime();
  const rangeEndMs = visibleRange.end.getTime();
  useEffect(() => {
    onDatesSet?.({
      start: new Date(rangeStartMs),
      end: new Date(rangeEndMs),
      view: state.currentView,
      date: new Date(state.currentDate.getTime()),
    });
    // Fires on range/view changes only (not on every date inside the range).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStartMs, rangeEndMs, state.currentView]);

  const isFirstView = useRef(true);
  useEffect(() => {
    if (isFirstView.current) {
      isFirstView.current = false;
      return;
    }
    onViewChange?.(state.currentView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentView]);

  const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));
  useImperativeHandle(
    apiRef,
    () => ({
      getDate: () => new Date(state.currentDate.getTime()),
      gotoDate: (date) => setCurrentDate(clampToValidRange(toDate(date), dayRules.validRange)),
      next: () => navigateForward(),
      prev: () => navigateBack(),
      today: () => navigateToday(),
      changeView: (view, date) => {
        dispatch({ type: "SET_VIEW", payload: view });
        if (date !== undefined) setCurrentDate(clampToValidRange(toDate(date), dayRules.validRange));
      },
      getView: () => ({
        type: state.currentView,
        activeStart: new Date(rangeStartMs),
        activeEnd: new Date(rangeEndMs),
      }),
      refetchEvents: refetchDataSources,
      undo,
      redo,
      canUndo: () => history.canUndo(),
      canRedo: () => history.canRedo(),
    }),
    [
      state.currentDate,
      state.currentView,
      setCurrentDate,
      dayRules.validRange,
      navigateForward,
      navigateBack,
      navigateToday,
      rangeStartMs,
      rangeEndMs,
      refetchDataSources,
      undo,
      redo,
      history,
    ]
  );

  const publicEventClick = useMemo(
    () => (onEventClick ? (event: EventProps) => onEventClick(toPublicEvent(event)) : undefined),
    [onEventClick]
  );

  const gotoDate = useCallback(
    (date: Date | string) =>
      setCurrentDate(clampToValidRange(date instanceof Date ? date : new Date(date), dayRules.validRange)),
    [setCurrentDate, dayRules.validRange]
  );

  /* --- texts: config, then the view plugins' messages ------------------- */
  const pluginMessages = useMemo(() => {
    const lang = (resolvedConfig.lang ?? "en").toLowerCase().replace("_", "-");
    const base = lang.split("-")[0];
    const merged: Record<string, string> = {};
    for (const plugin of customViewPlugins) {
      const byLang = Object.fromEntries(
        Object.entries(plugin.messages ?? {}).map(([k, v]) => [k.toLowerCase().replace("_", "-"), v])
      );
      Object.assign(merged, byLang.en, byLang[base], byLang[lang]);
    }
    return merged;
  }, [customViewPlugins, resolvedConfig.lang]);

  const t = useCallback(
    (key: string, vars: Record<string, string | number> = {}, fallback?: string) => {
      const fromConfig = (resolvedConfig as unknown as Record<string, unknown>)[key];
      const template = typeof fromConfig === "string" ? fromConfig : pluginMessages[key];
      return formatMessage(template, vars, fallback ?? key);
    },
    [resolvedConfig, pluginMessages]
  );

  const navigate = useCallback(
    (direction: "prev" | "next" | "today") => {
      if (direction === "today") navigateToday();
      else if (direction === "prev") navigateBack();
      else if (direction === "next") navigateForward();
    },
    [navigateToday, navigateBack, navigateForward]
  );

  const handleExport = useCallback(
    (format: string) => {
      const customExportPlugin = exportPlugins.find(
        (p: ExportPlugin) => p.formatName === format
      );
      if (!customExportPlugin) {
        console.warn(`No export plugin registered for format "${format}".`);
        addToast({
          title: localeConfig.calendar_export || "Export",
          message: `${localeConfig.export_error || "No export plugin for format"}: ${format}`,
        });
        return;
      }
      Promise.resolve(
        customExportPlugin.exportFunction(filteredEvents, localeConfig)
      )
        .then((content) => {
          const dateStr = new Date().toISOString().split("T")[0];
          const fileName = `calendar-events-${dateStr}.${customExportPlugin.fileExtension}`;
          const mimeType = customExportPlugin.mimeType;
          const payload =
            typeof content === "string" && mimeType
              ? new Blob([content], { type: mimeType })
              : content;
          downloadBlob(payload, fileName);
        })
        .catch((error) => {
          console.error(`Error exporting with plugin ${format}:`, error);
          addToast({
            title: localeConfig.calendar_export || "Export",
            message: `${localeConfig.export_error || "Failed to export"}: ${format}`,
          });
        });
    },
    [filteredEvents, localeConfig, exportPlugins, addToast]
  );

  /* --- available views & custom views ------------------------------------ */
  const availableViews = useMemo(() => {
    const defaultViews = [
      { name: "month", label: localeConfig.monthView },
      { name: "week", label: localeConfig.weekView },
      { name: "day", label: localeConfig.dayView },
      { name: "list", label: localeConfig.listView },
      { name: "agenda", label: localeConfig.agenda },
    ];
    const customViews = customViewPlugins.map((plugin: ViewPlugin) => ({
      name: plugin.viewName,
      label:
        typeof plugin.label === "object"
          ? t(plugin.label.key, undefined, plugin.viewName)
          : plugin.label || plugin.props?.label || plugin.viewName,
    }));
    // Resource views: listed by default only when there are resources;
    // headerViews can always ask for them.
    const resourceViews = [
      { name: "resourceDay", label: localeConfig.resourceDayView ?? "Resource day" },
      { name: "resourceWeek", label: localeConfig.resourceWeekView ?? "Resource week" },
    ];
    const all = [...defaultViews, ...resourceViews, ...customViews];
    // headerViews picks and orders the buttons (unknown names are ignored).
    const wanted = localeConfig.headerViews;
    if (!wanted?.length) {
      return resources.length ? all : [...defaultViews, ...customViews];
    }
    return wanted
      .map((name) => all.find((v) => v.name === name))
      .filter((v): v is { name: string; label: string } => !!v);
  }, [localeConfig, customViewPlugins, t, resources.length]);

  const customViews = useMemo(() => {
    const views: Record<string, FC<any>> = {};
    customViewPlugins.forEach((plugin: ViewPlugin) => {
      if (plugin.viewName && plugin.component) {
        views[plugin.viewName] = plugin.component;
      }
    });
    return views;
  }, [customViewPlugins]);

  /* --- header plugins (filter/search), split left/right ------------------ */
  const combinedExclusivePlugins = useMemo(() => {
    type Entry = { plugin: CalendarPlugin; sources: Set<"filter" | "search"> };
    const map = new Map<string, Entry>();
    const makeKey = (p: CalendarPlugin, idx: number) => p.key || `${p.type}-${idx}`;

    filterPlugins.forEach((p, idx) => {
      const k = makeKey(p, idx);
      const existing = map.get(k);
      if (existing) existing.sources.add("filter");
      else map.set(k, { plugin: p, sources: new Set(["filter"]) });
    });

    searchPlugins.forEach((p, idx) => {
      const k = makeKey(p, idx);
      const existing = map.get(k);
      if (existing) existing.sources.add("search");
      else map.set(k, { plugin: p, sources: new Set(["search"]) });
    });

    const leftList: CalendarPlugin[] = [];
    const rightList: CalendarPlugin[] = [];
    map.forEach(({ plugin, sources }) => {
      if (plugin.location === "left") {
        leftList.push(plugin);
      } else if (plugin.location === "right") {
        rightList.push(plugin);
      } else if (sources.has("search") && !sources.has("filter")) {
        rightList.push(plugin);
      } else {
        leftList.push(plugin);
      }
    });
    return { leftList, rightList };
  }, [filterPlugins, searchPlugins]);

  const renderPluginList = useCallback(
    (list: CalendarPlugin[], side: "left" | "right"): ReactNode[] =>
      list.map((plugin, idx) => {
        const Component = plugin.component as FC<any> | undefined;
        return Component ? (
          <Component
            key={plugin.key ?? `${side}-${idx}`}
            events={normalizedEvents}
            onFilterChange={handleFilterChangeFromPlugin}
            onSearch={handleSearchFromPlugin}
            config={localeConfig}
            resources={resources}
            filteredResources={state.localFilteredResources}
            onResourceFilterChange={handleResourceFilterChange}
            {...plugin.props}
          />
        ) : null;
      }),
    [
      normalizedEvents,
      handleFilterChangeFromPlugin,
      handleSearchFromPlugin,
      localeConfig,
      resources,
      state.localFilteredResources,
      handleResourceFilterChange,
    ]
  );

  const headerLeftPlugins = useMemo(
    () => renderPluginList(combinedExclusivePlugins.leftList, "left"),
    [combinedExclusivePlugins, renderPluginList]
  );
  const headerRightPlugins = useMemo(
    () => renderPluginList(combinedExclusivePlugins.rightList, "right"),
    [combinedExclusivePlugins, renderPluginList]
  );

  const exportOptions = useMemo<ExportOption[]>(
    () =>
      exportPlugins.map((plugin: ExportPlugin) => ({
        formatName: plugin.formatName,
        label: plugin.label,
      })),
    [exportPlugins]
  );

  const value: CalendarContextValue = {
    state,
    dispatch,
    config,
    localeConfig,
    direction,
    theme,
    resources,
    normalizedEvents,
    filteredEvents,
    visibleEvents,
    availableViews,
    customViews,
    exportOptions,
    headerLeftPlugins,
    headerRightPlugins,
    interactionPlugins,
    eventRenderingPlugins,
    themePlugins,
    isDataSourceLoading,
    dataSourceError,
    onEventClick: publicEventClick,
    onDayClick,
    onSlotClick,
    visibleRange,
    commitChange,
    previewChange,
    undo,
    redo,
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    handleEventUpdate,
    handleEventResize,
    handleEventReceive: onEventReceive ? handleEventReceive : undefined,
    handleDateRangeSelect,
    handleViewChange,
    handleResourceFilterChange,
    handleExport,
    navigate,
    gotoDate,
    t,
    canNavigateBack,
    canNavigateForward,
    eventContent,
    eventClassNames,
    dayCellClassNames,
  };

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  );
};
