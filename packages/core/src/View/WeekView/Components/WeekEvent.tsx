import React from 'react';
import { Resizable } from "re-resizable";
import { addDays, addMinutes, isAfter, isSameDay, subDays } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import {  TZDate } from '@date-fns/tz';
import { ensureDate } from "../../../Utils/DateTrannforms";
import BaseEvent from "../../../Components/BaseEvent";
import { getSlotHeight } from "../../../Utils/slotHeight";
import { BaseEventProps } from "../../../types/types";

export const WeekEvent = ({
  event,
  onEventClick,
  positionStyle,
  onEventResize,
  config,
  isMultiDay,
  isStart,
  isEnd,
  dayDate,
  isDraggable,
  endHour,
}: BaseEventProps & { endHour: number }) => {
  const dayWidth = 100;

  // Segment metadata (see clipEventToDay): a timed event crossing midnight
  // renders as one clipped segment per day. The START segment owns dragging
  // (whole-event move); only the segment containing the REAL end exposes the
  // bottom/right resize handles.
  const segment = (event as any).__segment as
    | { isStart: boolean; isEnd: boolean; originalStart: string; originalEnd: string }
    | undefined;
  const isSegmentStart = !segment || segment.isStart;
  const isSegmentEnd = !segment || segment.isEnd;
  const canDrag = !!isDraggable && isSegmentStart;

  const [size, setSize] = useState({
    height: positionStyle?.height,
    width: positionStyle?.width,
  });

  useEffect(() => {
    setSize({
      width: positionStyle?.width,
      height: positionStyle?.height,
    });
  }, [positionStyle?.width, positionStyle?.height, isMultiDay]);

  const handleResize = (e: any, direction: any, ref: any, delta: any) => {
    if (!isDraggable || !onEventResize) return;

    // Resize always operates on the event's TRUE bounds. For a clipped
    // segment, event.start/end are the day-window bounds (e.g. 00:00 on a
    // continuation) — emitting those would corrupt the event.
    const eventStart = ensureDate(segment?.originalStart ?? event.start, config?.timeZone);
    const eventEnd = ensureDate(segment?.originalEnd ?? event.end, config?.timeZone);

    // Emit canonical UTC ISO + recompute the multiday flag from the actual
    // span, so extending across midnight sets it and shrinking back clears it.
    const emit = (start: Date, end: Date) => {
      const spansDays = !isSameDay(
        new TZDate(start, config?.timeZone),
        new TZDate(end, config?.timeZone)
      );
      // Strip segment metadata and restore the original event id — the
      // emitted object is the REAL event, never a rendering segment.
      const { __segment: _segmentMeta, ...cleanEvent } = event as any;
      onEventResize({
        ...cleanEvent,
        id: String(event.id).replace(/::cont$/, ""),
        start: new Date(start.getTime()).toISOString(),
        end: new Date(end.getTime()).toISOString(),
        isMultiDay: spansDays,
      });
    };

    if (direction === "bottom") {
      const additionalMinutes = Math.round((delta.height / getSlotHeight(config)) * config?.slotDuration!);
      const newEndTime = addMinutes(eventEnd, additionalMinutes);
      // The day boundary is the REAL midnight in the configured timezone —
      // crossing it simply keeps the computed end and flags the event as
      // multiday (no clamp: extending into the next day is a supported
      // interaction, e.g. 22:00 → 01:00).
      if (isAfter(newEndTime, eventStart)) {
        emit(eventStart, newEndTime);
      }
      return;
    }

    // Horizontal handles step in whole days. Measure the real column width
    // from the DOM (the resizable sits inside a day column) instead of
    // assuming 100px — otherwise the day count is wrong for any other
    // column width. Negative deltas shrink the span back.
    const columnWidth = ref?.parentElement?.offsetWidth || dayWidth;

    if (direction === "right") {
      const daysDelta = Math.round(delta.width / columnWidth);
      if (daysDelta !== 0) {
        const newEnd = addDays(eventEnd, daysDelta);
        if (isAfter(newEnd, eventStart)) emit(eventStart, newEnd);
      }
      return;
    }

    if (direction === "left") {
      const daysDelta = Math.round(delta.width / columnWidth);
      if (daysDelta !== 0) {
        const newStart = subDays(eventStart, daysDelta);
        if (isAfter(eventEnd, newStart)) emit(newStart, eventEnd);
      }
    }
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
    disabled: !canDrag,
  });

  // Apply the drag translate only when THIS segment owns the drag —
  // continuation segments have a distinct id (<id>::cont) AND are disabled,
  // so they must never move with an active drag of the start segment.
  // The moving copy lives in WeekView's DragOverlay; the original stays put
  // as a faint ghost so neighbours keep their layout during the drag.
  const style = canDrag && isDragging ? { opacity: 0.35 } : undefined;

  return (
    <Resizable
      size={size}
      // Only the segment containing the event's REAL end exposes end-side
      // handles; a start segment of a midnight-crossing event ends at the
      // day boundary, which is not a resizable edge.
      // Resize handles only when resizing is enabled (onEventResize given).
      enable={{ top: false, right: !!onEventResize && isSegmentEnd, bottom: !!onEventResize && isSegmentEnd, left: false }}
      onResizeStop={handleResize}
      handleStyles={{
        top: { cursor: 'ns-resize' },
        bottom: { 
          cursor: 'ns-resize',
          zIndex: 1000,
         },
      }}
      style={{
        top: positionStyle?.top || "0",
        bottom: positionStyle?.bottom || "0",
        left: positionStyle?.left || "0",
        height: positionStyle?.height || "0",
        width: positionStyle?.width || "0",
        position: "absolute",
        zIndex: 20,
        // No maxWidth clamp: like the old maxHeight, it silently blocked the
        // RIGHT resize handle — delta.width could never reach a full column,
        // so extending an event by N days horizontally was impossible even
        // though handleResize supports it (e.g. one gesture: +5 days).
        ...style,
      }}
      /* No maxHeight clamp: it used to stop the bottom handle exactly at the
         end of the day, making extension past midnight (multiday conversion
         in handleResize) physically unreachable. */
    >
      <div ref={setNodeRef}
                style={{ width: "100%", height: "100%" }}
      {...listeners} {...attributes}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onEventClick?.(event);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onMouseMove={(e) => {
            e.stopPropagation();
          }}
        >
          <BaseEvent
            event={event}
            onEventClick={onEventClick}
            positionStyle={{ width: "100%",  height: "100%", top: "0", left: "0" }}
            config={config}
            isMultiDay={isMultiDay || !!segment}
            isStart={segment ? segment.isStart : isStart}
            isEnd={segment ? segment.isEnd : isEnd}
            dayDate={dayDate}
            // WeekEvent owns the drag (setNodeRef/listeners/transform above).
            // The inner BaseEvent must NOT register a second draggable with
            // the same id — dnd-kit activates transforms by id, so both
            // layers would translate and the event would drift away from the
            // pointer at 2x speed while dragging.
            isDraggable={false}
            customClassName=""
            parsedSlotMax={endHour}
          />
        </div>
      </div>
    </Resizable>
  );
};