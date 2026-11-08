import React, { CSSProperties, ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { EventProps } from "../types/types";
import { cx } from "../context/ClassNamesContext";
import type { ExternalDragData } from "../Utils/externalDrag";

/*
 * Items dragged into the calendar from outside it (RFC 001, layer 2) — a
 * list of pending appointments, a backlog. They must share the calendar's
 * DndContext: wrap both in <AgendfyDndProvider>.
 */

export interface ExternalDraggableProps {
  /** Unique among the external items. */
  id: string;
  /** The event to create: title, color, resources… (start/end come from the drop). */
  event: Partial<EventProps> & { title: string };
  /** Minutes. Default 60. */
  duration?: number;
  /**
   * Month view: "HH:mm" start time of the created event. Without it a drop
   * on a day creates an all-day event (FullCalendar's behaviour).
   */
  startTime?: string;
  /** Handed back as the second argument of `onEventReceive`. */
  data?: unknown;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const EXTERNAL_PREFIX = "agendfy-external:";

/** A draggable item outside the calendar that becomes an event when dropped on it. */
export const ExternalDraggable = ({
  id,
  event,
  duration = 60,
  startTime,
  data,
  disabled = false,
  className,
  style,
  children,
}: ExternalDraggableProps) => {
  const external: ExternalDragData = { id, template: event, duration, startTime, data };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${EXTERNAL_PREFIX}${id}`,
    data: { external },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cx("react-agendfy-external", isDragging && "react-agendfy-external--dragging", className)}
      style={{ touchAction: "none", ...style }}
      data-external-id={id}
    >
      {children}
    </div>
  );
};

export default ExternalDraggable;
