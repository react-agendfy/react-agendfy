import React, { ReactNode, useRef, useState } from "react";
import { ClientRect, DragEndEvent, DragMoveEvent, DragOverEvent, DragOverlay, DragStartEvent, Over } from "@dnd-kit/core";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import type { Config, EventProps, Resource } from "../types/types";
import { usesLegacyResources } from "../Utils/resources";
import {
  ViewDndScope,
  type DragSnapshot,
  type DropResolution,
  type ViewDragHandlers,
  type ViewDragOptions,
} from "../context/InteractionContext";
import { useDropVerdict } from "../hooks/useDropVerdict";
import type { DropZoneTarget } from "../hooks/useViewDrag";
import { eventFromExternal, eventFromExternalOnDay, externalDragData } from "../Utils/externalDrag";
import { pointerOrTopLeft } from "../Utils/collision";
import { getDayRules } from "../Utils/calendarRange";
import DragPreview from "./DragPreview";

/*
 * Drag handling for custom views (RFC 001, layer 2). The view marks events
 * (useEventDraggable) and targets (useDropZone); this scope turns a drop on a
 * zone into a move — keeping the duration, switching resources — or into a
 * received event for an ExternalDraggable, with the live preview of the
 * built-in views.
 */

// Drags start after 5px, so a plain click on an event stays a click.
const CUSTOM_DRAG: ViewDragOptions = {
  collisionDetection: pointerOrTopLeft,
  activationConstraint: { distance: 5 },
  instructions:
    "To pick up a draggable event, press space or enter. Use the arrow keys to move it, then press space or enter again to drop, or press escape to cancel.",
};

const HOUR = 3_600_000;

/**
 * `event` moved to `resourceIds`, in the field(s) the event already uses:
 * `resourceId` for one, `resourceIds` otherwise, and the legacy `resources`
 * objects when the event has real ones (the resource filter reads them).
 */
const assignResources = (event: EventProps, ids: (string | number)[], all: Resource[]): EventProps => {
  let next: EventProps;
  if (ids.length === 1 && event.resourceIds === undefined) next = { ...event, resourceId: ids[0] };
  else {
    const { resourceId: _single, ...rest } = event;
    next = { ...rest, resourceIds: [...ids] } as EventProps;
  }
  if (usesLegacyResources(event)) next.resources = ids.map((id) => all.find((r) => String(r.id) === String(id)) ?? { id });
  return next;
};

type Rect = Pick<ClientRect, "top" | "bottom" | "left" | "right">;
/** The zone a keyboard drag is on: its droppable id, rect and target. */
interface KeyboardZone {
  id: string | number;
  rect: ClientRect;
  zone: DropZoneTarget;
}

/**
 * Keyboard drags jump from zone to zone: ↑↓ to the nearest zone above or
 * below in the same column, ←→ to the nearest in the same row. They start
 * from the zone the last key reached (dnd-kit's measured rect can lag a key
 * behind, or be missing on the first one), else from the dragged element.
 */
