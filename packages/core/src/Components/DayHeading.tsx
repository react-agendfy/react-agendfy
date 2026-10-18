import React from "react";
import { TZDate } from "@date-fns/tz";
import { isSameDay } from "date-fns";
import type { Config } from "../types/types";

/**
 * Day heading of the list and agenda views: "segunda-feira, 19 de outubro"
 * in the calendar language (Intl, so each language gets its natural form),
 * with a "Today" pill on the current day.
 */
const DayHeading = ({ day, config, as: Tag = "h2" }: { day: Date; config?: Partial<Config>; as?: "h2" | "h3" }) => {
  const lang = (config?.lang || "en").replace("_", "-");
  let label: string;
  try {
    label = new Intl.DateTimeFormat(lang, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: config?.timeZone,
    }).format(day);
  } catch {
    label = day.toDateString();
  }
  const isToday = isSameDay(new TZDate(day, config?.timeZone), new TZDate(new Date(), config?.timeZone));
  return (
    <Tag
      className={`react-agendfy-day-heading ${isToday ? "react-agendfy-day-heading--today" : ""}`}
      data-today={isToday || undefined}
    >
      <span className="react-agendfy-day-heading-label">{label}</span>
      {isToday && <span className="react-agendfy-day-heading-today">{config?.today || "Today"}</span>}
    </Tag>
  );
};

export default DayHeading;
