import React from "react";
import { addDays, addMonths, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { TZDate } from "@date-fns/tz";
import type { ViewPlugin } from "@react-agendfy/core";
import Timeline, { type TimelineOptions, type TimelineZoom } from "./Timeline";
import { messages } from "./messages";
import "./timeline.css";

export type { TimelineOptions, TimelineZoom };

const ranges: Record<TimelineZoom, NonNullable<ViewPlugin["range"]>> = {
  day: (date, { timeZone }) => {
    const start = startOfDay(new TZDate(date.getTime(), timeZone));
    return { start: new Date(start.getTime()), end: new Date(addDays(start, 1).getTime()) };
  },
  week: (date, { timeZone, weekStartsOn }) => {
    const start = startOfWeek(new TZDate(date.getTime(), timeZone), { weekStartsOn });
    return { start: new Date(start.getTime()), end: new Date(addDays(start, 7).getTime()) };
  },
  month: (date, { timeZone }) => {
    const start = startOfMonth(new TZDate(date.getTime(), timeZone));
    return { start: new Date(start.getTime()), end: new Date(addMonths(start, 1).getTime()) };
  },
};

const VIEW_NAMES: Record<TimelineZoom, string> = { day: "timelineDay", week: "timelineWeek", month: "timelineMonth" };

/**
 * The timeline views (timelineDay, timelineWeek, timelineMonth) with your
 * options. Pass them to `plugins`; they need `resources` on the calendar.
 */
export function createTimelinePlugins(options: TimelineOptions = {}): ViewPlugin[] {
  return (["day", "week", "month"] as const).map((zoom) => {
    const View = () => <Timeline zoom={zoom} options={options} />;
    View.displayName = `Timeline(${zoom})`;
    return {
      key: `timeline-${zoom}`,
      type: "view",
      viewName: VIEW_NAMES[zoom],
      label: { key: `timeline.${zoom}` },
      messages,
      range: ranges[zoom],
      step: { unit: zoom },
      component: View,
    };
  });
}

/** The three timeline views with the default options. */
const timelinePlugins = createTimelinePlugins();
export const [timelineDay, timelineWeek, timelineMonth] = timelinePlugins;
export default timelinePlugins;
