import { Active, CollisionDetection, pointerWithin } from "@dnd-kit/core";
import { TZDate } from "@date-fns/tz";
import type { EventProps } from "../types/types";

/*
 * Items dragged in from outside the calendar (ExternalDraggable): their drag
 * payload and the event they become when dropped (RFC 001, layer 2).
 */

/** What an external item carries through the drag. */
export interface ExternalDragData {
  id: string;
  template: Partial<EventProps> & { title: string };
  duration: number;
  startTime?: string;
  data?: unknown;
}

/** The external payload of a drag, or null for a calendar event. */
export const externalDragData = (active?: Active | null): ExternalDragData | null =>
  (active?.data?.current?.external as ExternalDragData | undefined) ?? null;

/**
 * An external item is a list row, not an event: its rectangle says nothing
 * about the target, so it lands where the pointer is. Calendar events keep
 * the view's own detection.
 */
export const externalByPointer =
  (fallback: CollisionDetection): CollisionDetection =>
  (args) =>
    args.pointerCoordinates && externalDragData(args.active) ? pointerWithin(args) : fallback(args);

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * The event an external item becomes when dropped at `start`. Timed
 * (start + duration) unless `allDay`. The id is the template's, else derived
 * from the item and the drop time (the host usually replaces it).
 */
export const eventFromExternal = (
  ext: ExternalDragData,
  start: Date,
  { allDay = false }: { allDay?: boolean } = {}
): EventProps => {
  const end = new Date(start.getTime() + (allDay ? DAY : ext.duration * MINUTE));
  return {
    ...ext.template,
    id: ext.template.id ?? `${ext.id}@${start.toISOString()}`,
    title: ext.template.title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
  };
};

/**
 * Month view drop on a day (`day` = the day's midnight in the calendar zone):
 * all-day, or timed at the item's `startTime`.
 */
export const eventFromExternalOnDay = (ext: ExternalDragData, day: Date, timeZone?: string): EventProps => {
  if (!ext.startTime) return eventFromExternal(ext, day, { allDay: true });
  const [h, m] = ext.startTime.split(":").map(Number);
  const start = new TZDate(day.getTime(), timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  start.setHours(h || 0, m || 0, 0, 0);
  return eventFromExternal(ext, new Date(start.getTime()));
};
