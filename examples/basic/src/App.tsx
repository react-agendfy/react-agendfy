import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AgendfyDndProvider,
  Calendar,
  type CalendarApi,
  type CalendarPlugin,
  type ChangeRejectedInfo,
  type DatesSetInfo,
} from "@react-agendfy/core";
import exportsPlugin from "@react-agendfy/plugin-export-reports";
import { createQuickAddPlugin, go4aiAdapter, httpAdapter } from "@react-agendfy/ai";
import { ArrowRightLeft, BookOpen, Github, Menu, Moon, Package, PanelLeftClose, PanelLeftOpen, RotateCcw, Sparkles, Sun } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar, { type DemoOptions, type PendingItem } from "./components/Sidebar";
import EventModal, { type EventDraft } from "./components/EventModal";
import AIDrawer from "./components/AIDrawer";
import { renderEventContent } from "./components/EventContent";
import timelinePlugins from "@react-agendfy/plugin-timeline";
import ganttPlugins, { isTask } from "@react-agendfy/gantt";
import { categoryColor, createDemoEvents, resources, type CategoryId } from "./demoEvents";
import GanttPage from "./GanttPage";
import { accentPresets } from "./themes";
import { addDaysKey, dayKey, fromZoned, zonedParts } from "./lib/time";
import corePkg from "../../../packages/core/package.json";

/* -------------------------------------------------------------------------- */
/* AI adapter                                                                  */
/* -------------------------------------------------------------------------- */
// A browser-side key is for LOCAL development only: in a production build it
// would ship inside the public JavaScript. The public demo either talks to a
// proxy (VITE_AI_PROXY: the key stays server-side) or runs the built-in,
// offline parser (no adapter).
const devBrowserKey = import.meta.env.DEV ? import.meta.env.VITE_GO4AI_API_KEY : undefined;
const aiAdapter = devBrowserKey
  ? go4aiAdapter({
      apiKey: devBrowserKey,
      baseUrl: import.meta.env.VITE_GO4AI_BASE_URL || "https://ai.go4ai.io/v1",
      model: import.meta.env.VITE_GO4AI_MODEL || "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      dangerouslyAllowBrowser: true,
    })
  : import.meta.env.VITE_AI_PROXY
    ? httpAdapter({ endpoint: import.meta.env.VITE_AI_PROXY })
    : undefined;

