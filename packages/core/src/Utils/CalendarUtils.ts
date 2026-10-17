import { EventProps, Config } from "../types/types";
import { filterEvents } from "../Utils/calendarHelpers";

export const updateEventsList = (
  currentEvents: EventProps[],
  updatedEvent: EventProps | EventProps[]
): EventProps[] => {
  if (Array.isArray(updatedEvent)) {
    return updatedEvent;
  }
  if (updatedEvent && typeof updatedEvent === "object") {
    return currentEvents.map((event) =>
      event.id === updatedEvent.id ? updatedEvent : event
    );
  }
  return currentEvents;
};

export const getFilteredEventsList = (
  normalizedEvents: EventProps[],
  localFilteredResources: string[],
  pluginFilteredEvents: EventProps[],
  pluginSearchResults: EventProps[],
  isSearchActive: boolean
): EventProps[] => {
  // Plugin filter/search results only decide WHICH events show (by id); the
  // events themselves always come from the live list. Returning the plugin
  // copies (as before) froze them at the last sync, so an optimistic move
  // or resize never showed until the host re-sent the events.
  const filteredByResource = filterEvents(normalizedEvents, localFilteredResources);
  const pluginIds = new Set(pluginFilteredEvents.map((e) => e.id));
  const filteredByPlugin = filteredByResource.filter((event: EventProps) => pluginIds.has(event.id));
  if (!isSearchActive) return filteredByPlugin;
  const searchIds = new Set(pluginSearchResults.map((e) => e.id));
  return filteredByPlugin.filter((event: EventProps) => searchIds.has(event.id));
}
