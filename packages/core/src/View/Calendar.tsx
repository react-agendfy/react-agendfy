import { forwardRef, lazy } from "react";
import CalendarHeader from "../Components/CalendarHeader";
import { CalendarProps } from "../types/types";
import { CalendarProvider } from "../context/CalendarContext";
import useCalendarState from "../hooks/useCalendarState";

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
    theme,
    resources,
    filteredEvents,
    availableViews,
    customViews,
    exportOptions,
    headerLeftPlugins,
    headerRightPlugins,
    interactionPlugins,
    eventRenderingPlugins,
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
  } = useCalendarState();

  const { currentDate, currentView } = state;

  const renderViewComponent = () => {
    const CustomViewComponent = customViews[currentView];
    if (CustomViewComponent) {
      return (
        <CustomViewComponent
          events={filteredEvents}
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
            events={filteredEvents}
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
            eventRenderingPlugins={eventRenderingPlugins}
          />
        );
      case "month":
        return (
          <MonthView
            events={filteredEvents}
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
            events={filteredEvents}
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
            events={filteredEvents}
            onEventUpdate={handleEventUpdate}
            onEventClick={onEventClick}
            currentDate={currentDate}
            config={localeConfig}
          />
        );
      case "agenda":
        return (
          <AgendaView
            events={filteredEvents}
            onEventClick={onEventClick}
            currentDate={currentDate}
            config={localeConfig}
          />
        );
      default:
        return <div>Unsupported view: {currentView}</div>;
    }
  };

  return (
    <div ref={ref} className={`react-agenfy-layout theme-${theme}`}>
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
      />
      <div className="react-agenfy-layout-content">{renderViewComponent()}</div>
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
