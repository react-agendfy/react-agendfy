import React, { useCallback, useMemo, useRef, useState } from "react";
import { DragEndEvent, DragMoveEvent, DragOverEvent, DragOverlay, DragStartEvent, rectIntersection } from "@dnd-kit/core";
import {
  addMinutes,
  differenceInMinutes,
  format,
  isValid,
  startOfDay,
  setHours,
  setMinutes,
  isSameDay,
} from "date-fns";
import { ensureDate } from "../../Utils/DateTrannforms";
import { DayViewProps, EventProps } from "../../types/types";
import { TZDate } from "@date-fns/tz";
import { TimeSlot } from "./Components/TimeSlot";
import { nowLineOffset } from "../../Utils/calculateRedLineOffset";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import { getEventsForSlot } from "../../Utils/weekViewHelpers";
import { computeDayLayout } from "../../Utils/positionedEventsHelper";
import DragPreview from "../../Components/DragPreview";
import { createGridDragSnap } from "../../Utils/gridDragSnap";
import { getBusinessHoursIntervalsForDate } from "../../Utils/businessHours";
import { getDayRules } from "../../Utils/calendarRange";
import { getSlotHeight, slotHeightStyle } from "../../Utils/slotHeight";
import { cx, useDayCellClassNames } from "../../context/ClassNamesContext";
import { ViewDndScope, type DragSnapshot, type DropResolution, type ViewDragOptions } from "../../context/InteractionContext";
import { eventFromExternal, externalByPointer, externalDragData } from "../../Utils/externalDrag";
import { useDropVerdict } from "../../hooks/useDropVerdict";

const DAY_DRAG: ViewDragOptions = {
  collisionDetection: externalByPointer(rectIntersection),
  instructions:
    "To pick up a draggable event, press space or enter. Use the arrow keys to move it to a new time slot, then press space or enter again to drop, or press escape to cancel.",
};

