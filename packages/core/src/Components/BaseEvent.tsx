import React from "react";
import { format, parseISO, differenceInMinutes, startOfDay, endOfDay } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import generateTooltipContent from "../Utils/generateTooltipContent";
import ResourceDisplay from "./Resource/ResourceDisplay";
import { BaseEventProps } from "../types/types";
import { TZDate } from "@date-fns/tz";
import { getContrastText } from "../Utils/colorContrast";
import { useEventContent } from "../context/EventContentContext";
import { formatEventTime } from "../Utils/displayOptions";

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

  const { setNodeRef, isDragging } = draggableProps;
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
    // Honour the layout width (day view overlap columns); full width otherwise.
    width: positionStyle.width ?? "100%",
    // Only translate when THIS instance owns the drag. dnd-kit activates
    // `transform` by draggable id, so a wrapped/disabled instance sharing the
    // id of an active drag would otherwise apply a second translate3d and the
    // event would drift away from the pointer (2x movement).
    // While dragging, the moving copy is the view's DragOverlay; this
    // element stays in place as a faint ghost (it never translates, so it
    // cannot slide underneath neighbouring events).
    position: "absolute",
    top: computedTop,
    height: computedHeight,
    opacity: isDraggable && isDragging ? 0.35 : 1,
    backgroundColor: event.color,
    color: getContrastText(event.color),
  };

  // Auto-contrast foreground (was hardcoded white). Removed the trailing
  // "\b" backspace char that was a pure display artifact.
  const displayTitle = event.title;
  const tooltipContent = generateTooltipContent(event, isMultiDay, isStart, isEnd, config);

  // Views pass the resolved config, whose defaultView is the active view.
  const customContent = useEventContent(event, config?.defaultView ?? "week", {
    config,
    isStart: !isMultiDay || isStart,
    isEnd: !isMultiDay || isEnd,
  });

  const startLabel = formatEventTime(parseISO(event.start.toString()), config);
  const endLabel = formatEventTime(parseISO(event.end.toString()), config);

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
      {customContent ?? (
        <>
          <div
            className="react-agendfy-baseevent__time"
            style={{ color: 'inherit' }}
          >
            {displayTitle}{" "}
            {startLabel} - {endLabel}
          </div>
          <ResourceDisplay resources={event.resources} maxVisible={2} />
        </>
      )}
    </div>
  );
};

export default BaseEvent;
