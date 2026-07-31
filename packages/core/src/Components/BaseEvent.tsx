import React from "react";
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import generateTooltipContent from "../Utils/generateTooltipContent";
import ResourceDisplay from "./Resource/ResourceDisplay";
import { BaseEventProps } from "../types/types";
import { TZDate } from "@date-fns/tz";
import { getContrastText } from "../Utils/colorContrast";

const BaseEvent = ({
  event,
  onEventClick,
  positionStyle = {},
  isPreview = false,
  isMultiDay = false,
  isStart = false,
  isEnd = false,
  config,
  dayDate,
  isDraggable = true,
  customClassName = "",
}: BaseEventProps) => {
  const dragId = isMultiDay ? event.originalEventId || event.id : event.id;
  // Hooks must be called unconditionally (Rules of Hooks). Gate the drag behavior
  // through the `disabled` option instead of conditionally calling the hook.
  const draggableProps = useDraggable({
    id: dragId,
    data: {
      event,
      isMultiDay,
      isStart,
      isMiddle: isMultiDay && !isStart && !isEnd,
      isEnd,
    },
    disabled: !isDraggable,
  });

  const { setNodeRef, transform, isDragging } = draggableProps;
  const attributes = isDraggable ? draggableProps.attributes : {};
  const listeners = isDraggable ? draggableProps.listeners : {};

  let computedTop = positionStyle.top || "0";
  let computedHeight = positionStyle.height;

  if (computedHeight === undefined || computedHeight === null) {
    if (isMultiDay && dayDate) {
      const dayStart = startOfDay(new TZDate(dayDate, config?.timeZone));
      const dayEnd = endOfDay(new TZDate(dayDate, config?.timeZone));
      const actualStart = new TZDate(parseISO(event.start.toString()), config?.timeZone);
      const actualEnd = new TZDate(parseISO(event.end.toString()), config?.timeZone);
      const effectiveStart = isStart ? actualStart : dayStart;
      const effectiveEnd = isEnd ? actualEnd : dayEnd;
      computedHeight =
        (differenceInMinutes(effectiveEnd, effectiveStart) / config?.slotDuration!) * 40;
      computedTop =
        isStart
          ? `${(differenceInMinutes(actualStart, dayStart) / config?.slotDuration!) * 40}px`
          : "0";
    } else {
      computedHeight =
        (differenceInMinutes(
          new TZDate(parseISO(event.end.toString()), config?.timeZone),
          new TZDate(parseISO(event.start.toString()), config?.timeZone)
        ) / config?.slotDuration!) * 40;
    }

    if (typeof computedHeight === "number") {
      computedHeight = `${computedHeight}px`;
    }
  }

  const eventStyle: React.CSSProperties = {
    ...positionStyle,
    width: "100%",
    // Only translate when THIS instance owns the drag. dnd-kit activates
    // `transform` by draggable id, so a wrapped/disabled instance sharing the
    // id of an active drag would otherwise apply a second translate3d and the
    // event would drift away from the pointer (2x movement).
    transform:
      isDraggable && transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
    position: "absolute",
    top: computedTop,
    height: computedHeight,
    opacity: isDraggable && isDragging ? 0.8 : 1,
    boxShadow: isDraggable && isDragging ? "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" : "none",
    backgroundColor: event.color,
    color: getContrastText(event.color),
  };

  // Auto-contrast foreground (was hardcoded white). Removed the trailing
  // "\b" backspace char that was a pure display artifact.
  const displayTitle = event.title;
  const tooltipContent = generateTooltipContent(event, isMultiDay, isStart, isEnd, config);

  const startLabel = format(new TZDate(parseISO(event.start.toString()), config?.timeZone), "HH:mm");
  const endLabel = format(new TZDate(parseISO(event.end.toString()), config?.timeZone), "HH:mm");

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={eventStyle}
      className={`react-agendfy-baseevent ${isPreview ? "react-agendfy-baseevent--preview" : ""} ${customClassName}`}
      title={tooltipContent}
      role="button"
      tabIndex={0}
      aria-label={`${displayTitle}, ${startLabel} - ${endLabel}`}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          // Enter activates the event (click); Space is left to dnd-kit's
          // KeyboardSensor so keyboard drags stay available on draggables.
          e.preventDefault();
          e.stopPropagation();
          if (!isDragging && onEventClick) onEventClick(event);
          return;
        }
        if (e.key === " " && !isDraggable) {
          e.preventDefault();
          e.stopPropagation();
          if (!isDragging && onEventClick) onEventClick(event);
          return;
        }
        if (isDraggable) (listeners as any)?.onKeyDown?.(e);
      }}
      onClick={(e) => {
        if (!isDragging && onEventClick) onEventClick(event);
        e.stopPropagation();
      }}
    >
      <div
        className="react-agendfy-baseevent__time"
        style={{ color: 'inherit' }}
      >
        {displayTitle}{" "}
        {format(new TZDate(parseISO(event.start.toString()), config?.timeZone), "HH:mm")} -{" "}
        {format(new TZDate(parseISO(event.end.toString()), config?.timeZone), "HH:mm")}
      </div>
      <ResourceDisplay resources={event.resources} maxVisible={2} />
    </div>
  );
};

export default BaseEvent;
