import { EventProps } from "../types/types";
import { eventResourceIds } from "./resources";

// The resource model lives in ./resources; re-exported for older imports.
export { defaultResource, normalizeEvents } from "./resources";

/** Events on any of `localFilteredResources` (all events when the filter is empty). */
export function filterEvents(events: EventProps[], localFilteredResources: (string | number)[]): EventProps[] {
  if (localFilteredResources.length === 0) return events;
  const wanted = new Set(localFilteredResources.map(String));
  return events.filter((event) => eventResourceIds(event).some((id) => wanted.has(id)));
}
