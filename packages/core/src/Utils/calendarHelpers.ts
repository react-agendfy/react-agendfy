import { EventProps } from "../types/types";

export const defaultResource = {
    id: "default",
    name: "Geral",
  };

  export function normalizeEvents(events: EventProps[]): EventProps[] {
    return events.map((event) => {
      if (!event.resources || event.resources.length === 0) {
        return { ...event, resources: [defaultResource] };
      }
      return event;
    });
  }

  export function filterEvents(
    events: EventProps[],
    localFilteredResources: (string | number)[]
  ): EventProps[] {
    return events.filter((event) => {
      if (!event.resources) {
        return localFilteredResources.length === 0;
      }
      return (
        localFilteredResources.length === 0 ||
        event.resources.some((resource: { id: string | number }) =>
          localFilteredResources.includes(resource.id)
        )
      );
    });
  }
  