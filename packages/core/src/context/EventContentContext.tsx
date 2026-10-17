import React, { createContext, ReactNode, useContext, useMemo } from "react";
import type { Config, EventContentArg, EventContentRenderer, EventProps } from "../types/types";
import type { CalendarPlugin } from "../types/plugins";
import { ensureDate } from "../Utils/DateTrannforms";
import { formatEventTime } from "../Utils/displayOptions";

/*
 * Custom event bodies for every view. Sources, in priority order:
 *   1. the `eventContent` prop on <Calendar>
 *   2. the first `event-rendering` plugin (its component receives the
 *      EventContentArg plus the plugin's own props)
 * Only the inner content is replaced: each view keeps its own frame
 * (positioning, colors, drag & resize).
 */

type Renderer = (arg: EventContentArg) => ReactNode;

const EventContentContext = createContext<Renderer | null>(null);

export const EventContentProvider = ({
  eventContent,
  plugins,
  children,
}: {
  eventContent?: EventContentRenderer;
  plugins: CalendarPlugin[];
  children: ReactNode;
}) => {
  const renderer = useMemo<Renderer | null>(() => {
    if (eventContent) return eventContent;
    const plugin = plugins.find((p) => p.type === "event-rendering" && p.component);
    if (!plugin?.component) return null;
    const Component = plugin.component as React.ComponentType<any>;
    // eslint-disable-next-line react/display-name
    return (arg) => <Component {...arg} {...(plugin.props || {})} />;
  }, [eventContent, plugins]);

  return <EventContentContext.Provider value={renderer}>{children}</EventContentContext.Provider>;
};

/** "start - end" in the calendar time zone, with `eventTimeFormat`. */
export const formatEventTimeText = (event: EventProps, config?: Partial<Config>): string =>
  `${formatEventTime(ensureDate(event.start), config)} - ${formatEventTime(ensureDate(event.end), config)}`;

/**
 * Custom content for `event` in `view`, or null to render the default body.
 * Works outside a provider (views rendered standalone) by returning null.
 */
export const useEventContent = (
  event: EventProps,
  view: EventContentArg["view"],
  options: { config?: Partial<Config>; isStart?: boolean; isEnd?: boolean } = {}
): ReactNode | null => {
  const renderer = useContext(EventContentContext);
  if (!renderer) return null;
  const content = renderer({
    event,
    view,
    timeText: formatEventTimeText(event, options.config),
    isStart: options.isStart ?? true,
    isEnd: options.isEnd ?? true,
  });
  return content === undefined || content === null || content === false ? null : content;
};
