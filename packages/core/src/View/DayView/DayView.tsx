import React, { useCallback } from "react";
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  addMinutes,
  differenceInMinutes,
  isValid,
  startOfDay,
  format,
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

  const handleDragEnd = useCallback(
    (event: any) => {
      const { active, over, delta } = event;
      if (!active?.id || !over?.id) return;

      const baseTime = new TZDate(over.id, config?.timeZone || 'UTC');
      if (!isValid(baseTime)) return;

      const draggedEvent = events.find((ev: EventProps) => ev.id === active.id);
      if (!draggedEvent) return;

      const duration = differenceInMinutes(
        ensureDate(draggedEvent.end, config?.timeZone),
        ensureDate(draggedEvent.start, config?.timeZone)
      );

      const updatedEvent = {
        ...draggedEvent,
        start: baseTime.toISOString(),
        end: addMinutes(baseTime, duration).toISOString(),
      };

      if (Math.abs(delta.y) < 1 && onEventClick) {
        onEventClick(updatedEvent);
        return;
      }

      if (onEventUpdate) {
        onEventUpdate(updatedEvent);
      }
    },
    [events, config?.timeZone, onEventClick, onEventUpdate]
  );

  const getSlotEvents = useCallback(
    (slotTime: string) => getEventsForSlot(slotTime, events, config),
    [events, config]
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
        className="react-agendfy-dayview-container"
        style={{ position: 'relative', zIndex: 0 }}
      >
        {[...Array(numberOfSlots)].map((_, index) => {
          const minutes = index * (config?.slotDuration || 30);
          const totalMinutes = (parsedSlotMin * 60) + minutes;
          const calculatedHour = Math.floor(totalMinutes / 60);
          const minute = minutes % 60;
          const slotTime = setMinutes(
            setHours(startOfDay(currentDate), calculatedHour),
            minute
          ).toISOString();
          const slotEvents = getSlotEvents(slotTime);
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
    </DndContext>
  );
};

export default DayView;
