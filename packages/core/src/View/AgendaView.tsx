import React from 'react';
import { format, addDays, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { EventProps, ListViewProps } from '../types/types';
import { TZDate } from '@date-fns/tz';
import { getLocale } from '../Utils/locate';
import { formatMessage } from '../i18n';

const AgendaView: React.FC<ListViewProps> = ({
  events,
  config,
  currentDate = new TZDate(new Date(), config?.timeZone),
  onEventClick,
}) => {
  const agendaDays = 7;
  const startDate = startOfDay(new TZDate(currentDate, config?.timeZone));
  const endDate = endOfDay(addDays(startDate, agendaDays - 1));

  const relevantEvents = React.useMemo(() => {
    return events
      .filter(event => {
        const eventStart = startOfDay(new TZDate(parseISO(event.start.toString()), config?.timeZone));
        const eventEnd = endOfDay(new TZDate(parseISO(event.end.toString()), config?.timeZone));
        return isWithinInterval(startDate, { start: eventStart, end: eventEnd }) ||
               isWithinInterval(endDate, { start: eventStart, end: eventEnd }) ||
               (eventStart <= startDate && eventEnd >= endDate);
      })
      .sort((a, b) => parseISO(a.start.toString()).getTime() - parseISO(b.start.toString()).getTime());
  }, [events, startDate, endDate, config?.timeZone]);

  if (relevantEvents.length === 0) {
    return (
      <div className="react-agendfy-listview-empty">
        <p>
          {formatMessage(
            config?.agenda_no_events,
            { days: agendaDays },
            "There are no events for the next {days} days."
          )}
        </p>
      </div>
    );
  }

  const eventsByDay: Record<string, EventProps[]> = {};
  relevantEvents.forEach(event => {
    const dayKey = format(startOfDay(new TZDate(parseISO(event.start.toString()), config?.timeZone)), 'yyyy-MM-dd');
    if (!eventsByDay[dayKey]) {
      eventsByDay[dayKey] = [];
    }
    eventsByDay[dayKey].push(event);
  });

  const daysWithEvents = Object.keys(eventsByDay).sort();

  return (
    <div className="react-agendfy-agendaview-container">
      {daysWithEvents.map(dayKey => (
        <div key={dayKey} className="react-agendfy-agendaview-day">
          <h3 className="react-agendfy-agendaview-day-header">
            {format(parseISO(dayKey), 'EEEE, dd MMMM yyyy', { locale: getLocale(config?.lang ?? 'en') })}
          </h3>
          {eventsByDay[dayKey].map(event => (
            <div key={event.id} className="react-agendfy-agendaview-event" style={{ borderLeftColor: event.color }} onClick={() => onEventClick && onEventClick(event)}>
              <div className="react-agendfy-agendaview-event-time">{format(new TZDate(parseISO(event.start.toString()), config?.timeZone), 'HH:mm')}</div>
              <div className="react-agendfy-agendaview-event-title">{event.title}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default AgendaView;