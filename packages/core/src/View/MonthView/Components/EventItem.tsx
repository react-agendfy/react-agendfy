// EventItem.tsx — month-view event chip / multiday row bar.
//
// Multiday rendering (professional-calendar semantics, Google-style):
// each WEEK ROW gets one continuous bar. The piece rendered in the cell that
// starts the bar for its row (the event's start cell, or the first cell of a
// row the event continues into) is VISIBLE and stretched across the row with
// `calc(N * 100% + (N-1) * gap)` — percentage-based, so cell borders and
// paddings are bridged exactly (the old pixel math `N * offsetWidth` dropped
// 1px per border and produced seams/gaps). The pieces underneath on the
// covered cells stay INVISIBLE but interactive: they carry the drag surface
// and the end-cell resize handle.
import React, { memo, useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { format, addDays, isSameDay, startOfDay, startOfWeek, subMilliseconds } from 'date-fns';
import { resolveWeekStartsOn } from '../../../Utils/calendarRange';
import { Resizable } from "re-resizable";
import { TZDate } from '@date-fns/tz';
import { ensureDate } from '../../../Utils/DateTrannforms';
import ResourceDisplay from '../../../Components/Resource/ResourceDisplay';
import { BaseEventProps } from '../../../types/types';
import { getContrastText } from '../../../Utils/colorContrast';
import { useEventContent } from '../../../context/EventContentContext';
import { publicEventId, useEventClassNames } from '../../../context/ClassNamesContext';
import { formatEventTime } from '../../../Utils/displayOptions';
import './EventItem.css';

interface EventItemProps extends Omit<BaseEventProps, 'onEventResize'> {
  dayWidth: number;
  isPreview?: boolean;
  isStart: boolean;
  onEventResize?: (status: 'start' | 'stop', event?: BaseEventProps['event']) => void;
  isEnd: boolean;
  /** The calendar day this cell renders (drives row-bar geometry). */
  cellDate?: Date;
  /** Rendered (non-hidden) days of this cell's week row, in display order. */
  rowDays?: Date[];
  /** Dragging allowed (the view has a move handler). Default true. */
  canDrag?: boolean;
}

const EventItemMemo: React.FC<EventItemProps & { dayWidth: number; isOtherMonth?: boolean }> = ({
  event,
  isStart,
  isEnd,
  isPreview = false,
  onEventClick,
  config,
  dayWidth,
  onEventResize,
  isOtherMonth = false,
  cellDate,
  rowDays,
  canDrag: canDragProp = true,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const CHIP_HEIGHT = 20;

  const tzStart = useMemo(() => ensureDate(event.start, config?.timeZone), [event.start, config?.timeZone]);
  const tzEnd = useMemo(() => ensureDate(event.end, config?.timeZone), [event.end, config?.timeZone]);

  // An end at exactly midnight belongs visually to the previous day.
  const visualEnd = useMemo(() => {
    const isMidnight =
      tzEnd.getHours() === 0 && tzEnd.getMinutes() === 0 &&
      tzEnd.getSeconds() === 0 && tzEnd.getMilliseconds() === 0;
    return isMidnight ? subMilliseconds(tzEnd, 1) : tzEnd;
  }, [tzEnd]);

  const spansDays = useMemo(() => !isSameDay(tzStart, visualEnd), [tzStart, visualEnd]);

  // --- Row-bar geometry -----------------------------------------------------
  const pieceDate = cellDate ?? tzStart;
  const { isVisiblePiece, stretchN, roundStart, roundEnd } = useMemo(() => {
    if (!spansDays) {
      return { isVisiblePiece: true, stretchN: 1, roundStart: true, roundEnd: true };
    }
    const cell = startOfDay(new TZDate(pieceDate, config?.timeZone));
    // Geometry runs over the row's RENDERED columns: hidden weekdays take no
    // space, so the bar stretches over visible cells only.
    // Without rowDays (standalone use) assume a full 7-day row.
    const row =
      rowDays && rowDays.length > 0
        ? rowDays
        : Array.from({ length: 7 }, (_, i) =>
            addDays(startOfWeek(cell, { weekStartsOn: resolveWeekStartsOn(config) }), i)
          );
    const col = Math.max(0, row.findIndex((d) => isSameDay(d, cell)));
    const endDay = startOfDay(visualEnd);
    const coveredAhead = row.slice(col).filter((d) => d.getTime() <= endDay.getTime()).length;
    // The visible piece is the first covered cell of the row — the event's
    // start cell, or the first rendered cell it continues into (which is not
    // necessarily column 0 when the start falls on a hidden day).
    const startDay = startOfDay(tzStart);
    const isFirstCovered = col === 0 || row[col - 1].getTime() < startDay.getTime();
    const visible = isStart || isFirstCovered;
    const n = Math.max(1, coveredAhead);
    const lastRowDay = row[row.length - 1];
    return {
      isVisiblePiece: visible,
      stretchN: visible ? n : 1,
      roundStart: isStart,
      roundEnd: endDay.getTime() <= lastRowDay.getTime(),
    };
  }, [spansDays, pieceDate, config, visualEnd, isStart, rowDays, tzStart]);

  // Percentage-based stretch bridges cell paddings + borders exactly.
  // --agendfy-month-day-gap = 2 * cell padding + cell border (see MonthView.css).
  const barWidth =
    isVisiblePiece && stretchN > 1
      ? `calc(${stretchN * 100}% + ${stretchN - 1} * var(--agendfy-month-day-gap, 17px))`
      : '100%';

  const draggableEnabled = canDragProp && (!spansDays || (isStart || isEnd));
  const canDrag = draggableEnabled;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${event.id}-${isStart ? 'start' : isEnd ? 'end' : 'middle'}`,
    data: { event, isStart, isEnd },
    disabled: !draggableEnabled || isResizing,
  });

  const enableResizing = Boolean(onEventResize) && !isOtherMonth && (isEnd || !spansDays);

  // All-day (explicit, or midnight-to-midnight): no "00:00" on the chip.
  const isAllDayEvent = useMemo(() => {
    if (event.allDay || event.isAllDay) return true;
    const midnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
    return midnight(tzStart) && midnight(tzEnd) && tzEnd.getTime() > tzStart.getTime();
  }, [event.allDay, event.isAllDay, tzStart, tzEnd]);
  const startTime = useMemo(() => formatEventTime(tzStart, config), [tzStart, config]);
  const endTime = useMemo(() => formatEventTime(tzEnd, config), [tzEnd, config]);

  const showContent = isVisiblePiece;
  const customContent = useEventContent(event, 'month', {
    config,
    isStart,
    isEnd,
  });

  const extraClassNames = useEventClassNames(event, 'month');
  const className = [
    'react-agendfy-event-item',
    isDragging && 'react-agendfy-event-item-dragging',
    isPreview && 'react-agendfy-event-item-preview',
    spansDays && isStart && 'react-agendfy-event-item-multiday-start',
    spansDays && isEnd && 'react-agendfy-event-item-multiday-end',
    spansDays && !isStart && !isEnd && 'react-agendfy-event-item-multiday-middle',
    extraClassNames,
  ].filter(Boolean).join(' ');

  const radius = 'var(--agendfy-event-radius)';
  const cornerStyle: React.CSSProperties = spansDays
    ? {
        borderStartStartRadius: roundStart ? radius : 0,
        borderEndStartRadius: roundStart ? radius : 0,
        borderStartEndRadius: roundEnd ? radius : 0,
        borderEndEndRadius: roundEnd ? radius : 0,
      }
    : {};

  // No event colour: the themeable default (--agendfy-color-event-default).
  const background = event.color || 'var(--agendfy-color-event-default, #3490dc)';
  const foreground = event.color
    ? getContrastText(event.color)
    : 'var(--agendfy-color-event-default-fg, #ffffff)';

  return (
    // The stretch lives on OUR wrapper, not on re-resizable: its `size` prop
    // overrides `style` width, and it appends "px" to any string it does not
    // recognize as unit-suffixed — turning `calc(...)` into invalid CSS that
    // browsers silently drop (the bar then collapses to one cell).
    <div className="react-agendfy-month-bar" style={{ width: barWidth }}>
    <Resizable
      size={{ width: '100%', height: CHIP_HEIGHT }}
      onResizeStart={(e) => {
        e.stopPropagation();
        setIsResizing(true);
        onEventResize?.('start');
      }}
      onResizeStop={(e, dir, ref, d) => {
        setIsResizing(false);
        // Day step from the measured cell width; fall back to the DOM when
        // the measured width hasn't landed yet. Never divide by zero.
        const cellWidth =
          dayWidth > 0 ? dayWidth : (ref?.parentElement as HTMLElement | null)?.offsetWidth || 0;
        const daysDelta = cellWidth > 0 ? Math.round(d.width / cellWidth) : 0;
        if (daysDelta === 0) {
          // Always complete the start/stop handshake so MonthView clears
          // its isResizing gate, but emit no update.
          onEventResize?.('stop');
          return;
        }
        const newEnd = addDays(tzEnd, daysDelta); // negative delta shrinks
        if (newEnd.getTime() <= tzStart.getTime()) {
          onEventResize?.('stop');
          return;
        }
        onEventResize?.('stop', {
          ...event,
          end: new Date(newEnd.getTime()).toISOString(),
          isMultiDay: !isSameDay(tzStart, newEnd),
        });
      }}
      enable={{ right: enableResizing }}
      // Wrapper class so CSS can reveal the grip on chip hover — re-resizable
      // nests handles inside their own wrapper (NOT siblings of the chip), so
      // a sibling combinator can never reach them; a descendant selector from
      // this wrapper can.
      className="react-agendfy-month-event-resizable"
      handleClasses={{ right: 'react-agendfy-month-resize-handle' }}
      handleStyles={{ right: { cursor: 'ew-resize', width: '8px', right: '-2px' } }}
      style={{
        zIndex: isDragging || isResizing ? 1000 : 'auto',
      }}
    >
      <div
        ref={setNodeRef}
        className={className}
        style={{
          backgroundColor: isVisiblePiece ? background : 'transparent',
          color: isVisiblePiece ? foreground : 'transparent',
          // Shadows paint around transparent boxes too — an invisible piece
          // must not cast a ghost bar over the stretched row bar beneath it.
          boxShadow: isVisiblePiece ? undefined : 'none',
          cursor: canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.7 : 1,
          width: '100%',
          height: '100%',
          ...cornerStyle,
        }}
        title={isVisiblePiece ? event.title : undefined}
        data-event-id={publicEventId(event)}
        onClick={(e) => {
          e.stopPropagation();
          if (!isResizing) {
            onEventClick?.(event);
          }
        }}
        {...(canDrag ? listeners : {})}
        {...(canDrag ? attributes : {})}
        // Invisible overlay pieces stay interactive for mouse (drag surface,
        // resize handle host) but must not duplicate the event for keyboard
        // and screen-reader users — the visible bar piece is the single
        // accessible entity.
        role={isVisiblePiece ? 'button' : undefined}
        tabIndex={isVisiblePiece ? 0 : -1}
        aria-hidden={isVisiblePiece ? undefined : true}
        aria-label={
          isVisiblePiece
            ? `${event.title}, ${isAllDayEvent ? config?.all_day || 'All day' : `${startTime} - ${endTime}`}`
            : undefined
        }
        onKeyDown={(e: React.KeyboardEvent) => {
          if (!isVisiblePiece) return;
          if (e.key === 'Enter') {
            // Enter activates the event (click); Space is left to dnd-kit's
            // KeyboardSensor so keyboard drags stay available on draggables.
            e.preventDefault();
            e.stopPropagation();
            if (!isResizing) onEventClick?.(event);
            return;
          }
          if (e.key === ' ' && !canDrag) {
            e.preventDefault();
            e.stopPropagation();
            if (!isResizing) onEventClick?.(event);
            return;
          }
          if (canDrag) (listeners as any)?.onKeyDown?.(e);
        }}
      >
        {showContent && customContent}
        {showContent && !customContent && (
          <>
            <div className="react-agendfy-event-item-content">
              <span>{event.title}</span>
              {!isAllDayEvent && <span>{startTime}</span>}
            </div>
            {event.resources?.length > 0 && (
              <div className="react-agendfy-event-item-resources">
                <ResourceDisplay resources={event.resources} maxVisible={2} />
              </div>
            )}
          </>
        )}
      </div>
    </Resizable>
    </div>
  );
};

export const EventItem = memo(EventItemMemo);
