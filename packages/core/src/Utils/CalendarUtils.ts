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
  pluginFilterIds: Set<EventProps["id"]> | null,
  pluginSearchIds: Set<EventProps["id"]> | null
): EventProps[] => {
  // Plugin filter/search only decide WHICH events show (by id), and only
  // while active (non-null); the events themselves always come from the
  // live list (user events, data sources, optimistic moves).
  let result = filterEvents(normalizedEvents, localFilteredResources);
  if (pluginFilterIds) result = result.filter((event) => pluginFilterIds.has(event.id));
  if (pluginSearchIds) result = result.filter((event) => pluginSearchIds.has(event.id));
  return result;
}
