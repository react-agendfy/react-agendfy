import React from 'react';
import { List, RowComponentProps, useDynamicRowHeight } from "react-window";
import {
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { TZDate } from "@date-fns/tz";
import { ListEvent } from "./Components/ListEvent";
import { EventProps, ListViewProps } from "../../types/types";
import { getLocale } from "../../Utils/locate";
import { getDayRules } from "../../Utils/calendarRange";

interface ListRowData {
  daysWithEvents: Date[];
  eventsByDay: Record<string, EventProps[]>;
  onEventClick?: (event: EventProps) => void;
  config?: any;
}

const RowComponent = ({
  index,
  style,
  daysWithEvents,
  eventsByDay,
  onEventClick,
  config,
}: RowComponentProps<ListRowData>): React.ReactElement => {
  const day = daysWithEvents[index];
  const dayKey = format(day, "yyyy-MM-dd");
  const dayEvents = eventsByDay[dayKey] || [];

  const ref = React.useRef<HTMLDivElement>(null);
  
  
  return (
    <div 
      ref={ref} 
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
      }} 
      className="react-agendfy-listview-day-container"
    >
      <div className="react-agendfy-listview-day-header-wrapper">
        <h2 className="react-agendfy-listview-day-header">
          {format(new TZDate(day, config?.timeZone), "EEEE, dd MMMM", {
            locale: getLocale(config?.lang),
          })}
        </h2>
      </div>
      <div className="react-agendfy-listview-day-events">
        {dayEvents.map((event: EventProps, idx: number) => (
          <ListEvent
            key={`${event.id}-${idx}`}
            event={event}
            onEventClick={onEventClick}
            currentDate={day}
            config={config}
          />
        ))}
      </div>
    </div>
  );
};

const ListView: React.FC<ListViewProps> = ({
  events,
  onEventClick,
  config,
  currentDate = new TZDate(new Date(), config?.timeZone),
}) => {
  const monthStart = startOfMonth(new TZDate(currentDate, config?.timeZone || 'UTC'));
  const monthEnd = endOfMonth(new TZDate(currentDate, config?.timeZone || 'UTC'));

const rowHeight = useDynamicRowHeight({
defaultRowHeight: 10
});  
  const days = React.useMemo(() => {
    const dayList: Date[] = [];
    let day = monthStart;
    const rules = getDayRules(config);
    while (day <= monthEnd) {
      if (!rules.isHidden(day) && !rules.isDisabled(day)) dayList.push(day);
      day = addDays(day, 1);
    }
    return dayList;
  }, [monthStart, monthEnd, config]);

  const eventsByDay = React.useMemo(() => {
    const grouped: Record<string, EventProps[]> = {};
    
    days.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      grouped[dayKey] = [];
    });

    events.forEach((event: EventProps) => {
      const eventStartDate = startOfDay(new TZDate(parseISO(event.start.toString()), config?.timeZone));
      const dayKey = format(eventStartDate, "yyyy-MM-dd");

      if (grouped[dayKey]) {
        grouped[dayKey].push(event);
      }
    });

    return grouped;
  }, [days, events, config?.timeZone]);

  const daysWithEvents = React.useMemo(() => {
    return days.filter((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      return eventsByDay[dayKey] && eventsByDay[dayKey].length > 0;
    });
  }, [days, eventsByDay]);

  if (daysWithEvents.length === 0) {
    return (
      <div className="react-agendfy-listview-empty">
        <p className="react-agendfy-listview-empty-text">
          {config?.no_events || "There are no events for this period."}
        </p>
      </div>
    );
  }

  return (
    <div className="react-agendfy-listview-container">
      <List
        rowComponent={RowComponent}
        rowCount={daysWithEvents.length}
        rowHeight={rowHeight}
        rowProps={{
          daysWithEvents,
          eventsByDay,
          onEventClick,
          config,
        }}
         style={{ width: "100%" }}
      />
    </div>
  );
};

export default ListView;