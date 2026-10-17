// CalendarDay.tsx
import React, { useRef, useEffect, useState, memo } from "react";
import { formatEventTime, resolveDayMaxEvents } from "../../../Utils/displayOptions";
import { getLocale } from "../../../Utils/locate";
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
import { formatMessage } from "../../../i18n";
import { CalendarDayProps } from "../../../types/types";
import { EventItem } from "./EventItem";

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
  rowDays,
  isDisabled = false,
  weekNumber,
  canDrag = true,
}) => {
  // "+N" popover. position: fixed (from the cell's rect) escapes the month
  // grid's overflow: hidden while staying inside the calendar root, so the
  // theme variables still apply. It closes on scroll instead of drifting.
  const [morePos, setMorePos] = useState<{ top: number; left: number; width: number } | null>(null);
  const showMore = morePos !== null;
  const closeMore = () => setMorePos(null);
  const toggleMore = (anchor: HTMLElement) => {
    if (morePos) return closeMore();
    const cell = anchor.closest(".react-agendfy-calendar-day") ?? anchor;
    const rect = cell.getBoundingClientRect();
    const width = Math.max(rect.width + 24, 220);
    const left = Math.min(Math.max(8, rect.left - 12), window.innerWidth - width - 8);
    setMorePos({ top: Math.max(8, rect.top - 4), left, width });
  };
  const moreRef = useRef<HTMLDivElement>(null);

  // Close the "+N" popover on outside click / Escape.
  useEffect(() => {
    if (!showMore) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMorePos(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMorePos(null);
    const onScroll = (e: Event) => {
      if (moreRef.current && moreRef.current.contains(e.target as Node)) return;
      setMorePos(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [showMore]);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { setNodeRef, isOver } = useDroppable({
    id: day?.toISOString() || "empty",
    disabled: !day || isDisabled,
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

  const maxVisible = resolveDayMaxEvents(config);
  const visible = sorted.slice(0, maxVisible);
  const hidden = Math.max(0, sorted.length - maxVisible);
  const isToday = isSameDay(day, new TZDate(new Date(), config?.timeZone)); 
  const isOtherMonth = monthDate && !isSameMonth(day, monthDate);

  const classes = [
    "react-agendfy-calendar-day",
    isToday && "react-agendfy-calendar-day-today",
    isOver && "react-agendfy-calendar-day-droppable-over",
    isSelected && "react-agendfy-calendar-day-selected",
    isOtherMonth && "react-agendfy-calendar-day-other-month",
    isDisabled && "react-agendfy-day-disabled",
  ].filter(Boolean).join(" ");

  const handleDayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.react-agendfy-event-item') === null) {
      e.stopPropagation();
      onDayClick?.(day);
    }
  };

  const popover = morePos && (
    <div
      ref={moreRef}
      className="react-agendfy-more-popover"
      style={{ top: morePos.top, left: morePos.left, width: morePos.width }}
      role="dialog"
      aria-label={format(day, "d MMMM yyyy", { locale: getLocale(config?.lang) })}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="react-agendfy-more-popover-header">
        <span>{format(day, "EEEE, d MMMM", { locale: getLocale(config?.lang) })}</span>
        <button
          type="button"
          className="react-agendfy-more-popover-close"
          aria-label={config?.close || "Close"}
          onClick={closeMore}
        >
          ×
        </button>
      </div>
      <ul className="react-agendfy-more-popover-list">
        {sorted.map((ev) => (
          <li key={`${ev.id}-more`}>
            <button
              type="button"
              className="react-agendfy-more-popover-item"
              style={{ borderInlineStartColor: ev.color || "#3490dc" }}
              onClick={() => {
                closeMore();
                onEventClick?.(ev);
              }}
            >
              <span className="react-agendfy-more-popover-time">
                {formatEventTime(ensureDate(ev.start, config?.timeZone), config)}
              </span>
              <span className="react-agendfy-more-popover-title">{ev.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

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
        const target = e.target as HTMLElement;
        // Never start day-range selection from an event chip OR a resize
        // handle (re-resizable renders handles as SIBLINGS of the chip, so
        // the chip-only check missed them and a resize gesture could also
        // trigger range selection).
        const isInteractive =
          target.closest('.react-agendfy-event-item') !== null ||
          target.closest('.react-agendfy-month-resize-handle') !== null;
        if (e.target === e.currentTarget || !isInteractive) {
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
      aria-disabled={isDisabled || undefined}
    >
      <div className="react-agendfy-calendar-day-header">
        <span className={`react-agendfy-day-number ${isToday ? "react-agendfy-day-number-today" : ""} ${isOtherMonth ? "react-agendfy-day-number-other-month" : ""}`}>
          {format(day, "d")}
        </span>
        {weekNumber !== undefined && (
          <span className="react-agendfy-week-number" aria-hidden="true">
            {`${config?.week_number_label ?? "W"}${weekNumber}`}
          </span>
        )}
        {hidden > 0 && (
          <span
            className="react-agendfy-hidden-events"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleMore(e.currentTarget);
            }}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-expanded={showMore}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggleMore(e.currentTarget);
              }
            }}
            aria-label={formatMessage(config?.hidden_events, { count: hidden }, "+{count} eventos ocultos")}
          >
            {formatMessage(config?.more_events, { count: hidden }, "+{count}")}
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
              cellDate={day}
              rowDays={rowDays}
              canDrag={canDrag}
              onEventClick={onEventClick}
              onEventResize={onEventResize}
              config={config}
              dayWidth={width}
              isOtherMonth={isOtherMonth}
            />
          );
        })}
      </div>
      {popover}
    </div>
  );
};

export const CalendarDay = memo(CalendarDayMemo); 