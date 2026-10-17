import React, { useCallback, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  addMinutes,
  differenceInMinutes,
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
import { calculateRedLineOffset } from "../../Utils/calculateRedLineOffset";
import { getEventsForSlot } from "../../Utils/weekViewHelpers";
import { computeDayLayout } from "../../Utils/positionedEventsHelper";
import DragPreview from "../../Components/DragPreview";
import { createGridDragSnap } from "../../Utils/gridDragSnap";
import { getBusinessHoursIntervalsForDate } from "../../Utils/businessHours";
import { getDayRules } from "../../Utils/calendarRange";

const DayView: React.FC<DayViewProps> = ({
  events,
  onEventUpdate,
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

  // Explicit sensors: PointerSensor preserves pointer click/drag behavior,
  // KeyboardSensor enables keyboard-initiated drags. Declared before any
  // early return so the hook order stays stable.
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  // Same drag preview as the week view: a DragOverlay snapped to slots.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridSnap = useMemo(() => createGridDragSnap(), []);
  const [activeDrag, setActiveDrag] = useState<EventProps | null>(null);
  const handleDragStart = useCallback(
    ({ active }: any) => {
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
      gridSnap.begin(containerRef.current, slot?.getBoundingClientRect().height ?? 0, 0, bounds);
      setActiveDrag(dragged);
    },
    [events, gridSnap, config?.timeZone, config?.slotDuration, parsedSlotMin, parsedSlotMax]
  );

  const handleDragEnd = useCallback(
    (event: any) => {
      const snapped = gridSnap.result();
      gridSnap.end();
      setActiveDrag(null);
      const { active, over, delta } = event;
      if (!active?.id || !over?.id) return;
      if (getDayRules(config).isDisabled(new Date(over.id))) return;

      const baseTime = new TZDate(over.id, config?.timeZone || 'UTC');
      if (!isValid(baseTime)) return;

      const draggedEvent = events.find((ev: EventProps) => ev.id === active.id);
      if (!draggedEvent) return;

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

      const updatedEvent = {
        ...draggedEvent,
        start: new Date(newStart.getTime()).toISOString(),
        end: new Date(addMinutes(newStart, duration).getTime()).toISOString(),
      };

      if (Math.abs(delta.y) < 1 && onEventClick) {
        onEventClick(updatedEvent);
        return;
      }

      if (onEventUpdate) {
        onEventUpdate(updatedEvent);
      }
    },
    [events, config, onEventClick, onEventUpdate, gridSnap]
  );

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

  // Early return AFTER all hooks so hook order stays stable (rules-of-hooks).
  if (isNaN(numberOfSlots) || numberOfSlots <= 0) {
    return (
      <div>
        {config?.slotDuration} invalid time slot. Make sure the end time is greater than the start time and that they are valid hours.
      </div>
    );
  }

  const today = new TZDate(new Date(), config?.timeZone || 'UTC');
  const isToday = isSameDay(currentDate, today);
  const redLineOffset = calculateRedLineOffset(
    currentDate,
    parsedSlotMin,
    config?.slotDuration || 30,
    config?.timeZone
  );

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
        className="react-agendfy-dayview-container"
        style={{ position: 'relative', zIndex: 0 }}
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
              isDisabled={isDisabled}
              dayLayout={dayLayout}
            />
          );
        })}
        {isToday && (
          <div
            className="react-agendfy-now-line"
            style={{
              top: `${redLineOffset}px`,
              zIndex: 15,
            }}
          />
        )}
      </div>
      <DragOverlay modifiers={[gridSnap.modifier]} dropAnimation={null} zIndex={1000}>
        {activeDrag && <DragPreview event={activeDrag} config={config} />}
      </DragOverlay>
    </DndContext>
  );
};

export default DayView;