/* -------------------------------------------------------------------------- */
/* Persistence (per-visitor conveniences only)                                 */
/* -------------------------------------------------------------------------- */
// v3: events use resourceIds (the library's resource model).
const EVENTS_KEY = "agendfy-demo-events-v3";
const OPTIONS_KEY = "agendfy-demo-options-v2";
const SIDEBAR_KEY = "agendfy-demo-sidebar-collapsed";
const THEME_KEY = "agendfy-demo-theme";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
};

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const defaultOptions: DemoOptions = {
  lang: "en",
  timeZone: browserZone,
  weekStart: "auto",
  weekends: true,
  weekNumbers: false,
  hour12: false,
  accent: "indigo",
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function App() {
  const apiRef = useRef<CalendarApi>(null);

  /* --- events: demo around today, until the visitor edits ---------------- */
  const [events, setEvents] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem(EVENTS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      /* corrupt: fall back to the demo */
    }
    return createDemoEvents();
  });
  const edited = useRef(false);
  const editEvents = useCallback((update: (prev: any[]) => any[]) => {
    edited.current = true;
    setEvents(update);
  }, []);
  useEffect(() => {
    if (edited.current) write(EVENTS_KEY, events);
  }, [events]);

  /* --- shell state ------------------------------------------------------- */
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const [options, setOptions] = useState<DemoOptions>(() => read(OPTIONS_KEY, defaultOptions));
  const updateOptions = useCallback((patch: Partial<DemoOptions>) => {
    setOptions((o) => {
      const next = { ...o, ...patch };
      write(OPTIONS_KEY, next);
      return next;
    });
  }, []);

  // Two pages: the calendar demo (#/) and the Gantt on its own (#/gantt).
  const pageFromHash = () => (window.location.hash === "#/gantt" ? "gantt" : "calendar");
  const [page, setPage] = useState<"calendar" | "gantt">(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [hiddenCategories, setHidden] = useState<Set<CategoryId>>(new Set());
  const [activeResources, setActiveResources] = useState<string[]>([]);
  // Small screens: the sidebar is a drawer (open). Wide screens: it can be
  // hidden to give the calendar the whole width (collapsed, remembered).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      return false;
    }
  });
  const isDrawer = () => window.matchMedia("(max-width: 900px)").matches;
  const toggleSidebar = () => {
    if (isDrawer()) return setSidebarOpen((o) => !o);
    setSidebarCollapsed((c) => {
      write(SIDEBAR_KEY, !c);
      return !c;
    });
  };
  const [aiOpen, setAiOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [range, setRange] = useState<DatesSetInfo | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  const tz = options.timeZone;

  /* --- calendar config: only what the demo changes -------------------------- */
  const config = useMemo(
    () => ({
      timeZone: tz,
      lang: options.lang,
      weekStartsOn: options.weekStart === "auto" ? undefined : (Number(options.weekStart) as 0 | 1),
      weekends: options.weekends,
      weekNumbers: options.weekNumbers,
      eventTimeFormat: options.hour12 ? "h:mm a" : "HH:mm",
      slotLabelFormat: options.hour12 ? "h a" : "HH:mm",
      defaultView: (window.innerWidth < 700 ? "agenda" : "week") as "agenda" | "week",
      // Related views share one button with a menu.
      headerViews: [
        "month",
        "week",
        "day",
        { label: "List", views: ["list", "agenda"] },
        { label: "Resources", views: ["resourceDay", "resourceWeek"] },
        { label: "Timeline", views: ["timelineDay", "timelineWeek", "timelineMonth"] },
        "gantt",
      ],
      slotDuration: 30,
      slotMin: "07:00",
      slotMax: "21:00",
      businessHours: {
        enabled: true,
        intervals: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "18:00" }],
      },
      alerts: { enabled: false, thresholdMinutes: 2 },
      export: true,
      // Scheduling rules: refused moves never reach onEventUpdate.
      eventOverlap: options.noOverlap ? false : undefined,
      eventConstraint: options.businessOnly ? ("businessHours" as const) : undefined,
    }),
    [tz, options.lang, options.weekStart, options.weekends, options.weekNumbers, options.hour12, options.noOverlap, options.businessOnly]
  );

  /* --- filtering (categories + resources) ---------------------------------- */
  // Project tasks only show in the Gantt: in the other views they would fill
  // the all-day row.
  const inGantt = range?.view === "gantt";
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (inGantt || !isTask(e)) &&
          !hiddenCategories.has(e.category) &&
          (activeResources.length === 0 || (e.resourceIds ?? []).some((id: string) => activeResources.includes(id)))
      ),
    [events, hiddenCategories, activeResources, inGantt]
  );

  /* --- create / edit --------------------------------------------------------- */
  const openNew = useCallback(
    (start: Date | string, end: Date | string, allDay = false, resourceIds: string[] = []) =>
      setDraft({ start, end, allDay, category: "meeting", resourceIds }),
    []
  );
  const newAtNextHour = () => {
    const p = zonedParts(new Date(), tz);
    const start = fromZoned(p.date, `${String(Math.min(p.hour + 1, 23)).padStart(2, "0")}:00`, tz);
    openNew(start, new Date(start.getTime() + 3600000));
  };

  const onEventClick = useCallback(
    (event: any) => {
      if (event.isRecurrenceInstance) {
        const series = events.find((e) => e.id === event.originalEventId);
        setDraft({ ...(series ?? event), start: event.start, end: event.end, id: undefined, seriesId: event.originalEventId });
        return;
      }
      setDraft(events.find((e) => e.id === event.id) ?? event);
    },
    [events]
  );

  const onDayClick = useCallback(
    (day: Date) => {
      const key = dayKey(day, tz);
      openNew(fromZoned(key, "09:00", tz), fromZoned(key, "10:00", tz));
    },
    [tz, openNew]
  );
  // In the resource views the slot belongs to a resource: the new event gets it.
  const onSlotClick = useCallback(
    (slot: Date, info?: { resourceId?: string | number }) =>
      openNew(slot, new Date(slot.getTime() + 3600000), false, info?.resourceId !== undefined ? [String(info.resourceId)] : []),
    [openNew]
  );
  const onSelect = useCallback(
    (sel: any) => {
      const s = new Date(sel.start);
      const e = new Date(sel.end);
      if (range?.view === "month") {
        if (!sel.isMultiDay) return; // a plain click: onDayClick handles it
        // Month selections are inclusive days → exclusive all-day end.
        const endKey = addDaysKey(dayKey(e, tz), 1);
        openNew(fromZoned(dayKey(s, tz), "00:00", tz), fromZoned(endKey, "00:00", tz), true);
        return;
      }
      if (e.getTime() - s.getTime() < 15 * 60000) return;
      openNew(s, e);
    },
    [range?.view, tz, openNew]
  );

  // One wording for refusals, from a drag or from the event form.
  const refusal = (reason: string, conflicts?: { title?: string }[]) =>
    reason === "overlap"
      ? `Overlaps “${conflicts?.[0]?.title ?? "another event"}”`
      : reason === "constraint"
        ? "Outside business hours"
        : "Not allowed";

  const saveEvent = useCallback(
    (ev: any) => {
      // The form goes through the same rules as a drag (api.validate).
      if (!ev.__seriesPatch) {
        const before = ev.id ? events.find((e) => e.id === ev.id) : undefined;
        const verdict = apiRef.current?.validate(
          before ? { kind: "move", event: ev, before } : { kind: "receive", event: { ...ev, id: ev.id ?? "new" } }
        );
        if (verdict && verdict !== true) {
          notify(`${refusal(verdict.reason, verdict.conflicts)}: not saved`);
          return;
        }
      }
      if (ev.__seriesPatch) {
        const { __seriesPatch, id, ...patch } = ev;
        editEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
        notify("Series updated");
      } else if (ev.id) {
        editEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
        notify("Event saved");
      } else {
        editEvents((prev) => [...prev, { ...ev, id: newId() }]);
        notify("Event created");
      }
      setDraft(null);
    },
    // `refusal` is a pure helper defined in this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editEvents, notify, events]
  );
  const deleteEvent = useCallback(
    (id: string) => {
      editEvents((prev) => prev.filter((e) => e.id !== id));
      setDraft(null);
      notify("Event deleted");
    },
    [editEvents, notify]
  );

  /* --- drag & resize ----------------------------------------------------------- */
  const onEventChange = useCallback(
    (ev: any) => {
      if (ev.isRecurrenceInstance) {
        notify("Recurring events move as a series: open it to edit");
        return Promise.reject(new Error("recurring"));
      }
      // The calendar hands back the event in our own shape, with what
      // changed: times, resourceIds, or other fields (a task's progress).
      editEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, ...ev } : e)));
    },
    [editEvents, notify]
  );

  const onChangeRejected = useCallback(
    ({ reason, conflicts }: ChangeRejectedInfo) => notify(`${refusal(reason, conflicts)}: move refused`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify]
  );
  const undo = () => {
    if (apiRef.current?.canUndo()) apiRef.current.undo();
    else notify("Nothing to undo");
  };
  const redo = () => {
    if (apiRef.current?.canRedo()) apiRef.current.redo();
    else notify("Nothing to redo");
  };

  /* --- drag in from "To schedule" (ExternalDraggable) ------------------------ */
  const [pending, setPending] = useState<PendingItem[]>([
    { id: "p-1", title: "Follow-up — Ana", minutes: 30, category: "client" },
    { id: "p-2", title: "Write release notes", minutes: 90, category: "focus" },
    { id: "p-3", title: "Dentist", minutes: 60, category: "personal" },
  ]);
  const onEventReceive = useCallback(
    (event: any, data?: unknown) => {
      const item = data as PendingItem;
      // Dropped on a Team view column, `event.resourceIds` is that resource.
      editEvents((prev) => [...prev, { ...event, id: newId() }]);
      setPending((list) => list.filter((p) => p.id !== item.id));
      notify(`Scheduled “${item.title}”`);
    },
    [editEvents, notify]
  );

  const resetDemo = () => {
    write(EVENTS_KEY, null);
    edited.current = false;
    setEvents(createDemoEvents());
    setHidden(new Set());
    setActiveResources([]);
    apiRef.current?.today();
    notify("Fresh demo events around today");
  };

  /* --- plugins: AI quick add + exports --------------------------------------- */
  const plugins = useMemo<CalendarPlugin[]>(
    () => [
      createQuickAddPlugin({
        adapter: aiAdapter,
        onEventCreate: (event) =>
          editEvents((prev) => [...prev, { category: "meeting", color: categoryColor("meeting"), ...event }]),
      }),
      ...(exportsPlugin as unknown as CalendarPlugin[]),
      // Resources down the side, time across: timelineDay/Week/Month.
      ...timelinePlugins,
      // The project's tasks as a Gantt; moving a task pushes its successors.
      ...ganttPlugins,
    ],
    [editEvents]
  );

  /* --- branding: accent preset → --agendfy-* tokens (and the shell's accent) -- */
  const preset = accentPresets.find((p) => p.id === options.accent) ?? accentPresets[0];
  const tokens = theme === "dark" ? preset.dark : preset.light;
  const shellAccent =
    options.accent === "indigo"
      ? {}
      : {
          "--app-accent": tokens["--agendfy-color-accent"],
          "--app-accent-hover": tokens["--agendfy-color-accent-hover"],
          "--app-accent-soft": tokens["--agendfy-color-accent-soft"],
        };

  const rangeLabel = range
    ? new Intl.DateTimeFormat(options.lang, { month: "long", year: "numeric", timeZone: tz }).format(range.date)
    : "";

  return (
    <ErrorBoundary>
      {/* One drag context for the sidebar's "To schedule" list and the calendar. */}
      <AgendfyDndProvider>
      <div className="app" style={shellAccent as React.CSSProperties}>
        <header className="topbar">
          {page === "calendar" && (
          <button
            className="btn btn-ghost btn-icon topbar-menu"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-controls="demo-sidebar"
            aria-expanded={isDrawer() ? sidebarOpen : !sidebarCollapsed}
          >
            <Menu size={18} className="topbar-menu-drawer" />
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} className="topbar-menu-panel" />
            ) : (
              <PanelLeftClose size={18} className="topbar-menu-panel" />
            )}
          </button>
          )}
          <a className="brand" href="https://github.com/react-agendfy/react-agendfy" target="_blank" rel="noreferrer">
            <span className="brand-mark" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </span>
            React Agendfy
            <span className="brand-version">v{corePkg.version}</span>
          </a>
          <nav className="page-switch" aria-label="Demo pages">
            <a href="#/" aria-current={page === "calendar" ? "page" : undefined}>
              Calendar
            </a>
            <a href="#/gantt" aria-current={page === "gantt" ? "page" : undefined}>
              Gantt only
            </a>
          </nav>
          <nav className="topbar-links" aria-label="Project">
            <a href="https://github.com/react-agendfy/react-agendfy#readme" target="_blank" rel="noreferrer">
              <BookOpen size={15} /> Docs
            </a>
            <a href="https://www.npmjs.com/package/@react-agendfy/core" target="_blank" rel="noreferrer">
              <Package size={15} /> npm
            </a>
            <a
              href="https://github.com/react-agendfy/react-agendfy/tree/main/packages/fullcalendar-compat#readme"
              target="_blank"
              rel="noreferrer"
            >
              <ArrowRightLeft size={15} /> Coming from FullCalendar?
            </a>
          </nav>
          <span className="topbar-spacer" />
          {page === "calendar" && (
            <button className="btn btn-ghost" onClick={resetDemo} title="Fresh demo events around today">
              <RotateCcw size={15} /> <span className="hide-sm">Reset</span>
            </button>
          )}
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <a
            className="btn btn-icon"
            href="https://github.com/react-agendfy/react-agendfy"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <Github size={17} />
          </a>
        </header>

        {page === "gantt" ? (
          <div className="workspace is-collapsed">
            <GanttPage theme={theme} lang={options.lang} timeZone={tz} tokens={tokens} notify={notify} />
          </div>
        ) : (
        <div className={`workspace${sidebarCollapsed ? " is-collapsed" : ""}`}>
          {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
          <Sidebar
            pending={pending}
            open={sidebarOpen}
            events={events}
            visibleRange={range}
            onGotoDate={(d) => {
              apiRef.current?.gotoDate(d);
              setSidebarOpen(false);
            }}
            onNewEvent={() => {
              newAtNextHour();
              setSidebarOpen(false);
            }}
            hiddenCategories={hiddenCategories}
            onToggleCategory={(id) =>
              setHidden((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            activeResources={activeResources}
            onToggleResource={(id) =>
              setActiveResources((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
            options={options}
            onOptionsChange={updateOptions}
          />

          <main className="main">
            <div className="main-head">
              <div>
                <h1 style={{ textTransform: "capitalize" }}>{rangeLabel || "Calendar"}</h1>
                <div className="history-actions">
                  <button type="button" className="btn" onClick={undo} aria-label="Undo (Ctrl/⌘+Z)" title="Undo (Ctrl/⌘+Z)">
                    Undo
                  </button>
                  <button type="button" className="btn" onClick={redo} aria-label="Redo (Ctrl/⌘+Shift+Z)" title="Redo (Ctrl/⌘+Shift+Z)">
                    Redo
                  </button>
                </div>
                <p>
                  Drag, resize, select a range, or type “lunch tomorrow 1pm” in the quick add · {visibleEvents.length}{" "}
                  events{hiddenCategories.size || activeResources.length ? " (filtered)" : ""}
                </p>
              </div>
            </div>
            <section className="calendar-card demo-calendar" aria-label="Calendar">
              {/* Branding the documented way: tokens declared on the .agendfy
                  root, scoped with the `className` prop. */}
              <style>{`.agendfy.demo-cal { ${Object.entries(tokens)
                .map(([k, v]) => `${k}: ${v};`)
                .join(" ")} }`}</style>
              <Calendar
                className="demo-cal"
                apiRef={apiRef}
                events={visibleEvents}
                resources={resources}
                config={config}
                theme={theme}
                plugins={plugins}
                eventContent={renderEventContent}
                onEventClick={onEventClick}
                onDayClick={onDayClick}
                onSlotClick={onSlotClick}
                onDateRangeSelect={onSelect}
                onEventUpdate={onEventChange}
                onEventResize={onEventChange}
                onChangeRejected={onChangeRejected}
                onEventReceive={onEventReceive}
                onDatesSet={setRange}
              />
            </section>
          </main>
        </div>
        )}

        {page === "calendar" && (
        <button className="fab" onClick={() => setAiOpen(true)} aria-label="Open AI assistant">
          <Sparkles size={18} /> <span>Ask AI</span>
        </button>
        )}

        <AIDrawer
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          adapter={aiAdapter}
          events={events}
          timeZone={tz}
          hour12={options.hour12}
          onCreate={(drafts) => {
            editEvents((prev) => [
              ...prev,
              ...drafts.map((d) => ({ category: "meeting", color: categoryColor("meeting"), ...d, id: newId() })),
            ]);
            notify(`${drafts.length} event${drafts.length === 1 ? "" : "s"} added`);
          }}
          onUpdate={(ev) => {
            editEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
            notify("Event updated");
          }}
          onDelete={(id) => {
            editEvents((prev) => prev.filter((e) => e.id !== id));
            notify("Event deleted");
          }}
          onPickSlot={(start, end) => {
            setAiOpen(false);
            openNew(start, new Date(Math.min(Date.parse(end), Date.parse(start) + 3600000)));
          }}
        />

        <EventModal draft={draft} timeZone={tz} onClose={() => setDraft(null)} onSave={saveEvent} onDelete={deleteEvent} />

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
      </AgendfyDndProvider>
    </ErrorBoundary>
  );
}
