import React from "react";
import EventRow from "../../../Components/EventRow";
import { ListEventProps } from "../../../types/types";

/** A list-view event: the shared EventRow (time, colour dot, title). */
export const ListEvent = ({ event, onEventClick, config }: ListEventProps) => (
  <EventRow
    event={event}
    config={config}
    view="list"
    onEventClick={onEventClick}
    className="react-agendfy-listevent-container"
    testId="list-event-container"
  />
);
