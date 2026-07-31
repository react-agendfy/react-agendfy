// EventItem.tsx
import React, { memo, useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { format, differenceInDays, addDays, isSameDay } from 'date-fns';
import { Resizable } from "re-resizable"; // Adicione de volta
import { TZDate } from '@date-fns/tz';
import { ensureDate } from '../../../Utils/DateTrannforms';
import ResourceDisplay from '../../../Components/Resource/ResourceDisplay';
import { BaseEventProps } from '../../../types/types';
import { getContrastText } from '../../../Utils/colorContrast';
import './EventItem.css';

interface EventItemProps extends Omit<BaseEventProps, 'onEventResize'> {
  dayWidth: number;
  isPreview?: boolean;
  isStart: boolean;
  onEventResize?: (status: 'start' | 'stop', event?: BaseEventProps['event']) => void;
  isEnd: boolean;
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
}) => {
  const draggableId = `${event.id}-${isStart ? 'start' : isEnd ? 'end' : 'single'}`;
  const canDrag = event.isMultiDay ? (isStart || isEnd) : true;

  const [isResizing, setIsResizing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: "100%", height: 20 });

  const draggableEnabled = !event.isMultiDay || (isStart || isEnd);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${event.id}-${isStart ? 'start' : isEnd ? 'end' : 'middle'}`,
    data: { event, isStart, isEnd },
    disabled: !draggableEnabled || isResizing,
  });

  const enableResizing = Boolean(onEventResize) && !isOtherMonth && (isEnd || !event.isMultiDay);


  const startTime = useMemo(() => {
    const date = ensureDate(event.start, config?.timeZone);
    return format(date, 'HH:mm');
  }, [event.start, config?.timeZone]);

  const endTime = useMemo(() => {
    const date = ensureDate(event.end, config?.timeZone);
    return format(date, 'HH:mm');
  }, [event.end, config?.timeZone]);

  const showContent = isStart || !event.isMultiDay;
 
  const className = [
    'react-agendfy-event-item',
    isDragging && 'react-agendfy-event-item-dragging',
    isPreview && 'react-agendfy-event-item-preview',
    event.isMultiDay && isStart && 'react-agendfy-event-item-multiday-start',
    event.isMultiDay && isEnd && 'react-agendfy-event-item-multiday-end',
    event.isMultiDay && !isStart && !isEnd && 'react-agendfy-event-item-multiday-middle',
  ].filter(Boolean).join(' ');

  const eventDurationDays = useMemo(() => {
    const start = ensureDate(event.start);
    const end = ensureDate(event.end);
    return differenceInDays(end, start) + 1;
  }, [event.start, event.end]);

  const width = isStart ? `${eventDurationDays * dayWidth}px` : '100%';

  return (
    <Resizable
      size={{ width: dimensions.width, height: dimensions.height }}
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
        const eventStart = ensureDate(event.start, config?.timeZone);
        const originalEnd = ensureDate(event.end, config?.timeZone);
        const newEnd = addDays(originalEnd, daysDelta); // negative delta shrinks
        if (newEnd.getTime() <= eventStart.getTime()) {
          onEventResize?.('stop');
          return;
        }
        onEventResize?.('stop', {
          ...event,
          end: new Date(newEnd.getTime()).toISOString(),
          isMultiDay: !isSameDay(eventStart, newEnd),
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
        width: width,
        zIndex: isDragging || isResizing ? 1000 : 'auto',
      }}
    >
      <div
        ref={setNodeRef}
        className={className}
        style={{
          backgroundColor: event.color || '#3490dc',
          color: getContrastText(event.color || '#3490dc'),
          cursor: canDrag ? 'grab' : 'pointer',
          opacity: isDragging ? 0.7 : 1,
          width: '100%',
          height: '100%',
        }}
        title={event.title}
        onClick={(e) => {
          e.stopPropagation();
          if (!isResizing) {
            onEventClick?.(event);
          }
        }}
        {...(canDrag ? listeners : {})}
        {...(canDrag ? attributes : {})}
        role="button"
        tabIndex={0}
        aria-label={`${event.title}, ${startTime} - ${endTime}`}
        onKeyDown={(e: React.KeyboardEvent) => {
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