const DayView: React.FC<DayViewProps> = ({
  events,
  onEventUpdate,
  onEventReceive,
  onEventClick,
  onSlotClick,
  currentDate,
  config,
}: DayViewProps) => {
  const parseTime = (timeStr: string | undefined) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  };
  const parsedSlotMin = parseTime(config?.slotMin);
  const parsedSlotMax = parseTime(config?.slotMax);
  const numberOfSlots =
    Math.floor(((parsedSlotMax - parsedSlotMin) * 60) / (config?.slotDuration || 30));

  // Same drag preview as the week view: a DragOverlay snapped to slots.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridSnap = useMemo(() => createGridDragSnap(), []);
  const [activeDrag, setActiveDrag] = useState<EventProps | null>(null);
  // One slot per arrow key (measured at drag start); single column, no x.
  const keyboardStepRef = useRef<{ x: number; y: number } | null>(null);
  // Latest drag event, to revalidate after a key press.
  const lastDragRef = useRef<DragSnapshot | null>(null);
  const { verdict: dropVerdict, check: checkDrop, clear: clearDrop } = useDropVerdict();
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      lastDragRef.current = event;
      const { active } = event;
      clearDrop();
      // An item from outside: no snap (no position in the grid); the slot
      // under the pointer decides.
      const external = externalDragData(active);
      if (external) {
        keyboardStepRef.current = null;
        gridSnap.begin(containerRef.current, 0);
        setActiveDrag(onEventReceive ? eventFromExternal(external, new Date()) : null);
        return;
      }
      const slot = containerRef.current?.querySelector(".react-agendfy-timeslot-container");
      const dragged = events.find((ev: EventProps) => ev.id === active?.id) ?? null;
      const step = config?.slotDuration || 30;
      let bounds;
      if (dragged) {
        // Keep the preview between slotMin and slotMax.
        const start = new TZDate(ensureDate(dragged.start, config?.timeZone), config?.timeZone);
        const fromGridStart = start.getHours() * 60 + start.getMinutes() - parsedSlotMin * 60;
        const length = differenceInMinutes(ensureDate(dragged.end, config?.timeZone), start);
        bounds = {
          minSlots: -Math.floor(fromGridStart / step),
          maxSlots: Math.floor(((parsedSlotMax - parsedSlotMin) * 60 - fromGridStart - length) / step),
        };
      }
      const slotPx = slot?.getBoundingClientRect().height ?? 0;
      keyboardStepRef.current = slotPx ? { x: 0, y: slotPx } : null;
      gridSnap.begin(containerRef.current, slotPx, 0, bounds);
      setActiveDrag(dragged);
    },
    [events, gridSnap, config?.timeZone, config?.slotDuration, parsedSlotMin, parsedSlotMax, clearDrop, onEventReceive]
  );

  /** Where the dragged event lands for this drag state (null: nowhere). */
  const resolveDrop = useCallback(
    (event: DragSnapshot): DropResolution | null => {
      const snapped = gridSnap.result();
      const { active, over } = event;
      if (!active?.id || !over?.id) return null;
      if (getDayRules(config).isDisabled(new Date(over.id))) return null;

      const external = externalDragData(active);
      if (external) {
        const start = new Date(over.id);
        return onEventReceive && isValid(start) ? { updated: eventFromExternal(external, start), external } : null;
      }

      const baseTime = new TZDate(String(over.id), config?.timeZone || 'UTC');
      if (!isValid(baseTime)) return null;

      const draggedEvent = events.find((ev: EventProps) => ev.id === active.id);
      if (!draggedEvent) return null;

      const originalStart = ensureDate(draggedEvent.start, config?.timeZone);
      const duration = differenceInMinutes(
        ensureDate(draggedEvent.end, config?.timeZone),
        originalStart
      );

      // With layout, the drop is exactly the snapped preview (scroll-aware,
      // see gridDragSnap). Without it (tests), the pointer's slot.
      const newStart = snapped
        ? addMinutes(originalStart, snapped.slots * (config?.slotDuration || 30))
        : baseTime;

      return {
        dragged: draggedEvent,
        updated: {
          ...draggedEvent,
          start: new Date(newStart.getTime()).toISOString(),
          end: new Date(addMinutes(newStart, duration).getTime()).toISOString(),
        },
      };
    },
    [events, config, gridSnap, onEventReceive]
  );

  // Live validation: the preview turns invalid where the drop would be refused.
  const handleDragMove = useCallback(
    (event: DragMoveEvent | DragOverEvent | DragSnapshot) => {
      lastDragRef.current = event;
      const result = resolveDrop(event);
      checkDrop(result?.updated ?? null, result?.dragged, result?.external ? "receive" : "move");
    },
    [resolveDrop, checkDrop]
  );

  // Keyboard drags move in whole slots (single column: ←→ do nothing).
  const handleKeyboardStep = useCallback(
    (_dx: number, dy: number) => {
      gridSnap.step(dy, 0);
      if (lastDragRef.current) handleDragMove(lastDragRef.current);
    },
    [gridSnap, handleDragMove]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const result = resolveDrop(event);
      gridSnap.end();
      setActiveDrag(null);
      clearDrop();
      if (!result) return;

      if (result.external) {
        onEventReceive?.(result.updated, result.external.data);
        return;
      }

      // Single column: only a vertical move is a drag (see the RFC note on
      // DayView's delta.y click detection).
      if (Math.abs(event.delta.y) < 1 && onEventClick) {
        onEventClick(result.updated);
        return;
      }

      if (onEventUpdate) {
        onEventUpdate(result.updated);
      }
    },
    [resolveDrop, gridSnap, clearDrop, onEventClick, onEventUpdate, onEventReceive]
  );

  const handleDragCancel = useCallback(() => {
    gridSnap.end();
    setActiveDrag(null);
    clearDrop();
  }, [gridSnap, clearDrop]);

  const businessIntervals = useMemo(
    () =>
      config?.businessHours?.enabled
        ? getBusinessHoursIntervalsForDate(new TZDate(currentDate, config?.timeZone), config.businessHours)
        : [],
    [currentDate, config?.businessHours, config?.timeZone]
  );
  const isDisabled = useMemo(() => getDayRules(config).isDisabled(currentDate), [config, currentDate]);

  const getSlotEvents = useCallback(
    (slotTime: string) => getEventsForSlot(slotTime, events, config),
    [events, config]
  );

  // Slot start times + their events, computed once so overlap columns can be
  // decided for the whole day (computeDayLayout) instead of per slot.
  const slots = useMemo(() => {
    if (isNaN(numberOfSlots) || numberOfSlots <= 0) return [];
    return Array.from({ length: numberOfSlots }, (_, index) => {
      const minutes = index * (config?.slotDuration || 30);
      const totalMinutes = (parsedSlotMin * 60) + minutes;
      const slotTime = setMinutes(
        setHours(startOfDay(currentDate), Math.floor(totalMinutes / 60)),
        minutes % 60
      ).toISOString();
      return { index, slotTime, events: getSlotEvents(slotTime) };
    });
  }, [numberOfSlots, config?.slotDuration, parsedSlotMin, currentDate, getSlotEvents]);
  const dayLayout = useMemo(
    () => computeDayLayout(slots.flatMap((s) => s.events), config?.timeZone),
    [slots, config?.timeZone]
  );

  // Moves the current-time line once a minute.
  useMinuteTick(config?.nowIndicator !== false);

  const isToday = isSameDay(currentDate, new TZDate(new Date(), config?.timeZone));
  const extraClassNames = useDayCellClassNames({
    date: currentDate,
    view: config?.defaultView ?? "day",
    isToday,
    isDisabled,
  });

  // Early return AFTER all hooks so hook order stays stable (rules-of-hooks).
  if (isNaN(numberOfSlots) || numberOfSlots <= 0) {
    return (
      <div>
        {config?.slotDuration} invalid time slot. Make sure the end time is greater than the start time and that they are valid hours.
      </div>
    );
  }

  const redLineOffset =
    config?.nowIndicator !== false
      ? nowLineOffset(
          currentDate,
          parsedSlotMin,
          parsedSlotMax,
          config?.slotDuration || 30,
          config?.timeZone,
          new Date(),
          getSlotHeight(config)
        )
      : null;

  return (
    <ViewDndScope
      handlers={{
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragOver: handleDragMove,
        onDragEnd: handleDragEnd,
        onDragCancel: handleDragCancel,
        keyboardStep: () => keyboardStepRef.current,
        onKeyboardStep: handleKeyboardStep,
      }}
      options={DAY_DRAG}
    >
      <div
        ref={containerRef}
        className={cx("react-agendfy-dayview-container", extraClassNames)}
        style={{ position: 'relative', zIndex: 0, ...slotHeightStyle(config) }}
        data-date={format(currentDate, "yyyy-MM-dd")}
        data-today={isToday || undefined}
        data-disabled={isDisabled || undefined}
      >
        {slots.map(({ index, slotTime, events: slotEvents }) => {
          const slotMs = new Date(slotTime).getTime();
          const isBusinessHour = businessIntervals.some(
            (interval) => slotMs >= interval.start.getTime() && slotMs < interval.end.getTime()
          );
          return (
            <TimeSlot
              key={index}
              index={index}
              slotEvents={slotEvents}
              onEventUpdate={onEventUpdate}
              onSlotClick={onSlotClick}
              dayDate={currentDate}
              slotMin={parsedSlotMin}
              parsedSlotMax={parsedSlotMax}
              config={config}
              isBusinessHour={isBusinessHour}
              isNonBusiness={!!config?.businessHours?.enabled && !isBusinessHour}
              isDraggable={!!onEventUpdate}
              isDisabled={isDisabled}
              dayLayout={dayLayout}
            />
          );
        })}
        {redLineOffset !== null && (
          <div
            className="react-agendfy-now-line"
            style={{
              top: `${redLineOffset}px`,
            }}
          />
        )}
      </div>
      <DragOverlay modifiers={[gridSnap.modifier]} dropAnimation={null} zIndex={1000}>
        {activeDrag && <DragPreview event={activeDrag} config={config} invalid={dropVerdict} />}
      </DragOverlay>
    </ViewDndScope>
  );
};

export default DayView;
