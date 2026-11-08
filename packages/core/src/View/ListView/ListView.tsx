import React from "react";
import { addDays, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { ListEvent } from "./Components/ListEvent";
import EventRow from "../../Components/EventRow";
import DayHeading from "../../Components/DayHeading";
import { EventProps, ListViewProps } from "../../types/types";
import { formatMessage } from "../../i18n";
import { getDayRules, resolveWeekStartsOn } from "../../Utils/calendarRange";

/*
 * The list and agenda views: events grouped by day, as a plain list.
 *
 * - "list" spans `listRange` (day, week or month — default month);
 * - "agenda" spans the next 7 days from the navigated date.
 *
 * An event shows under its start day, or under the first day of the range
 * when it started before it (a running multi-day event). It is not
 * virtualized on purpose: a period's events are a few hundred rows at most,
 * and the whole list stays reachable by find-in-page, printing and screen
 * readers.
 */

export const AGENDA_DAYS = 7;

const toMs = (value: Date | string) => new Date(value).getTime();

/** Midnight → noon of a "yyyy-MM-dd" day in the calendar zone (no offset can move it). */
const dayFromKey = (key: string, timeZone: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new TZDate(y, m - 1, d, 12, 0, timeZone);
};

const ListView: React.FC<ListViewProps & { variant?: "list" | "agenda" }> = ({
  events,
  onEventClick,
  config,
  currentDate = new TZDate(new Date(), config?.timeZone),
  variant = "list",
}) => {
  const timeZone = config?.timeZone || "UTC";
  const agenda = variant === "agenda";

  const { rangeStart, rangeEnd } = React.useMemo(() => {
    const anchor = new TZDate(currentDate, timeZone);
    if (agenda) return { rangeStart: startOfDay(anchor), rangeEnd: endOfDay(addDays(startOfDay(anchor), AGENDA_DAYS - 1)) };
    const range = config?.listRange ?? "month";
    if (range === "day") return { rangeStart: startOfDay(anchor), rangeEnd: endOfDay(anchor) };
    if (range === "week") {
      const weekStartsOn = resolveWeekStartsOn(config);
      return { rangeStart: startOfWeek(anchor, { weekStartsOn }), rangeEnd: endOfWeek(anchor, { weekStartsOn }) };
    }
    return { rangeStart: startOfMonth(anchor), rangeEnd: endOfMonth(anchor) };
  }, [currentDate, timeZone, agenda, config]);

  const days = React.useMemo(() => {
    const rules = getDayRules(config);
    const grouped = new Map<string, EventProps[]>();
    const from = rangeStart.getTime();
    const to = rangeEnd.getTime();
    for (const event of events) {
      // The event touches the range at all.
      if (toMs(event.end) < from || toMs(event.start) > to) continue;
      const start = new TZDate(toMs(event.start), timeZone);
      const day = start.getTime() < from ? rangeStart : startOfDay(start);
      if (rules.isHidden(day) || rules.isDisabled(day)) continue;
      const key = format(day, "yyyy-MM-dd");
      const list = grouped.get(key);
      if (list) list.push(event);
      else grouped.set(key, [event]);
    }
    // Chronological within each day, all-day events first.
    for (const list of grouped.values()) {
      list.sort((a, b) => Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) || toMs(a.start) - toMs(b.start));
    }
    return [...grouped.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [events, rangeStart, rangeEnd, timeZone, config]);

  if (days.length === 0) {
    return (
      <div className="react-agendfy-listview-empty">
        <p className="react-agendfy-listview-empty-text">
          {agenda
            ? formatMessage(config?.agenda_no_events, { days: AGENDA_DAYS }, "There are no events for the next {days} days.")
            : config?.no_events || "There are no events for this period."}
        </p>
      </div>
    );
  }

  if (agenda) {
    return (
      <div className="react-agendfy-agendaview-container">
        {days.map(([key, dayEvents]) => (
          <div key={key} className="react-agendfy-agendaview-day">
            <DayHeading day={dayFromKey(key, timeZone)} config={config} as="h3" />
            <div className="react-agendfy-agendaview-day-events">
              {dayEvents.map((event) => (
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
  }

  return (
    <div className="react-agendfy-listview-container">
      {days.map(([key, dayEvents]) => {
        const day = dayFromKey(key, timeZone);
        return (
          <div key={key} className="react-agendfy-listview-day-container">
            <div className="react-agendfy-listview-day-header-wrapper">
              <DayHeading day={day} config={config} />
            </div>
            <div className="react-agendfy-listview-day-events">
              {dayEvents.map((event, index) => (
                <ListEvent key={`${event.id}-${index}`} event={event} onEventClick={onEventClick} currentDate={day} config={config} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ListView;
