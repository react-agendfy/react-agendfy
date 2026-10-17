// MonthView.tsx
import React, { useMemo, useCallback, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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
  onEventResize
}) => {
  const [activeEvent, setActiveEvent] = useState<EventProps | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState<Date | null>(null);
  const [selEnd, setSelEnd] = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );
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

  const handleDragStart = (e: any) => setActiveEvent(e.active.data.current.event);
  const handleDragEnd = (e: any) => {
    setActiveEvent(null);
    const { active, over, delta } = e;
    if (!active || !over) return;

    const event = active.data.current.event as EventProps;

    if (Math.abs(delta.x) < 5 && Math.abs(delta.y) < 5) {
      onEventClick?.(event);
      return;
    }

    const targetDate = new Date(over.id);
    if (dayRules.isDisabled(targetDate)) return;
    const origStart = ensureDate(event.start, tz);

    if (isSameDay(targetDate, origStart)) return;

    const hours = origStart.getHours(), mins = origStart.getMinutes();
    targetDate.setHours(hours, mins);

    const duration = ensureDate(event.end, tz).getTime() - origStart.getTime();
    const newEnd = new Date(targetDate.getTime() + duration);

    onEventUpdate?.({
      ...event,
      start: targetDate.toISOString(),
      end: newEnd.toISOString(),
    });
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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To pick up a draggable event, press space or enter. Use the arrow keys to move it to a new day, then press space or enter again to drop, or press escape to cancel.',
        },
      }}
    >
      {showResourceView && resources.length > 0 && (
        <ResourceView resources={resources} events={expandedEvents} currentDate={currentDate} />
      )}

      <div
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
        {activeEvent && <EventItem event={activeEvent} isPreview isStart isEnd={false} config={config} dayWidth={150} />}
      </DragOverlay>
    </DndContext>
  );
};

export default MonthView;