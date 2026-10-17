import React from "react";
import { TZDate } from "@date-fns/tz";
import { format, parseISO } from "date-fns";
import generateTooltipContent from "../../../Utils/generateTooltipContent";
import ResourceDisplay from "../../../Components/Resource/ResourceDisplay";
import { ListEventProps } from "../../../types/types";
import { getContrastText } from "../../../Utils/colorContrast";
import { useEventContent } from "../../../context/EventContentContext";
import { formatEventTime } from "../../../Utils/displayOptions";


export const ListEvent = ({ event, onEventClick, currentDate, config }: ListEventProps) => {
  const tooltipContent = generateTooltipContent(event, false, true, true, config);
  const customContent = useEventContent(event, "list", { config });
  const startLabel = formatEventTime(parseISO(event.start.toString()), config);
  const endLabel = formatEventTime(parseISO(event.end.toString()), config);

  return (
    <div
      data-testid="list-event-container"
      className="react-agendfy-listevent-container"
      style={{ backgroundColor: event.color, color: getContrastText(event.color) }}
      title={tooltipContent}
      onClick={() => onEventClick?.(event)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onEventClick?.(event); } }}
      role="button"
      tabIndex={0}
      aria-label={`Event: ${event.title}, from ${startLabel} to ${endLabel}`}
    >
      {customContent ?? (
        <>
          <div className="react-agendfy-listevent-content">
            <span className="react-agendfy-listevent-title">{event.title}</span>
            <span className="react-agendfy-listevent-time">
              {startLabel} - {endLabel}
            </span>
          </div>
          {event.resources && event.resources.length > 0 && (
            <div className="react-agendfy-listevent-resource">
              <ResourceDisplay resources={event.resources} maxVisible={2} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
