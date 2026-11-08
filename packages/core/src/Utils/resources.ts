import type { EventProps, Resource } from "../types/types";

/*
 * One way to read an event's resources. The model is `resourceIds` (or
 * `resourceId`); legacy `resources` objects on events still work. For
 * display (icons, tooltips) and the resource filter, normalizeEvents
 * resolves the ids against the calendar's `resources` prop into
 * `event.resources`, marked as derived so they never reach the host.
 */

/** Placeholder for events without resources (kept for older readers of `event.resources`). */
export const defaultResource = {
  id: "default",
  name: "Geral",
};

/** Marks `event.resources` as computed by the calendar, not given by the host. */
export const DERIVED_RESOURCES = "__derivedResources";

const isReal = (r: unknown): r is Resource => !!r && r !== defaultResource && (r as Resource).id !== "default";

/** The event's resource ids: `resourceIds`, else `resourceId`, else legacy `resources` objects. */
export const eventResourceIds = (event: EventProps): string[] => {
  if (Array.isArray(event.resourceIds)) return event.resourceIds.map(String);
  if (event.resourceId !== undefined && event.resourceId !== null) return [String(event.resourceId)];
  if (Array.isArray(event.resources) && !event[DERIVED_RESOURCES]) {
    return event.resources.filter(isReal).map((r: Resource) => String(r.id));
  }
  return [];
};

/** Whether the event carries its own (legacy) `resources` objects. */
export const usesLegacyResources = (event: EventProps): boolean =>
  !event[DERIVED_RESOURCES] &&
  event.resourceIds === undefined &&
  (event.resourceId === undefined || event.resourceId === null) &&
  Array.isArray(event.resources) &&
  event.resources.some(isReal);

/**
 * Events ready for the views: `resources` holds the resource objects to show
 * (resolved from the ids, or the legacy objects), or the placeholder.
 */
export function normalizeEvents(events: EventProps[], all: Resource[] = []): EventProps[] {
  return events.map((event) => {
    if (event[DERIVED_RESOURCES] || usesLegacyResources(event)) return event;
    const ids = eventResourceIds(event);
    const resolved = ids.map((id) => all.find((r) => String(r.id) === id) ?? { id });
    return {
      ...event,
      resources: resolved.length ? resolved : [defaultResource],
      [DERIVED_RESOURCES]: true,
    };
  });
}

/** The event as the host gave it: without the calendar's derived `resources`. */
export const toPublicEvent = (event: EventProps): EventProps => {
  if (!event[DERIVED_RESOURCES]) return event;
  const { [DERIVED_RESOURCES]: _flag, resources: _derived, ...rest } = event;
  return rest as EventProps;
};
