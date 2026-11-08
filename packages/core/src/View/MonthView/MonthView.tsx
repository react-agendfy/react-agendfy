// MonthView.tsx
import React, { useMemo, useCallback, useRef, useState } from 'react';
import { DragEndEvent, DragMoveEvent, DragOverEvent, DragOverlay, DragStartEvent, rectIntersection } from '@dnd-kit/core';
import { ViewDndScope, type DragSnapshot, type DropResolution, type ViewDragOptions } from '../../context/InteractionContext';
import { eventFromExternal, eventFromExternalOnDay, externalByPointer, externalDragData } from '../../Utils/externalDrag';
import { useDropVerdict } from '../../hooks/useDropVerdict';
import { DragPreviewFrame } from '../../Components/DragPreview';
import { addDays, endOfWeek, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, isSameDay } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { ensureDate } from '../../Utils/DateTrannforms';
import { getDayRules } from '../../Utils/calendarRange';
import { weekNumberOf } from '../../Utils/displayOptions';
import { getLocale } from '../../Utils/locate';
import ResourceView from '../../Components/Resource/ResourceView';
import { MonthViewProps, EventProps } from '../../types/types';
import { EventItem } from './Components/EventItem';
import { CalendarDay } from './Components/CalendarDay';
import { normalizeEvents } from '../../Utils/calendarHelpers';
import { useGridNavigation } from '../../hooks/useGridNavigation';

// Drags start after 5px so a click on an event chip stays a click.
const MONTH_DRAG: ViewDragOptions = {
  collisionDetection: externalByPointer(rectIntersection),
  activationConstraint: { distance: 5 },
  instructions:
    'To pick up a draggable event, press space or enter. Use the arrow keys to move it to a new day, then press space or enter again to drop, or press escape to cancel.',
};

