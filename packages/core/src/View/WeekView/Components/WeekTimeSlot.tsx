import React, { memo, useCallback, useMemo } from 'react';
import { TZDate } from "@date-fns/tz";
import { EventProps, TimeSlotProps } from "../../../types/types";
import { WeekEvent } from "./WeekEvent";
import { useDroppable } from "@dnd-kit/core";
import { getSlotTime } from "../../../Utils/slotTime";
import { computePositionedEvents, DayLayoutSlot, layoutPositionStyle } from "../../../Utils/positionedEventsHelper";
import { ensureDate } from "../../../Utils/DateTrannforms";
import { getSlotHeight } from "../../../Utils/slotHeight";

export interface WeekTimeSlotProps extends TimeSlotProps {
  /** Day outside validRange: no click, selection or drop. */
  isDisabled?: boolean;
  /** Column placement for the whole day (see computeDayLayout). */
  dayLayout?: Map<string, DayLayoutSlot>;
  onSelectionMouseDown?: (date: Date) => void;
  onSelectionMouseMove?: (date: Date) => void;
  isSelected?: boolean;
}

export const WeekTimeSlot = memo(
  ({
    index,
    dayDate,
    slotEvents,
    onEventClick,
    onSlotClick,
    onEventResize,
    parsedSlotMax,
    slotMin,
    config,
    isDraggable,
    isDisabled = false,
    dayLayout,
    onSelectionMouseDown,
    onSelectionMouseMove,
    isSelected,
  }: WeekTimeSlotProps) => {
    const slotTime = useMemo(() => {
      const minutes = index * (config?.slotDuration || 30);
      const hour = slotMin + Math.floor(minutes / 60);
      const minute = minutes % 60;
      // Produce a TZDate in the configured timezone so downstream consumers
      // (slot click, droppable id) stay timezone-correct.
      return new TZDate(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, minute, config?.timeZone);
    }, [index, dayDate, slotMin, config?.slotDuration, config?.timeZone]);

    const { setNodeRef, isOver } = useDroppable({ id: slotTime.toISOString(), disabled: isDisabled });

    const handleClickSlot = useCallback(() => {
      if (!isDisabled && typeof onSlotClick === "function") {
        onSlotClick(slotTime);
      }
    }, [onSlotClick, slotTime, isDisabled]);

    const positionedEvents: EventProps[] = useMemo(() => {
      if (!dayLayout) return computePositionedEvents(slotEvents, config);
      return (slotEvents || []).map((event) => ({
        ...event,
        positionStyle: {
          top: "0",
          ...layoutPositionStyle(dayLayout.get(String(event.id))),
          height: `${
            ((ensureDate(event.end).getTime() - ensureDate(event.start).getTime()) / 60000 / (config?.slotDuration || 30)) * getSlotHeight(config)
          }px`,
        },
      }));
    }, [slotEvents, config, dayLayout]);

    const slotClasses = [
      "react-agendfy-weektimeslot",
      isOver && "react-agendfy-bg-green-200",
      isSelected && "react-agendfy-weektimeslot-selected",
    ].filter(Boolean).join(" ");

    return (
      <div
        ref={setNodeRef}
        onMouseDown={isDisabled ? undefined : () => onSelectionMouseDown?.(slotTime)}
        onMouseMove={isDisabled ? undefined : () => onSelectionMouseMove?.(slotTime)}
        onClick={handleClickSlot}
        className={slotClasses}
      >
        {positionedEvents.map((event: EventProps) => (
          <WeekEvent
            key={event.id}
            event={event}
            config={config}
            dayDate={dayDate}
            onEventClick={onEventClick}
            onEventResize={onEventResize}
            positionStyle={event.positionStyle}
            endHour={parsedSlotMax}
            isDraggable={isDraggable}
          />
        ))}
      </div>
    );
  }
);