import React from "react";
import { TZDate } from "@date-fns/tz";
import { differenceInMinutes, parseISO } from "date-fns";
import type { Config, EventProps } from "../types/types";
import { useEventContent } from "../context/EventContentContext";
import { cx, publicEventId, useEventClassNames } from "../context/ClassNamesContext";
import { formatEventTime } from "../Utils/displayOptions";
import generateTooltipContent from "../Utils/generateTooltipContent";
import ResourceDisplay from "./Resource/ResourceDisplay";

/*
 * One event as a row — the list and agenda views share it (FullCalendar /
 * Google Calendar list style): time column, colour dot, title. The event's
 * colour marks the dot instead of filling the row, so text stays readable
 * on any colour (and an event without a colour no longer vanishes).
 */

const parse = (value: Date | string) => (value instanceof Date ? value : parseISO(String(value)));

/** All-day, or a timed span of 24h+ (a "banner" event). */
const isAllDay = (event: EventProps, timeZone?: string) => {
  if (event.allDay) return true;
  const start = new TZDate(parse(event.start), timeZone);
  const end = new TZDate(parse(event.end), timeZone);
  return differenceInMinutes(end, start) >= 24 * 60 && start.getHours() === 0 && start.getMinutes() === 0;
};

export interface EventRowProps {
  event: EventProps;
  config?: Partial<Config>;
  view: "list" | "agenda";
  onEventClick?: (event: EventProps) => void;
  /** Extra class (keeps the views' historical class names stable). */
  className?: string;
  testId?: string;
}

const EventRow = ({ event, config, view, onEventClick, className = "", testId }: EventRowProps) => {
  const allDay = isAllDay(event, config?.timeZone);
  const startLabel = formatEventTime(parse(event.start), config);
  const endLabel = formatEventTime(parse(event.end), config);
  const timeText = allDay ? config?.all_day || "All day" : `${startLabel} - ${endLabel}`;
  const customContent = useEventContent(event, view, { config });
  const extraClassNames = useEventClassNames(event, view);
  const activate = () => onEventClick?.(event);

  return (
    <div
      data-testid={testId}
      className={cx("react-agendfy-event-row", className, extraClassNames)}
      data-event-id={publicEventId(event)}
      data-all-day={allDay || undefined}
      style={{ "--agendfy-event-color": event.color || "var(--agendfy-color-accent)" } as React.CSSProperties}
      title={generateTooltipContent(event, false, true, true, config)}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${event.title}, ${allDay ? timeText : `${startLabel} - ${endLabel}`}`}
    >
      <span className="react-agendfy-event-row-time">{timeText}</span>
      <span className="react-agendfy-event-row-dot" aria-hidden="true" />
      <span className="react-agendfy-event-row-body">
        {customContent ?? (
          <>
            <span className="react-agendfy-event-row-title">
              {event.title || config?.untitled_event || "Event"}
            </span>
            <ResourceDisplay resources={event.resources} maxVisible={3} />
          </>
        )}
      </span>
    </div>
  );
};

export default EventRow;
