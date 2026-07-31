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
import { format, differenceInCalendarDays, addDays, isSameDay, subMilliseconds } from 'date-fns';
import { Resizable } from "re-resizable";
import { TZDate } from '@date-fns/tz';
import { ensureDate } from '../../../Utils/DateTrannforms';
import ResourceDisplay from '../../../Components/Resource/ResourceDisplay';
import { BaseEventProps } from '../../../types/types';
import { getContrastText } from '../../../Utils/colorContrast';
import './EventItem.css';

const WEEK_STARTS_ON = 0; // month grid is built with weekStartsOn: 0

interface EventItemProps extends Omit<BaseEventProps, 'onEventResize'> {
  dayWidth: number;
  isPreview?: boolean;
  isStart: boolean;
  onEventResize?: (status: 'start' | 'stop', event?: BaseEventProps['event']) => void;
  isEnd: boolean;
  /** The calendar day this cell renders (drives row-bar geometry). */
  cellDate?: Date;
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
    const cell = new TZDate(pieceDate, config?.timeZone);
    const remainingDays = differenceInCalendarDays(visualEnd, cell) + 1;
    const offset = (cell.getDay() - WEEK_STARTS_ON + 7) % 7;
    const daysLeftInRow = 7 - offset;
    const isRowStart = offset === 0;
    const visible = isStart || isRowStart;
    const n = Math.max(1, Math.min(remainingDays, daysLeftInRow));
    return {
      isVisiblePiece: visible,
      stretchN: visible ? n : 1,
      roundStart: isStart,
      roundEnd: n >= remainingDays,
    };
  }, [spansDays, pieceDate, config?.timeZone, visualEnd, isStart]);

  // Percentage-based stretch bridges cell paddings + borders exactly.
  // --agendfy-month-day-gap = 2 * cell padding + cell border (see MonthView.css).
  const barWidth =
    isVisiblePiece && stretchN > 1
      ? `calc(${stretchN * 100}% + ${stretchN - 1} * var(--agendfy-month-day-gap, 17px))`
      : '100%';

  const draggableEnabled = !spansDays || (isStart || isEnd);
  const canDrag = draggableEnabled;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${event.id}-${isStart ? 'start' : isEnd ? 'end' : 'middle'}`,
    data: { event, isStart, isEnd },
    disabled: !draggableEnabled || isResizing,
  });

  const enableResizing = Boolean(onEventResize) && !isOtherMonth && (isEnd || !spansDays);

  const startTime = useMemo(() => format(tzStart, 'HH:mm'), [tzStart]);
  const endTime = useMemo(() => format(tzEnd, 'HH:mm'), [tzEnd]);

  const showContent = isVisiblePiece;

  const className = [
    'react-agendfy-event-item',
    isDragging && 'react-agendfy-event-item-dragging',
    isPreview && 'react-agendfy-event-item-preview',
    spansDays && isStart && 'react-agendfy-event-item-multiday-start',
    spansDays && isEnd && 'react-agendfy-event-item-multiday-end',
    spansDays && !isStart && !isEnd && 'react-agendfy-event-item-multiday-middle',
  ].filter(Boolean).join(' ');

  const radius = 'var(--agendfy-radius-sm)';
  const cornerStyle: React.CSSProperties = spansDays
    ? {
        borderStartStartRadius: roundStart ? radius : 0,
        borderEndStartRadius: roundStart ? radius : 0,
        borderStartEndRadius: roundEnd ? radius : 0,
        borderEndEndRadius: roundEnd ? radius : 0,
      }
    : {};

  const color = event.color || '#3490dc';

  return (
    <Resizable
      // IMPORTANT: the stretch width MUST go through `size` — re-resizable
      // merges size AFTER style, so a width in `style` is silently
      // overridden and the bar collapses back to one cell.
      size={{ width: barWidth, height: CHIP_HEIGHT }}
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
          backgroundColor: isVisiblePiece ? color : 'transparent',
          color: isVisiblePiece ? getContrastText(color) : 'transparent',
          cursor: canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.7 : 1,
          width: '100%',
          height: '100%',
          ...cornerStyle,
        }}
        title={isVisiblePiece ? event.title : undefined}
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
        aria-label={isVisiblePiece ? `${event.title}, ${startTime} - ${endTime}` : undefined}
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
        {showContent && (
          <>
            <div className="react-agendfy-event-item-content">
              <span>{event.title}</span>
              <span>{startTime}</span>
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
  );
};

export const EventItem = memo(EventItemMemo);
