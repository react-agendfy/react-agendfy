// CalendarDay.tsx
import React, { useRef, useEffect, useState, memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  isSameDay,
  isWithinInterval,
  startOfDay,
  endOfDay,
  addMilliseconds,
  isSameMonth,
} from "date-fns";
import { TZDate } from "@date-fns/tz";
import { ensureDate } from "../../../Utils/DateTrannforms";
import { CalendarDayProps } from "../../../types/types";
import { EventItem } from "./EventItem";

const MAX_VISIBLE = 3;

const CalendarDayMemo: React.FC<CalendarDayProps> = ({
  day,
  events = [],
  onDayClick,
  onEventClick, 
  onEventResize,
  config,
  onMouseDown,
  onMouseMove,
  isSelected,
  monthDate,
  navProps,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { setNodeRef, isOver } = useDroppable({
    id: day?.toISOString() || "empty",
    disabled: !day,
  });

  useEffect(() => {
    if (ref.current) setWidth(ref.current.offsetWidth);
  }, [day]);

  if (!day) {
    return <div className="react-agendfy-calendar-day-empty" role="gridcell" aria-disabled="true" />;
  }

  const dayEvents = events.filter((e) => {
    try {
      const eventStart = ensureDate(e.start, config?.timeZone);
      const eventEnd = addMilliseconds(ensureDate(e.end, config?.timeZone), 1);
      return isWithinInterval(day, {
        start: startOfDay(eventStart),
        end: endOfDay(eventEnd),
      }); 
    } catch (error) {
      console.error("Erro ao filtrar evento:", error, e);
      return false;
    }
  });

  const sorted = [...dayEvents].sort((a, b) => {
    const timeA = ensureDate(a.start, config?.timeZone).getTime();
    const timeB = ensureDate(b.start, config?.timeZone).getTime();
    if (timeA !== timeB) return timeA - timeB;

    const durA = ensureDate(a.end, config?.timeZone).getTime() - timeA;
    const durB = ensureDate(b.end, config?.timeZone).getTime() - timeB;
    return durB - durA;
  });

  const visible = sorted.slice(0, MAX_VISIBLE);
  const hidden = Math.max(0, sorted.length - MAX_VISIBLE);
  const isToday = isSameDay(day, new TZDate(new Date(), config?.timeZone)); 
  const isOtherMonth = monthDate && !isSameMonth(day, monthDate);

  const classes = [
    "react-agendfy-calendar-day",
    isToday && "react-agendfy-calendar-day-today",
    isOver && "react-agendfy-calendar-day-droppable-over",
    isSelected && "react-agendfy-calendar-day-selected",
    isOtherMonth && "react-agendfy-calendar-day-other-month",
  ].filter(Boolean).join(" ");

  const handleDayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.react-agendfy-event-item') === null) {
      e.stopPropagation();
      onDayClick?.(day);
    }
  };

  return (
    <div
      ref={(el) => {
        ref.current = el;
        setNodeRef(el);
        navProps?.setRef(el);
      }}
      className={classes}
      onClick={handleDayClick}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.react-agendfy-event-item') === null) {
          onMouseDown?.(day);
        } else {
          e.stopPropagation();
        }
      }}
      onMouseMove={() => onMouseMove?.(day)}
      onKeyDown={
        navProps
          ? navProps.onKeyDown
          : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick?.(day); } }
      }
      onFocus={navProps?.onFocus}
      role="gridcell"
      tabIndex={navProps ? navProps.tabIndex : 0}
      aria-label={format(day, "d MMMM yyyy")}
      aria-selected={isSelected ? true : undefined}
      aria-current={isToday ? "date" : undefined}
    >
      <div className="react-agendfy-calendar-day-header">
        <span className={`react-agendfy-day-number ${isToday ? "react-agendfy-day-number-today" : ""} ${isOtherMonth ? "react-agendfy-day-number-other-month" : ""}`}>
          {format(day, "d")}
        </span>
        {hidden > 0 && (
          <span
            className="react-agendfy-hidden-events"
            onClick={(e) => {
              e.stopPropagation();
              const list = sorted.slice(MAX_VISIBLE).map((ev) =>
                `${ev.title} (${format(ensureDate(ev.start, config?.timeZone), "HH:mm")} - ${format(ensureDate(ev.end, config?.timeZone), "HH:mm")})`
              ).join("\n");
              alert(`+${hidden} eventos:\n${list}`);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).click();
              }
            }}
            aria-label={`+${hidden} eventos ocultos`}
          >
            +{hidden}
          </span>
        )}
      </div>
      <div className="react-agendfy-day-events">
        {visible.map((event) => {
          const s = ensureDate(event.start, config?.timeZone);
          const e = ensureDate(event.end, config?.timeZone);

          const isEventStart = isSameDay(s, day);
          const isEventEnd = isSameDay(e, day) || (e.getHours() === 0 && e.getMinutes() === 0 && e.getSeconds() === 0 && isSameDay(addMilliseconds(e, 1), day));

          return (
            <EventItem
              key={`${event.id}-${day.toISOString()}`}
              event={event} 
              isStart={isEventStart}
              isEnd={isEventEnd}
              isMultiDay={event.isMultiDay || !isSameDay(s, e)}
              onEventClick={onEventClick}
              onEventResize={onEventResize}
              config={config}
              dayWidth={width}
              isOtherMonth={isOtherMonth}
            />
          );
        })}
      </div>
    </div>
  );
};

export const CalendarDay = memo(CalendarDayMemo); 