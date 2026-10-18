import React from 'react';
import { format, addDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { EventProps, ListViewProps } from '../types/types';
import { TZDate } from '@date-fns/tz';
import { formatMessage } from '../i18n';
import { getDayRules } from '../Utils/calendarRange';
import EventRow from '../Components/EventRow';
import DayHeading from '../Components/DayHeading';

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
    const rules = getDayRules(config);
    return events
      .filter(event => {
        // Overlap test: the event touches [startDate, endDate] at all.
        const eventStart = new TZDate(parseISO(event.start.toString()), config?.timeZone);
        const eventEnd = new TZDate(parseISO(event.end.toString()), config?.timeZone);
        if (eventEnd < startDate || eventStart > endDate) return false;
        // Grouped under its start day — drop it when that day is hidden/disabled.
        const day = eventStart < startDate ? startDate : startOfDay(eventStart);
        return !rules.isHidden(day) && !rules.isDisabled(day);
      })
      .sort((a, b) => parseISO(a.start.toString()).getTime() - parseISO(b.start.toString()).getTime());
  }, [events, startDate, endDate, config]);

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
    const eventStart = startOfDay(new TZDate(parseISO(event.start.toString()), config?.timeZone));
    // Events that started before the window are listed on its first day.
    const dayKey = format(eventStart < startDate ? startDate : eventStart, 'yyyy-MM-dd');
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
          {/* dayKey is a day in the calendar time zone: rebuild it there (at
              noon, so no offset can move it to the next/previous day). */}
          <DayHeading
            day={(() => {
              const [y, m, d] = dayKey.split('-').map(Number);
              return new TZDate(y, m - 1, d, 12, 0, config?.timeZone);
            })()}
            config={config}
            as="h3"
          />
          <div className="react-agendfy-agendaview-day-events">
          {eventsByDay[dayKey].map(event => (
            <EventRow
              key={event.id}
              event={event}
              config={config}
              view="agenda"
              onEventClick={onEventClick}
              className="react-agendfy-agendaview-event"
            />
          ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgendaView;