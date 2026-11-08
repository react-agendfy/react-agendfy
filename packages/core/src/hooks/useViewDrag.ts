import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { EventProps } from "../types/types";

/*
 * Drag primitives for custom views (RFC 001, layer 2). Mark events with
 * useEventDraggable and targets with useDropZone; the calendar handles the
 * rest (preview, live validation, click vs drag, moving between resources,
 * items dropped from outside).
 */

/** Where an event lands when dropped on a zone. */
export interface DropZoneTarget {
  /** Start of the zone: the dropped event starts here (keeping its duration). */
  date: Date;
  /** A day zone: the event becomes all-day (external items use their `startTime`). */
  allDay?: boolean;
  /** The event moves to these resources (a resource row/column). */
  resourceIds?: (string | number)[];
}

const ZONE_PREFIX = "agendfy-zone:";

/** Makes an element a drop target. Spread nothing: just attach `setNodeRef`. */
export function useDropZone(id: string, target: DropZoneTarget, options: { disabled?: boolean } = {}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${ZONE_PREFIX}${id}`,
    data: { zone: target },
    disabled: options.disabled,
  });
  return { setNodeRef, isOver };
}

/**
 * Makes an element drag `event`. Spread `attributes` and `listeners` on it
 * and attach `setNodeRef`; `isDragging` is true for the original while its
 * preview follows the pointer.
 */
export function useEventDraggable(
  event: EventProps,
  options: {
    disabled?: boolean;
    /** Draggable id, when the event is drawn more than once (default: the event id). */
    id?: string;
    /**
     * The resource this copy is drawn under: dropping it on another
     * resource swaps just that one, keeping the event's other resources.
     */
    resourceId?: string | number;
  } = {}
) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: options.id ?? event.id,
    data: { event, resourceId: options.resourceId },
    disabled: options.disabled,
  });
  return { setNodeRef, attributes, listeners, isDragging };
}
