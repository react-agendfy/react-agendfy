import { forwardRef, lazy, Suspense, useCallback, useEffect, useRef } from "react";
import CalendarHeader from "../Components/CalendarHeader";
import { CalendarProps } from "../types/types";
import { ThemePlugin } from "../types/plugins";
import { CalendarProvider } from "../context/CalendarContext";
import useCalendarState from "../hooks/useCalendarState";
import { EventContentProvider } from "../context/EventContentContext";
import { ClassNamesProvider } from "../context/ClassNamesContext";
import { InteractionProvider } from "../context/InteractionContext";
import { CustomViewDnd } from "../Components/CustomViewDnd";

const MonthView = lazy(() => import("./MonthView/MonthView"));
const WeekView = lazy(() => import("./WeekView/WeekView"));
const DayView = lazy(() => import("./DayView/DayView"));
const ListView = lazy(() => import("./ListView/ListView"));
const ResourceTimeGrid = lazy(() => import("./ResourceTimeGrid/ResourceTimeGrid"));

/**
 * Presentational layer. All state, derived data and handlers come from the
 * CalendarContext (see CalendarProvider), so this component only wires the
 * header and the active view.
 */
const CalendarView = forwardRef<HTMLDivElement, { className?: string }>(({ className }, ref) => {
  const {
    state,
    localeConfig,
    direction,
    theme,
    resources,
    visibleEvents,
    availableViews,
    viewItems,
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
    handleEventReceive,
    handleDateRangeSelect,
    handleViewChange,
    handleExport,
    navigate,
    canNavigateBack,
    canNavigateForward,
    eventContent,
    eventClassNames,
    dayCellClassNames,
    visibleRange,
    undo,
    redo,
  } = useCalendarState();

  const { currentDate, currentView } = state;

  // Scoped root element ref: theme + any theme-plugin css vars are applied
  // here (never on document.documentElement) so the library is multi-instance
  // safe and never leaks styles onto the host document. Merged with the
  // public forwarded ref below.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Force built-in light/dark via a scoped attribute (OS is the default).
    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }

    // Apply any matching theme-plugin css vars to THIS root only (scoped),
    // not to document.documentElement.
    const activeThemePlugin = themePlugins.find(
      (p: ThemePlugin) => p.themeName === theme
    );
    if (activeThemePlugin && activeThemePlugin.cssVariables) {
      Object.entries(activeThemePlugin.cssVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      return () => {
        Object.keys(activeThemePlugin.cssVariables!).forEach((key) => {
          root.style.removeProperty(key);
        });
      };
    }
  }, [theme, themePlugins]);

  // editable / eventStartEditable / eventDurationEditable / selectable:
  // a view without the handler renders that interaction off.
  const editable = localeConfig.editable !== false;
  const onMove = (localeConfig.eventStartEditable ?? editable) ? handleEventUpdate : undefined;
  const onResize = (localeConfig.eventDurationEditable ?? editable) ? handleEventResize : undefined;
  const onSelect = localeConfig.selectable !== false ? handleDateRangeSelect : undefined;

  // Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z and Ctrl+Y redo — not while typing.
  const undoShortcuts = localeConfig.undoShortcuts !== false;
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!undoShortcuts || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || (key === "y" && !e.metaKey)) {
        e.preventDefault();
        redo();
      }
    },
    [undoShortcuts, undo, redo]
  );

  const renderViewComponent = () => {
    const CustomViewComponent = customViews[currentView];
    if (CustomViewComponent) {
      // Custom views get drag & drop through useEventDraggable/useDropZone
      // and the rest of the calendar through useCalendarView(); the props
      // below are kept for views written before that API.
      return (
        <CustomViewDnd
          config={localeConfig}
          resources={resources}
          onEventUpdate={onMove}
          onEventReceive={handleEventReceive}
          onEventClick={onEventClick}
        >
        <CustomViewComponent
          events={visibleEvents}
          currentDate={currentDate}
          config={localeConfig}
          onEventUpdate={onMove}
          onEventResize={onResize}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
          onSlotClick={onSlotClick}
          resources={resources}
          filteredResources={state.localFilteredResources}
          range={visibleRange}
        />
        </CustomViewDnd>
      );
    }
    switch (currentView) {
      case "resourceDay":
      case "resourceWeek":
        // Built on the same SDK as custom views (useCalendarView, drop zones).
        return (
          <CustomViewDnd
            config={localeConfig}
            resources={resources}
            onEventUpdate={onMove}
            onEventReceive={handleEventReceive}
            onEventClick={onEventClick}
          >
            <ResourceTimeGrid span={currentView === "resourceDay" ? "day" : "week"} />
          </CustomViewDnd>
        );
      case "week":
        return (
          <WeekView
            events={visibleEvents}
            slotMin={localeConfig.slotMin}
            slotMax={localeConfig.slotMax}
            onEventUpdate={onMove}
            onEventReceive={handleEventReceive}
            onEventResize={onResize}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onSlotClick={onSlotClick}
            currentDate={currentDate}
            config={localeConfig}
            interactionPlugin={interactionPlugins}
            onDateRangeSelect={onSelect}
          />
        );
      case "month":
        return (
          <MonthView
            events={visibleEvents}
            onDayClick={onDayClick}
            currentDate={currentDate}
            onEventUpdate={onMove}
            onEventReceive={handleEventReceive}
            onEventResize={onResize}
            showResourceView={true}
            config={localeConfig}
            onEventClick={onEventClick}
            onDateRangeSelect={onSelect}
          />
        );
      case "day":
        return (
          <DayView
            events={visibleEvents}
            currentDate={currentDate}
            onEventUpdate={onMove}
            onEventReceive={handleEventReceive}
            onSlotClick={onSlotClick}
            config={localeConfig}
            onEventClick={onEventClick}
          />
        );
      case "list":
        return (
          <ListView
            events={visibleEvents}
            onEventUpdate={onMove}
            onEventClick={onEventClick}
            currentDate={currentDate}
            config={localeConfig}
          />
        );
      case "agenda":
        // The list view over the next 7 days.
        return (
          <ListView
            variant="agenda"
            events={visibleEvents}
            onEventClick={onEventClick}
            currentDate={currentDate}
            config={localeConfig}
          />
        );
      default:
        return <div>{`${localeConfig.unsupported_view || "Unsupported view"}: ${currentView}`}</div>;
    }
  };

  return (
    <div
      ref={setRootRef}
      dir={direction}
      className={`agendfy react-agendfy-layout theme-${theme}${
        currentView === "month" && localeConfig.dayMaxEvents === "fit" ? " react-agendfy-layout-fill" : ""
      }${className ? ` ${className}` : ""}`}
      data-view={currentView}
      onKeyDown={handleKeyDown}
    >
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {`Current view: ${currentView}. Period: ${currentDate.toLocaleDateString(
          localeConfig.lang
        )}`}
        {isDataSourceLoading ? ` ${localeConfig.loading || "Loading events"}` : ""}
        {dataSourceError ? ` ${dataSourceError}` : ""}
      </div>
      {localeConfig.showHeader !== false && (
      <CalendarHeader
        currentDate={currentDate}
        currentView={currentView}
        availableViews={availableViews}
        viewItems={viewItems}
        localeConfig={localeConfig}
        onViewChange={handleViewChange}
        onNavigate={navigate}
        headerLeftPlugins={headerLeftPlugins}
        headerRightPlugins={headerRightPlugins}
        exportOptions={localeConfig.export ? exportOptions : []}
        onExport={handleExport}
        isPrevDisabled={!canNavigateBack}
        isNextDisabled={!canNavigateForward}
      />
      )}
      <div className="react-agendfy-layout-content">
        <ClassNamesProvider eventClassNames={eventClassNames} dayCellClassNames={dayCellClassNames}>
        <EventContentProvider eventContent={eventContent} plugins={eventRenderingPlugins}>
          {/* One DndContext for every view (RFC 001, layer 2). */}
          <InteractionProvider>
          {/* Views are lazy chunks: the boundary keeps SSR (renderToString)
              and the first client render from throwing while they load. */}
          <Suspense
            fallback={
              <div className="react-agendfy-view-loading" role="status">
                {localeConfig.loading || "Loading"}
              </div>
            }
          >
            {renderViewComponent()}
          </Suspense>
          </InteractionProvider>
        </EventContentProvider>
        </ClassNamesProvider>
      </div>
    </div>
  );
});
CalendarView.displayName = "CalendarView";

const Calendar = forwardRef<HTMLDivElement, CalendarProps>((props, ref) => (
  <CalendarProvider {...props}>
    <CalendarView ref={ref} className={props.className} />
  </CalendarProvider>
));
Calendar.displayName = "Calendar";

export default Calendar;
