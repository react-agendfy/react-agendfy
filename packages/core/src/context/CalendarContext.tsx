import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  ReactNode,
  FC,
  Dispatch,
} from "react";
import { TZDate } from "@date-fns/tz";
import {
  CalendarProps,
  CalendarView,
  Config,
  DateRangeSelection,
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
import { getMessages, getTextDirection } from "../i18n";
import { normalizeEvents } from "../Utils/calendarHelpers";
import { getFilteredEventsList, updateEventsList } from "../Utils/CalendarUtils";
import { downloadBlob } from "../Utils/pluginUtils";
import { useToast } from "../Components/Toast/Toast";
import { useEventReminder } from "../hooks/useEventReminder";
import { NotificationService } from "../Notify/NotificationService";
import useCalendarNavigation from "../hooks/useCalendarNavigation";
import usePluginManagement from "../hooks/usePluginManagement";
import useDataSourceEvents from "../hooks/useDataSourceEvents";

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
  pluginFilteredEvents: EventProps[];
  pluginSearchResults: EventProps[];
  isSearchActive: boolean;
  currentView: string;
}

export type CalendarAction =
  | { type: "SET_CURRENT_DATE"; payload: TZDate }
  | { type: "SET_VIEW"; payload: string }
  | { type: "UPDATE_EVENT"; payload: EventProps }
  | { type: "SYNC_EVENTS"; payload: EventProps[] }
  | {
      type: "SET_RESOURCE_FILTER";
      payload: string[] | ((prev: string[]) => string[]);
    }
  | { type: "SET_PLUGIN_FILTERED_EVENTS"; payload: EventProps[] }
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
    case "SYNC_EVENTS":
      return {
        ...state,
        events: action.payload,
        pluginFilteredEvents: action.payload,
        pluginSearchResults: action.payload,
        isSearchActive: false,
      };
    case "SET_RESOURCE_FILTER":
      return {
        ...state,
        localFilteredResources:
          typeof action.payload === "function"
            ? action.payload(state.localFilteredResources)
            : action.payload,
      };
    case "SET_PLUGIN_FILTERED_EVENTS":
      return { ...state, pluginFilteredEvents: action.payload };
    case "SET_PLUGIN_SEARCH":
      return {
        ...state,
        pluginSearchResults: action.payload.results,
        isSearchActive: action.payload.searchTerm.length > 0,
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
  filteredEvents: EventProps[];
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
  onSlotClick?: (slotTime: Date) => void;

  // handlers
  handleEventUpdate: (event: EventProps) => void;
  handleEventResize: (event: EventProps) => void;
  handleDateRangeSelect: (event: EventProps | DateRangeSelection) => void;
  handleViewChange: (view: string) => void;
  handleResourceFilterChange: (selected: string[] | ((prev: string[]) => string[])) => void;
  handleExport: (format: string) => void;
  navigate: (direction: "prev" | "next" | "today") => void;
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
  children,
}) => {
  const timeZone = config.timeZone || defaultConfig.timeZone;

  const [state, dispatch] = useReducer(calendarReducer, undefined, () => ({
    currentDate: new TZDate(new Date(), timeZone),
    events: initialEvents,
    localFilteredResources: filteredResources,
    pluginFilteredEvents: initialEvents,
    pluginSearchResults: initialEvents,
    isSearchActive: false,
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
  } = usePluginManagement(plugins);

  // Theme css variables are applied by CalendarView to the calendar's own
  // root element (scoped, multi-instance safe) — never to
  // document.documentElement. See the theme effect in View/Calendar.tsx.

  /* --- keep events in sync with the `events` prop ------------------------ */
  useEffect(() => {
    dispatch({ type: "SYNC_EVENTS", payload: initialEvents });
     
  }, [initialEvents]);

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

  /* --- data-source plugins (phase-0: fetched events merge into pipeline) -- */
  const stableDataSourcePlugins = useMemo(
    () => dataSourcePlugins,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(dataSourcePlugins)]
  );
  const { dataSourceEvents, isDataSourceLoading, dataSourceError } =
    useDataSourceEvents(stableDataSourcePlugins, resolvedConfig, state.currentDate);

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
    () => normalizeEvents(mergedEvents),
    [mergedEvents]
  );

  const filteredEvents = useMemo(
    () =>
      getFilteredEventsList(
        normalizedEvents,
        state.localFilteredResources,
        state.pluginFilteredEvents,
        state.pluginSearchResults,
        state.isSearchActive
      ),
    [
      normalizedEvents,
      state.localFilteredResources,
      state.pluginFilteredEvents,
      state.pluginSearchResults,
      state.isSearchActive,
    ]
  );

  /* --- handlers ----------------------------------------------------------- */
  const handleEventUpdate = useCallback(
    (updatedEvent: EventProps) => {
      dispatch({ type: "UPDATE_EVENT", payload: updatedEvent });
      onEventUpdate?.(updatedEvent);
    },
    [onEventUpdate]
  );

  const handleEventResize = useCallback(
    (resizeEvent: EventProps) => {
      dispatch({ type: "UPDATE_EVENT", payload: resizeEvent });
      onEventResize?.(resizeEvent);
    },
    [onEventResize]
  );

  const handleDateRangeSelect = useCallback(
    (rangeEvent: EventProps | DateRangeSelection) => {
      // A bare range selection has no id, so updateEventsList leaves the
      // events list untouched (parity with the pre-refactor behavior).
      dispatch({ type: "UPDATE_EVENT", payload: rangeEvent as EventProps });
      onDateRangeSelect?.(rangeEvent);
    },
    [onDateRangeSelect]
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

  const handleFilterChangeFromPlugin = useCallback((filtered: EventProps[]) => {
    dispatch({ type: "SET_PLUGIN_FILTERED_EVENTS", payload: filtered });
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

  const { navigateToday, navigateBack, navigateForward } = useCalendarNavigation({
    currentDate: state.currentDate,
    defaultView: state.currentView,
    timeZone,
    setCurrentDate,
  });

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
      label: plugin.props?.label || plugin.viewName,
    }));
    return [...defaultViews, ...customViews];
  }, [localeConfig, customViewPlugins]);

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
    onEventClick,
    onDayClick,
    onSlotClick,
    handleEventUpdate,
    handleEventResize,
    handleDateRangeSelect,
    handleViewChange,
    handleResourceFilterChange,
    handleExport,
    navigate,
  };

  return (
    <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
  );
};