const MonthView: React.FC<MonthViewProps> = ({
  events = [],
  resources = [],
  currentDate = new Date(),
  onEventUpdate,
  onDayClick,
  onEventClick,
  onDateRangeSelect,
  config,
  showResourceView = false,
  onEventResize,
  onEventReceive,
}) => {
  const [activeEvent, setActiveEvent] = useState<EventProps | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState<Date | null>(null);
  const [selEnd, setSelEnd] = useState<Date | null>(null);

const monthStart = useMemo(() => startOfMonth(new TZDate(currentDate, config?.timeZone)), [currentDate, config?.timeZone]);
  const tz = config?.timeZone;
  const locale = getLocale(config?.lang);

  const dayRules = useMemo(() => getDayRules(config), [config]);
  const { weekStartsOn } = dayRules;

  // Rows of RENDERED days: hidden weekdays are dropped from every row, so the
  // grid has (7 - hidden) columns. Recurring events arrive pre-expanded from
  // the calendar context.
  const { weeks, expandedEvents } = useMemo(() => {
    const viewStart = startOfWeek(monthStart, { weekStartsOn });
    let viewEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn });
    // fixedWeekCount: always 6 rows (FullCalendar's default is true; ours
    // stays false so existing layouts keep only the weeks of the month).
    if (config?.fixedWeekCount) {
      viewEnd = endOfWeek(addDays(viewStart, 41), { weekStartsOn });
    }
    const allDays = eachDayOfInterval({ start: viewStart, end: viewEnd });
    const rows: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      rows.push(allDays.slice(i, i + 7).filter((d) => !dayRules.isHidden(d)));
    }
    return { weeks: rows, expandedEvents: normalizeEvents(events) };
  }, [events, monthStart, weekStartsOn, dayRules, config?.fixedWeekCount]);

  const columnCount = weeks[0]?.length || 7;
  const gridColumns = { gridTemplateColumns: `repeat(${columnCount}, 1fr)` };

  // One day cell per arrow key (measured at drag start).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const keyboardStepRef = useRef<{ x: number; y: number } | null>(null);
  const { verdict: dropVerdict, check: checkDrop, clear: clearDrop } = useDropVerdict();

  const handleDragStart = (e: DragStartEvent) => {
    const cell = containerRef.current?.querySelector('.react-agendfy-calendar-day')?.getBoundingClientRect();
    keyboardStepRef.current = cell?.width ? { x: cell.width, y: cell.height } : null;
    clearDrop();
    const external = externalDragData(e.active);
    if (external) {
      // An item from outside: previewed as the event it would become.
      setActiveEvent(onEventReceive ? eventFromExternal(external, new Date(), { allDay: !external.startTime }) : null);
      return;
    }
    setActiveEvent((e.active.data.current?.event as EventProps) ?? null);
  };

  /** The event moved to the day under the drag, or null (same day, disabled, nowhere). */
  const resolveDrop = (e: DragSnapshot): DropResolution | null => {
    const { active, over } = e;
    if (!active || !over) return null;

    const external = externalDragData(active);
    if (external) {
      const day = new Date(over.id);
      if (!onEventReceive || isNaN(day.getTime()) || dayRules.isDisabled(day)) return null;
      return { updated: eventFromExternalOnDay(external, day, tz), external };
    }
    const event = active.data.current?.event as EventProps | undefined;
    if (!event) return null;

    const targetDate = new Date(over.id);
    if (dayRules.isDisabled(targetDate)) return null;
    const origStart = ensureDate(event.start, tz);

    if (isSameDay(targetDate, origStart)) return null;

    const hours = origStart.getHours(), mins = origStart.getMinutes();
    targetDate.setHours(hours, mins);

    const duration = ensureDate(event.end, tz).getTime() - origStart.getTime();
    const newEnd = new Date(targetDate.getTime() + duration);

    return {
      dragged: event,
      updated: { ...event, start: targetDate.toISOString(), end: newEnd.toISOString() },
    };
  };

  // Live validation: the preview turns invalid over days the rules refuse.
  const handleDragMove = (e: DragMoveEvent | DragOverEvent) => {
    const result = resolveDrop(e);
    checkDrop(result?.updated ?? null, result?.dragged, result?.external ? 'receive' : 'move');
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveEvent(null);
    clearDrop();
    const { active, over, delta } = e;
    if (!active || !over) return;

    if (externalDragData(active)) {
      const received = resolveDrop(e);
      if (received) onEventReceive?.(received.updated, received.external?.data);
      return;
    }

    if (Math.abs(delta.x) < 5 && Math.abs(delta.y) < 5) {
      onEventClick?.(active.data.current?.event as EventProps);
      return;
    }

    const result = resolveDrop(e);
    if (result) onEventUpdate?.(result.updated);
  };

  const handleDragCancel = () => {
    setActiveEvent(null);
    clearDrop();
  };

  const handleEventResize = (status: 'start' | 'stop', event?: EventProps) => {
    setIsResizing(status === 'start');
    if (status === 'stop' && event) onEventResize?.(event);
  };

  const handleMouseDown = (d: Date) => {
    if (isResizing) return; // a resize gesture must never start a range selection
    if (dayRules.isDisabled(d)) return;
    setSelecting(true); setSelStart(d); setSelEnd(d);
  };
  const handleMouseMove = (d: Date) => { if (selecting && !dayRules.isDisabled(d)) setSelEnd(d); };
  const handleMouseUp = () => {
    if (selecting && selStart && selEnd && onDateRangeSelect) {
      const [start, end] = selStart < selEnd ? [selStart, selEnd] : [selEnd, selStart];
      onDateRangeSelect({ start: start.toISOString(), end: end.toISOString(), isMultiDay: !isSameDay(start, end) });
    }
    setSelecting(false); setSelStart(null); setSelEnd(null);
  };

  const isSelected = (d: Date): boolean => Boolean(selecting && selStart && selEnd && d >= (selStart < selEnd ? selStart : selEnd) && d <= (selStart > selEnd ? selStart : selEnd));

  // Roving tabindex over the flattened day grid (WAI-ARIA grid pattern).
  const allDays = useMemo(() => weeks.flat(), [weeks]);
  const defaultFocusIndex = useMemo(() => {
    const idx = allDays.findIndex((d) => isSameDay(d, new TZDate(currentDate, tz)));
    return idx >= 0 ? idx : 0;
  }, [allDays, currentDate, tz]);
  const handleActivateCell = useCallback(
    (index: number) => {
      const day = allDays[index];
      if (day && !isResizing && !dayRules.isDisabled(day)) onDayClick?.(day);
    },
    [allDays, onDayClick, isResizing, dayRules]
  );
  const { getCellProps } = useGridNavigation({
    cellCount: allDays.length,
    columns: columnCount,
    defaultIndex: defaultFocusIndex,
    onActivateCell: handleActivateCell,
  });

  return (
    <ViewDndScope
      handlers={{
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragOver: handleDragMove,
        onDragEnd: handleDragEnd,
        onDragCancel: handleDragCancel,
        keyboardStep: () => keyboardStepRef.current,
      }}
      options={MONTH_DRAG}
    >
      {showResourceView && resources.length > 0 && (
        <ResourceView resources={resources} events={expandedEvents} currentDate={currentDate} />
      )}

      <div
        ref={containerRef}
        className="react-agendfy-monthview-container"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="grid"
        aria-label={format(monthStart, 'MMMM yyyy', { locale })}
      >
        <div className="react-agendfy-monthview-header" role="row" style={gridColumns}>
          {(weeks[0] ?? []).map(d => (
            <div
              key={d.toISOString()}
              className="react-agendfy-monthview-day-label"
              role="columnheader"
              aria-label={format(d, 'EEEE', { locale })}
            >
              {format(d, 'EEEEEE', { locale })}
            </div>
          ))}
        </div>

        <div className="react-agendfy-monthview-grid-container" role="rowgroup">
          {weeks.map((week, i) => (
            <div key={i} className="react-agendfy-monthview-week-row" role="row" style={gridColumns}>
              {week.map((day, j) => {
                const disabled = dayRules.isDisabled(day);
                return (
                <CalendarDay
                  key={day ? format(day, 'yyyy-MM-dd') : `empty-${i}-${j}`}
                  day={day}
                  rowDays={week}
                  weekNumber={config?.weekNumbers && j === 0 ? weekNumberOf(day, config) : undefined}
                  isDisabled={disabled}
                  events={expandedEvents}
                  onDayClick={isResizing || disabled ? undefined : onDayClick}
                  onEventClick={onEventClick}
                  config={config}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  isSelected={isSelected(day)}
                  monthDate={monthStart}
                  onEventResize={onEventResize ? handleEventResize : undefined}
                  canDrag={!!onEventUpdate}
                  navProps={getCellProps(i * columnCount + j)}
                />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeEvent && (
          <DragPreviewFrame invalid={dropVerdict}>
            <EventItem event={activeEvent} isPreview isStart isEnd={false} config={config} dayWidth={150} />
          </DragPreviewFrame>
        )}
      </DragOverlay>
    </ViewDndScope>
  );
};

export default MonthView;