const nextKeyboardZone = (
  direction: Parameters<NonNullable<ViewDragHandlers["keyboardTarget"]>>[0],
  { context }: Parameters<NonNullable<ViewDragHandlers["keyboardTarget"]>>[1],
  from: KeyboardZone | null
): KeyboardZone | undefined => {
  const zones: KeyboardZone[] = [];
  for (const c of context.droppableContainers.getEnabled()) {
    const zone = c.data.current?.zone as DropZoneTarget | undefined;
    const rect = context.droppableRects.get(c.id);
    if (zone && rect) zones.push({ id: c.id, rect, zone });
  }
  const start = context.collisionRect ?? context.activeNode?.getBoundingClientRect() ?? null;
  const px = from ? from.rect.left + 1 : (start?.left ?? 0) + 1;
  const py = from ? from.rect.top + 1 : (start?.top ?? 0) + 1;
  const current: Rect =
    from?.rect ??
    zones.find(({ rect: r }) => r.left <= px && px < r.right && r.top <= py && py < r.bottom)?.rect ?? {
      top: py,
      bottom: py,
      left: px,
      right: px,
    };
  let best: KeyboardZone | undefined;
  let bestDistance = Infinity;
  for (const candidate of zones) {
    const r = candidate.rect;
    const sameColumn = r.left <= px && px < r.right;
    const sameRow = r.top <= py && py < r.bottom;
    const distance =
      direction === "down" && sameColumn && r.top >= current.bottom - 0.5
        ? r.top - current.bottom
        : direction === "up" && sameColumn && r.bottom <= current.top + 0.5
          ? current.top - r.bottom
          : direction === "right" && sameRow && r.left >= current.right - 0.5
            ? r.left - current.right
            : direction === "left" && sameRow && r.right <= current.left + 0.5
              ? current.left - r.right
              : Infinity;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
};

const zoneOf = (snapshot: DragSnapshot) => snapshot.over?.data?.current?.zone as DropZoneTarget | undefined;

export const CustomViewDnd = ({
  config,
  resources = [],
  onEventUpdate,
  onEventReceive,
  onEventClick,
  children,
}: {
  config: Config;
  resources?: Resource[];
  onEventUpdate?: (event: EventProps) => void;
  onEventReceive?: (event: EventProps, data?: unknown) => void;
  onEventClick?: (event: EventProps) => void;
  children: ReactNode;
}) => {
  const [active, setActive] = useState<EventProps | null>(null);
  const lastDragRef = useRef<DragSnapshot | null>(null);
  const keyboardZoneRef = useRef<KeyboardZone | null>(null);
  const { verdict, check, clear } = useDropVerdict();
  const tz = config.timeZone;

  const resolveDrop = (snapshot: DragSnapshot): DropResolution | null => {
    const found = zoneOf(snapshot);
    if (!found || getDayRules(config).isDisabled(found.date)) return null;
    let zone: DropZoneTarget = found;
    const place = (event: EventProps) =>
      zone.resourceIds ? assignResources(event, zone.resourceIds, resources) : event;

    const external = externalDragData(snapshot.active);
    if (external) {
      if (!onEventReceive) return null;
      const created = zone.allDay ? eventFromExternalOnDay(external, zone.date, tz) : eventFromExternal(external, zone.date);
      return { updated: place(created), external };
    }

    const dragged = snapshot.active.data.current?.event as EventProps | undefined;
    if (!dragged || !onEventUpdate) return null;
    // Dragged from one of several resources: swap only that one.
    const from = snapshot.active.data.current?.resourceId as string | number | undefined;
    const target = zone.resourceIds;
    const raw: (string | number)[] = dragged.resourceIds ?? (dragged.resourceId != null ? [dragged.resourceId] : []);
    if (from !== undefined && target?.length === 1 && raw.length > 1) {
      const swapped = raw.map((id) => (String(id) === String(from) ? target[0] : id));
      const unique = swapped.filter((id, i) => swapped.findIndex((x) => String(x) === String(id)) === i);
      zone = { ...zone, resourceIds: unique };
    }
    const start = new Date(dragged.start).getTime();
    const duration = Math.max(0, new Date(dragged.end).getTime() - start);
    let updated: EventProps;
    if (zone.allDay) {
      // All-day events keep their number of days; a timed one becomes one day.
      const days = dragged.allDay ? Math.max(1, Math.round(duration / (24 * HOUR))) : 1;
      const end = addDays(new TZDate(zone.date, tz), days);
      updated = { ...dragged, start: zone.date.toISOString(), end: new Date(end.getTime()).toISOString(), allDay: true };
    } else {
      // A timed zone keeps the duration; an all-day event becomes one hour.
      const length = dragged.allDay ? HOUR : duration;
      updated = {
        ...dragged,
        start: zone.date.toISOString(),
        end: new Date(zone.date.getTime() + length).toISOString(),
        allDay: false,
      };
    }
    return { dragged, updated: place(updated) };
  };

  /** A keyboard drag drops on the zone its keys reached (dnd-kit's `over` can lag). */
  const withKeyboardZone = <T extends DragSnapshot>(snapshot: T): T => {
    const kz = keyboardZoneRef.current;
    if (!kz) return snapshot;
    const over: Over = { id: kz.id, rect: kz.rect, disabled: false, data: { current: { zone: kz.zone } } };
    return { ...snapshot, over };
  };

  const handleDragStart = (event: DragStartEvent) => {
    lastDragRef.current = event;
    keyboardZoneRef.current = null;
    clear();
    const external = externalDragData(event.active);
    if (external) {
      setActive(onEventReceive ? eventFromExternal(external, new Date()) : null);
      return;
    }
    setActive((event.active.data.current?.event as EventProps | undefined) ?? null);
  };

  const handleDragMove = (event: DragMoveEvent | DragOverEvent | DragSnapshot) => {
    lastDragRef.current = event;
    const result = resolveDrop(withKeyboardZone(event));
    check(result?.updated ?? null, result?.dragged, result?.external ? "receive" : "move");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const result = resolveDrop(withKeyboardZone(event));
    keyboardZoneRef.current = null;
    setActive(null);
    clear();
    const dragged = event.active.data.current?.event as EventProps | undefined;
    if (dragged && Math.abs(event.delta.x) < 5 && Math.abs(event.delta.y) < 5) {
      onEventClick?.(dragged);
      return;
    }
    if (!result) return;
    if (result.external) onEventReceive?.(result.updated, result.external.data);
    else onEventUpdate?.(result.updated);
  };

  const handleDragCancel = () => {
    keyboardZoneRef.current = null;
    setActive(null);
    clear();
  };

  const keyboardTarget: NonNullable<ViewDragHandlers["keyboardTarget"]> = (direction, args) => {
    const next = nextKeyboardZone(direction, args, keyboardZoneRef.current);
    if (!next) return undefined;
    keyboardZoneRef.current = next;
    // Validate now: the move may scroll instead of firing onDragMove.
    if (lastDragRef.current) handleDragMove(lastDragRef.current);
    return { x: next.rect.left, y: next.rect.top };
  };

  return (
    <ViewDndScope
      handlers={{
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragOver: handleDragMove,
        onDragEnd: handleDragEnd,
        onDragCancel: handleDragCancel,
        keyboardTarget,
      }}
      options={CUSTOM_DRAG}
    >
      {children}
      <DragOverlay dropAnimation={null} zIndex={1000}>
        {active && <DragPreview event={active} config={config} invalid={verdict} />}
      </DragOverlay>
    </ViewDndScope>
  );
};

export default CustomViewDnd;
