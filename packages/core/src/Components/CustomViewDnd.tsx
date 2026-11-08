import React, { ReactNode, useRef, useState } from "react";
import { DragEndEvent, DragMoveEvent, DragOverEvent, DragOverlay, DragStartEvent } from "@dnd-kit/core";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import type { Config, EventProps, Resource } from "../types/types";
import { defaultResource } from "../Utils/calendarHelpers";
import { ViewDndScope, type DragSnapshot, type DropResolution, type ViewDragOptions } from "../context/InteractionContext";
import { useDropVerdict } from "../hooks/useDropVerdict";
import type { DropZoneTarget } from "../hooks/useViewDrag";
import { eventFromExternal, eventFromExternalOnDay, externalDragData } from "../Utils/externalDrag";
import { pointerOrRect } from "../Utils/collision";
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
  collisionDetection: pointerOrRect,
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
  const legacy = Array.isArray(event.resources) && event.resources.some((r: unknown) => r && r !== defaultResource);
  if (legacy) next.resources = ids.map((id) => all.find((r) => String(r.id) === String(id)) ?? { id });
  return next;
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
  const { verdict, check, clear } = useDropVerdict();
  const tz = config.timeZone;

  const resolveDrop = (snapshot: DragSnapshot): DropResolution | null => {
    const zone = zoneOf(snapshot);
    if (!zone || getDayRules(config).isDisabled(zone.date)) return null;
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

  const handleDragStart = (event: DragStartEvent) => {
    lastDragRef.current = event;
    clear();
    const external = externalDragData(event.active);
    if (external) {
      setActive(onEventReceive ? eventFromExternal(external, new Date()) : null);
      return;
    }
    setActive((event.active.data.current?.event as EventProps | undefined) ?? null);
  };

  const handleDragMove = (event: DragMoveEvent | DragOverEvent) => {
    lastDragRef.current = event;
    const result = resolveDrop(event);
    check(result?.updated ?? null, result?.dragged, result?.external ? "receive" : "move");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const result = resolveDrop(event);
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
    setActive(null);
    clear();
  };

  return (
    <ViewDndScope
      handlers={{
        onDragStart: handleDragStart,
        onDragMove: handleDragMove,
        onDragOver: handleDragMove,
        onDragEnd: handleDragEnd,
        onDragCancel: handleDragCancel,
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
