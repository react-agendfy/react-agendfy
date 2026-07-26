import React from "react";
import { TZDate } from "@date-fns/tz";
import { format, parseISO } from "date-fns";
import generateTooltipContent from "../../../Utils/generateTooltipContent";
import ResourceDisplay from "../../../Components/Resource/ResourceDisplay";
import { ListEventProps } from "../../../types/types";
import { getContrastText } from "../../../Utils/colorContrast";


export const ListEvent = ({ event, onEventClick, currentDate, config }: ListEventProps) => {
  const tooltipContent = generateTooltipContent(event, false, true, true);

  return (
    <div
      data-testid="list-event-container"
      className="react-agendfy-listevent-container"
      style={{ backgroundColor: event.color, color: getContrastText(event.color) }}
      title={tooltipContent}
      onClick={() => onEventClick && onEventClick(event)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onEventClick && onEventClick(event); } }}
      role="button"
      tabIndex={0}
      aria-label={`Event: ${event.title}, from ${format(new TZDate(parseISO(event.start.toString()), config?.timeZone!), "HH:mm")} to ${format(new TZDate(parseISO(event.end.toString()), config?.timeZone!), "HH:mm")}`}
    >
      <div className="react-agendfy-listevent-content">
        <span className="react-agendfy-listevent-title">{event.title}</span>
        <span className="react-agendfy-listevent-time">
          {format(new TZDate(parseISO(event.start.toString()), config?.timeZone!), "HH:mm")} -{" "}
          {format(new TZDate(parseISO(event.end.toString()), config?.timeZone!), "HH:mm")}
        </span>
      </div>
      {event.resources && event.resources.length > 0 && (
        <div className="react-agendfy-listevent-resource">
          <ResourceDisplay resources={event.resources} maxVisible={2} />
        </div>
      )}
    </div>
  );
};
