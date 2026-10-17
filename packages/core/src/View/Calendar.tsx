import { forwardRef, lazy, Suspense, useCallback, useEffect, useRef } from "react";
import CalendarHeader from "../Components/CalendarHeader";
import { CalendarProps } from "../types/types";
import { ThemePlugin } from "../types/plugins";
import { CalendarProvider } from "../context/CalendarContext";
import useCalendarState from "../hooks/useCalendarState";
import { EventContentProvider } from "../context/EventContentContext";

const MonthView = lazy(() => import("./MonthView/MonthView"));
const WeekView = lazy(() => import("./WeekView/WeekView"));
const DayView = lazy(() => import("./DayView/DayView"));
const AgendaView = lazy(() => import("./AgendaView"));
const ListView = lazy(() => import("./ListView/ListView"));

/**
 * Presentational layer. All state, derived data and handlers come from the
 * CalendarContext (see CalendarProvider), so this component only wires the
 * header and the active view.
 */
const CalendarView = forwardRef<HTMLDivElement>((_props, ref) => {
  const {
    state,
    localeConfig,
    direction,
    theme,
    resources,
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
    onEventClick,
    onDayClick,
    onSlotClick,
    handleEventUpdate,
    handleEventResize,
    handleDateRangeSelect,
    handleViewChange,
    handleExport,
    navigate,
    canNavigateBack,
    canNavigateForward,
    eventContent,
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

  const renderViewComponent = () => {
    const CustomViewComponent = customViews[currentView];
    if (CustomViewComponent) {
      return (
        <CustomViewComponent
          events={visibleEvents}
          currentDate={currentDate}
          config={localeConfig}
          onEventUpdate={handleEventUpdate}
          onEventResize={handleEventResize}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
          onSlotClick={onSlotClick}
          resources={resources}
          filteredResources={state.localFilteredResources}
        />
      );
    }
    switch (currentView) {
      case "week":
        return (
          <WeekView
            events={visibleEvents}
            slotMin={localeConfig.slotMin}
            slotMax={localeConfig.slotMax}
            onEventUpdate={handleEventUpdate}
            onEventResize={handleEventResize}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            onSlotClick={onSlotClick}
            currentDate={currentDate}
            config={localeConfig}
            interactionPlugin={interactionPlugins}
            onDateRangeSelect={handleDateRangeSelect}
          />
        );
      case "month":
        return (
          <MonthView
            events={visibleEvents}
            onDayClick={onDayClick}
            currentDate={currentDate}
            onEventUpdate={handleEventUpdate}
            onEventResize={handleEventResize}
            showResourceView={true}
            config={localeConfig}
            onEventClick={onEventClick}
            onDateRangeSelect={handleDateRangeSelect}
          />
        );
      case "day":
        return (
          <DayView
            events={visibleEvents}
            currentDate={currentDate}
            onEventUpdate={handleEventUpdate}
            onSlotClick={onSlotClick}
            config={localeConfig}
            onEventClick={onEventClick}
          />
        );
      case "list":
        return (
          <ListView
            events={visibleEvents}
            onEventUpdate={handleEventUpdate}
            onEventClick={onEventClick}
            currentDate={currentDate}
            config={localeConfig}
          />
        );
      case "agenda":
        return (
          <AgendaView
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
    <div ref={setRootRef} dir={direction} className={`agendfy react-agendfy-layout theme-${theme}`}>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {`Current view: ${currentView}. Period: ${currentDate.toLocaleDateString(
          localeConfig.lang
        )}`}
        {isDataSourceLoading ? ` ${localeConfig.loading || "Loading events"}` : ""}
        {dataSourceError ? ` ${dataSourceError}` : ""}
      </div>
      <CalendarHeader
        currentDate={currentDate}
        currentView={currentView}
        availableViews={availableViews}
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
      <div className="react-agendfy-layout-content">
        <EventContentProvider eventContent={eventContent} plugins={eventRenderingPlugins}>
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
        </EventContentProvider>
      </div>
    </div>
  );
});
CalendarView.displayName = "CalendarView";

const Calendar = forwardRef<HTMLDivElement, CalendarProps>((props, ref) => (
  <CalendarProvider {...props}>
    <CalendarView ref={ref} />
  </CalendarProvider>
));
Calendar.displayName = "Calendar";

export default Calendar;
