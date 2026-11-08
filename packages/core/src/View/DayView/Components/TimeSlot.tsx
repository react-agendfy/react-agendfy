import React, { useCallback, useMemo } from 'react';
import { useDroppable } from "@dnd-kit/core";
import { EventProps, TimeSlotProps } from "../../../types/types";
import { getSlotTime } from "../../../Utils/slotTime";
import { format, isSameDay } from "date-fns";
import { ensureDate } from "../../../Utils/DateTrannforms";
import { EventItem } from "./EventItem";
import { TZDate } from "@date-fns/tz";
import { computePositionedEvents, layoutPositionStyle } from "../../../Utils/positionedEventsHelper";
import { formatSlotLabel, showsSlotLabel } from "../../../Utils/displayOptions";
import { slotOffsetTop } from "../../../Utils/slotHeight";

export const TimeSlot: React.FC<TimeSlotProps> = ({
  index,
  slotEvents,
  onEventUpdate,
  onSlotClick,
  dayDate,
  slotMin,
  parsedSlotMax,
  config,
  isBusinessHour = false,
  isNonBusiness = false,
  isDraggable = true,
  isDisabled = false,
  dayLayout,
}: TimeSlotProps) => {
  const slotTime = getSlotTime(dayDate, slotMin, config?.slotDuration!, index, config?.timeZone!);
  const { setNodeRef } = useDroppable({ id: slotTime.toISOString(), disabled: isDisabled });

  const handleClickSlot = useCallback(() => {
    if (onSlotClick && !isDisabled) {
      onSlotClick(new TZDate(slotTime, config?.timeZone));
    }
  }, [onSlotClick, slotTime, config?.timeZone, isDisabled]);

  // A start between slot lines sits that far down the slot (slotOffsetTop).
  const positionedEvents: EventProps[] = useMemo(() => {
    if (!dayLayout) {
      return computePositionedEvents(slotEvents, config, true, { marginLeft: "0px" }).map((event) => ({
        ...event,
        positionStyle: { ...event.positionStyle, top: slotOffsetTop(event, slotTime, config) },
      }));
    }
    return (slotEvents || []).map((event) => ({
      ...event,
      positionStyle: {
        top: slotOffsetTop(event, slotTime, config),
        marginLeft: "0px",
        ...layoutPositionStyle(dayLayout.get(String(event.id))),
      },
    }));
  }, [slotEvents, config, dayLayout, slotTime]);

  return (
    <div
      ref={setNodeRef}
      className={`react-agendfy-timeslot-container ${isDisabled ? "react-agendfy-day-disabled" : ""}`}
      onClick={handleClickSlot}
      aria-disabled={isDisabled || undefined}
    >
      {isBusinessHour && <div className="react-agendfy-business-hours" style={{ inset: 0 }} />}
      {isNonBusiness && <div className="react-agendfy-non-business" style={{ inset: 0 }} />}
      <span className="react-agendfy-timeslot-label">
        {showsSlotLabel(index * (config?.slotDuration || 30), config)
          ? formatSlotLabel(new TZDate(slotTime, config?.timeZone), config)
          : ""}
      </span>
      <div className="react-agendfy-timeslot-events">
        {positionedEvents.map((event: EventProps) => {
          const eventStart = ensureDate(event.start, config?.timeZone);
          const eventEnd = ensureDate(event.end, config?.timeZone);
          const isMultiDayEvent = !isSameDay(eventStart, eventEnd);
          const isEventStart = isSameDay(eventStart, dayDate);
          const isEventEnd = isSameDay(eventEnd, dayDate);
          return (
            <EventItem
              key={event.id}
              event={event}
              positionStyle={event.positionStyle}
              onEventUpdate={onEventUpdate}
              isMultiDay={isMultiDayEvent}
              isStart={isEventStart}
              isEnd={isEventEnd}
              config={config}
              dayDate={dayDate}
              parsedSlotMax={parsedSlotMax}
              isDraggable={isDraggable}
            />
          );
        })}
      </div>
    </div>
  );
};
