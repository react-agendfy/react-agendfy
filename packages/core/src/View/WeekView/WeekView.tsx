import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import {
  format,
  addMinutes,
  differenceInMinutes,
  isValid,
  addDays,
  setHours,
  setMinutes,
  startOfDay,
  endOfDay,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { ensureDate } from "../../Utils/DateTrannforms";
import { clipEventToDay, isBannerEvent } from "../../Utils/weekViewHelpers";
import { formatMessage } from "../../i18n";
import { EventProps, WeekProps } from "../../types/types";
import { TZDate } from "@date-fns/tz";
import { DayColumn } from "./Components/DayColumn";
import { calculateRedLineOffset } from "../../Utils/calculateRedLineOffset";
import { useMediaQuery } from '../../hooks/useMediaQuery';
import DragPreview from "../../Components/DragPreview";
import { formatSlotLabel, showsSlotLabel, weekNumberOf } from "../../Utils/displayOptions";
import { createGridDragSnap } from "../../Utils/gridDragSnap";
import { getDayRules, getVisibleDayOffsets } from "../../Utils/calendarRange";
import { getSlotHeight, slotHeightStyle } from "../../Utils/slotHeight";
import { cx, publicEventId, useEventClassNamesResolver } from "../../context/ClassNamesContext";

const WeekView = ({
  events,
  onEventUpdate,
  onEventClick,
  onEventResize,
  onSlotClick,
  currentDate,
  onDateRangeSelect,
  slotMin = "0",
  slotMax = "24",
  config,
}: WeekProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);

  const startHour = parseInt(slotMin, 10);
  const endHour = parseInt(slotMax, 10);
  const slotDuration = config?.slotDuration || 30;

  const numberOfSlots = useMemo(
    () => ((endHour - startHour) * 60) / slotDuration,
    [startHour, endHour, slotDuration]
  );
  // Invalid-slot detection: the early return happens AFTER all hooks (below)
  // so hook order stays stable across renders (rules-of-hooks). The hooks
  // tolerate NaN/negative lengths (Array.from({length: NaN}) === []).
  const hasInvalidSlots = isNaN(numberOfSlots) || numberOfSlots <= 0;

  const dayRules = useMemo(
    () => getDayRules(config),
    [config]
  );

  const currentWeekStart = useMemo(
    () => startOfWeek(new TZDate(currentDate, config?.timeZone), { weekStartsOn: dayRules.weekStartsOn }),
    [currentDate, config?.timeZone, dayRules.weekStartsOn]
  );

  // Offsets from the week start of the rendered columns (hidden weekdays are
  // skipped). Mobile renders only the current day.
  const daysOfWeek = useMemo(() => {
    if (isMobile) return [(currentDate.getDay() - dayRules.weekStartsOn + 7) % 7];
    return getVisibleDayOffsets(dayRules.weekStartsOn, dayRules.hidden);
  }, [isMobile, currentDate, dayRules]);

  const timeSlots = useMemo(() => Array.from({ length: numberOfSlots }, (_, i) => i), [numberOfSlots]);

  const timeslotLabels = useMemo(() => {
    return timeSlots.map((index) => {
      const minutes = index * slotDuration;
      const hour = startHour + Math.floor(minutes / 60);
      const minute = minutes % 60;
      const time = setMinutes(setHours(startOfDay(new TZDate(currentDate, config?.timeZone)), hour), minute);
      // slotLabelInterval: label only every N minutes (empty rows keep the grid).
      return showsSlotLabel(minutes, config) ? formatSlotLabel(time, config) : "";
    });
  }, [timeSlots, currentDate, config, startHour, slotDuration]);

  const redLineOffset = useMemo(
    () => calculateRedLineOffset(currentDate, startHour, slotDuration, config?.timeZone, getSlotHeight(config)),
    [currentDate, startHour, slotDuration, config?.timeZone, config?.slotHeight]
  );

  const eventClassNamesFor = useEventClassNamesResolver();

  const allDayEventsByDay = useMemo(() => {
    const mapping: { [key: number]: EventProps[] } = {};
    daysOfWeek.forEach((dayIndex) => {
      const dayDate = addDays(currentWeekStart, dayIndex);
      mapping[dayIndex] = events.filter((event: EventProps) => {
        // Banner = explicit all-day OR timed span >= 24h. A timed event that
        // merely crosses midnight stays in the time grid as clipped segments
        // (professional-calendar semantics), NOT in this row.
        if (!isBannerEvent(event, config?.timeZone)) return false;
        const eventStart = ensureDate(event.start, config?.timeZone);
        const eventEnd = ensureDate(event.end, config?.timeZone);
        // The end is exclusive (FullCalendar/iCal): an all-day event ending
        // at 00:00 on the 22nd covers the 21st only.
        // Computed in the CALENDAR time zone (a plain Date would use the
        // host's, shifting the day when the two differ).
        const lastMoment =
          eventEnd.getTime() > eventStart.getTime()
            ? new TZDate(eventEnd.getTime() - 1, config?.timeZone)
            : eventEnd;
        return dayDate >= startOfDay(eventStart) && dayDate <= endOfDay(lastMoment);
      });
    });
    return mapping;
  }, [daysOfWeek, currentWeekStart, events, config?.timeZone]);

  // Drag preview: the dragged event is drawn in a DragOverlay (above every
  // slot and column) that moves in whole slots/columns, while the original
  // stays in place as a ghost. The drop lands exactly where the preview is.
  const containerRef = useRef<HTMLDivElement | null>(null);
  // One snap state per view: the preview and the drop share its result.
  const gridSnap = useMemo(() => createGridDragSnap(), []);
  const [activeDrag, setActiveDrag] = useState<EventProps | null>(null);

  const handleDragStart = useCallback((event: any) => {
    const { active } = event;
    const dragged = events.find((e: EventProps) => e.id === active?.id);
    const slot = containerRef.current?.querySelector(".react-agendfy-weektimeslot");
    const column = containerRef.current?.querySelector(".react-agendfy-weekview-day-column");
    // Keep the preview inside the grid: between slotMin and slotMax, and
    // between the first and last rendered column.
    let bounds;
    if (dragged) {
      const start = new TZDate(ensureDate(dragged.start, config?.timeZone), config?.timeZone);
      const fromGridStart = start.getHours() * 60 + start.getMinutes() - startHour * 60;
      const length = differenceInMinutes(ensureDate(dragged.end, config?.timeZone), start);
      const fromColumn = daysOfWeek.indexOf((start.getDay() - dayRules.weekStartsOn + 7) % 7);
      bounds = {
        minSlots: -Math.floor(fromGridStart / slotDuration),
        maxSlots: Math.floor(((endHour - startHour) * 60 - fromGridStart - length) / slotDuration),
        minColumns: fromColumn < 0 ? 0 : -fromColumn,
        maxColumns: fromColumn < 0 ? 0 : daysOfWeek.length - 1 - fromColumn,
      };
    }
    gridSnap.begin(
      containerRef.current,
      slot?.getBoundingClientRect().height ?? 0,
      column?.getBoundingClientRect().width ?? 0,
      bounds
    );
    if (dragged) setActiveDrag(dragged);
  }, [events, gridSnap, config?.timeZone, startHour, endHour, slotDuration, daysOfWeek, dayRules.weekStartsOn]);

  const handleDragEnd = useCallback((event: any) => {
    const { active, over, delta } = event;
    const snapped = gridSnap.result();
    gridSnap.end();
    setActiveDrag(null);
    if (!active?.id || !over?.id) return;

    const baseTime = new TZDate(new Date(over.id), config?.timeZone);
    if (!isValid(baseTime)) return;

    const draggedEvent = events.find((ev: EventProps) => ev.id === active.id);
    if (!draggedEvent) return;

    const originalStart = new TZDate(ensureDate(draggedEvent.start, config?.timeZone), config?.timeZone);
    const duration = differenceInMinutes(
      ensureDate(draggedEvent.end, config?.timeZone),
      originalStart
    );

    // With layout, the drop is EXACTLY the snapped preview: the original
    // time moved by the snapped slots, in the column the preview sits in
    // (rendered columns, so hidden weekdays are skipped). Without layout
    // (tests) fall back to the slot under the pointer (`over.id`,
    // pointerWithin); adding a transform offset to it would double-count
    // the drag (bug B8).
    let newStartTime: Date = baseTime;
    if (snapped) {
      const fromColumn = daysOfWeek.indexOf((originalStart.getDay() - dayRules.weekStartsOn + 7) % 7);
      const toColumn = Math.min(daysOfWeek.length - 1, Math.max(0, (fromColumn < 0 ? 0 : fromColumn) + snapped.columns));
      const dayDiff = fromColumn < 0 ? 0 : daysOfWeek[toColumn] - daysOfWeek[fromColumn];
      newStartTime = addMinutes(addDays(originalStart, dayDiff), snapped.slots * slotDuration);
    }

    // Consider both axes so a horizontal drag (moving to another day column)
    // is not misclassified as a click and discarded.
    if (!delta || (Math.abs(delta.x) < 5 && Math.abs(delta.y) < 5)) {
      onEventClick?.(draggedEvent);
      return;
    }

    // Normalize to canonical UTC ISO ("Z", not "+00:00") — same convention
    // as the resize path, so event date strings stay uniform library-wide.
    const updatedEvent = {
      ...draggedEvent,
      start: new Date(newStartTime.getTime()).toISOString(),
      end: new Date(addMinutes(newStartTime, duration).getTime()).toISOString(),
    };

    if (typeof onEventUpdate === "function") {
      onEventUpdate(updatedEvent);
    }
  }, [events, config?.timeZone, onEventClick, onEventUpdate, slotDuration, gridSnap, daysOfWeek, dayRules.weekStartsOn]);

  const handleSelectionMouseDown = useCallback((slotTime: Date) => {
    if (!slotTime) return;
    setIsSelecting(true);
    setSelectionStart(slotTime);
    setSelectionEnd(slotTime);
  }, []);

  const handleSelectionMouseMove = useCallback((slotTime: Date) => {
    if (isSelecting && slotTime) {
      setSelectionEnd(slotTime);
    }
  }, [isSelecting]);

  const handleSelectionMouseUp = useCallback(() => {
    if (isSelecting && selectionStart && selectionEnd && onDateRangeSelect) {
    const start = selectionStart < selectionEnd ? selectionStart : selectionEnd;
    const end = selectionStart > selectionEnd ? selectionStart : selectionEnd;
    const finalEnd = addMinutes(end, slotDuration);

    onDateRangeSelect({
      start: start.toISOString(),
      end: finalEnd.toISOString(),
      isMultiDay: !isSameDay(start, end),
    });
    }
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [isSelecting, selectionStart, selectionEnd, onDateRangeSelect, slotDuration]);

  const isSlotSelected = useCallback((slotTime: Date) => {
    if (!isSelecting || !selectionStart || !selectionEnd || !slotTime) return false;
    const start = selectionStart < selectionEnd ? selectionStart : selectionEnd;
    const end = selectionStart > selectionEnd ? selectionStart : selectionEnd;
    return slotTime >= start && slotTime <= end;
  }, [isSelecting, selectionStart, selectionEnd]);

  const getEvents = useCallback((slotTime: string) => {
    const slotDate = new TZDate(slotTime, config?.timeZone);
    const slotDateFormatted = format(slotDate, "yyyy-MM-dd HH:mm");
    return events.reduce((acc: EventProps[], event: EventProps) => {
      // Recurring events arrive pre-expanded from the calendar context.
      if (isBannerEvent(event, config?.timeZone)) return acc;
      // Clip timed events to this slot's day so a midnight-crossing event
      // renders as one segment per day (continuation starts at 00:00 and
      // therefore matches the day's first slot).
      const segment = clipEventToDay(event, slotDate, config?.timeZone);
      if (!segment) return acc;
      if (format(new TZDate(ensureDate(segment.start), config?.timeZone), "yyyy-MM-dd HH:mm") === slotDateFormatted) {
        acc.push(segment);
      }
      return acc;
    }, []);
  }, [events, config?.timeZone]);

  const isDraggable = useMemo(() => typeof onEventUpdate === "function", [onEventUpdate]);

  // Explicit sensors: PointerSensor keeps the existing click-vs-drag delta
  // detection intact, KeyboardSensor enables keyboard-initiated drags.
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  if (hasInvalidSlots) {
    return (
      <div className="react-agendfy-weekview-error">
        {formatMessage(
          config?.invalid_slot_duration,
          { duration: config?.slotDuration ?? "" },
          "{duration} de tempo inválido. Certifique-se de que a hora final seja maior que a hora inicial e que sejam horas válidas."
        )}
      </div>
    );
  }

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      collisionDetection={pointerWithin}
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "To pick up a draggable event, press space or enter. Use the arrow keys to move it to a new time slot, then press space or enter again to drop, or press escape to cancel.",
        },
      }}
    >
      <div
        ref={containerRef}
        className="react-agendfy-weekview-container"
        style={slotHeightStyle(config)}
        role="grid"
        aria-label={`${format(addDays(currentWeekStart, daysOfWeek[0] ?? 0), "d MMM yyyy")} - ${format(addDays(currentWeekStart, daysOfWeek[daysOfWeek.length - 1] ?? 6), "d MMM yyyy")}`}
      >
        {config?.allDaySlot !== false && (
        <div className="react-agendfy-weekview-all-day">
          <div className="react-agendfy-weekview-all-day-label">
            <div className="react-agendfy-weekview-all-day-text">{config?.all_day}</div>
          </div>
          {daysOfWeek.map((dayIndex) => {
            const dayDate = addDays(currentWeekStart, dayIndex);
            const dayAllDayEvents = allDayEventsByDay[dayIndex] || [];
            return (
              <div key={dayIndex} className="react-agendfy-weekview-all-day-column">
                {dayAllDayEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{ backgroundColor: event.color }}
                    className={cx(
                      "react-agendfy-weekview-all-day-event",
                      eventClassNamesFor(event, config?.defaultView ?? "week")
                    )}
                    data-event-id={publicEventId(event)}
                  >
                    {event.title || config?.untitled_event || "Event"}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        )}
        <div
          className="react-agendfy-weekview-timeslot-grid"
          onMouseUp={handleSelectionMouseUp}
          onMouseLeave={handleSelectionMouseUp}
          role="row"
        >
          <div className="react-agendfy-weekview-timeslot-label">
            <div className="react-agendfy-weekview-timeslot-label-top">
              {config?.weekNumbers && (
                <span className="react-agendfy-week-number" title={`${config?.week_number_label ?? "W"}${weekNumberOf(currentWeekStart, config)}`}>
                  {`${config?.week_number_label ?? "W"}${weekNumberOf(currentWeekStart, config)}`}
                </span>
              )}
            </div>
            {timeslotLabels.map((label, index) => (
              <div key={`hour-${index}`} className="react-agendfy-weekview-timeslot">
                {label}
              </div>
            ))}
          </div>
          {daysOfWeek.map((dayIndex) => {
            const dayDate = addDays(currentWeekStart, dayIndex);
            return (
              <div
                key={dayIndex}
                className={`react-agendfy-weekview-day-column ${dayIndex !== daysOfWeek[daysOfWeek.length - 1] ? "react-agendfy-border-right" : ""}`}
                role="gridcell"
                aria-label={format(dayDate, "EEEE, d MMMM yyyy")}
                aria-current={isSameDay(dayDate, new TZDate(new Date(), config?.timeZone)) ? "date" : undefined}
              >
                <DayColumn
                  dayDate={dayDate}
                  events={events}
                  timeSlots={timeSlots}
                  parsedSlotMin={startHour}
                  parsedSlotMax={endHour}
                  onEventClick={onEventClick}
                  onEventResize={onEventResize}
                  onSlotClick={onSlotClick}
                  redLineOffset={redLineOffset}
                  config={config}
                  getEventsForDay={getEvents}
                  isDraggable={isDraggable}
                  onSelectionMouseDown={handleSelectionMouseDown}
                  onSelectionMouseMove={handleSelectionMouseMove}
                  isSlotSelected={isSlotSelected}
                  isDisabled={dayRules.isDisabled(dayDate)}
                />
              </div>
            );
          })}
        </div>
      </div>
      <DragOverlay modifiers={[gridSnap.modifier]} dropAnimation={null} zIndex={1000}>
        {activeDrag && <DragPreview event={activeDrag} config={config} />}
      </DragOverlay>
    </DndContext>
  );
};

export default WeekView;