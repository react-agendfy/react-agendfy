import React from "react";
import { useCalendarView } from "@react-agendfy/core";
import type { GanttZoom } from "./Gantt";

const Chevron = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/**
 * The standalone <Gantt>'s toolbar: previous / today / next, the visible
 * period, and the zoom. Drawn inside the calendar root, so it follows the
 * theme tokens.
 */
export default function GanttToolbar({ zoom, zooms }: { zoom: GanttZoom; zooms: { zoom: GanttZoom; view: string }[] }) {
  const cal = useCalendarView();
  const { start } = cal.range;
  const last = new Date(cal.range.end.getTime() - 1);
  // The year once, unless the period crosses into the next one.
  const sameYear = cal.formatDate(start, "yyyy") === cal.formatDate(last, "yyyy");
  const title =
    zoom === "week"
      ? `${cal.formatDate(start, sameYear ? "d MMM" : "d MMM yyyy")} – ${cal.formatDate(last, "d MMM yyyy")}`
      : zoom === "quarter"
        ? `${cal.formatDate(start, sameYear ? "MMM" : "MMM yyyy")} – ${cal.formatDate(last, "MMM yyyy")}`
        : cal.formatDate(start, "MMMM yyyy");
  return (
    <div className="agendfy-gantt-toolbar">
      <div className="react-agendfy-button-group">
        <button
          type="button"
          className="react-agendfy-button react-agendfy-button-primary"
          aria-label={cal.t("gantt.previous")}
          onClick={() => cal.navigate("prev")}
        >
          <Chevron d="m15 18-6-6 6-6" />
        </button>
        <button type="button" className="react-agendfy-button react-agendfy-button-primary" onClick={() => cal.navigate("today")}>
          {cal.t("gantt.today")}
        </button>
        <button
          type="button"
          className="react-agendfy-button react-agendfy-button-primary"
          aria-label={cal.t("gantt.next")}
          onClick={() => cal.navigate("next")}
        >
          <Chevron d="m9 18 6-6-6-6" />
        </button>
      </div>
      <h2 className="agendfy-gantt-toolbar-title" aria-live="polite">
        {title}
      </h2>
      {zooms.length > 1 && (
        <div className="react-agendfy-button-group" role="group" aria-label={cal.t("gantt.zoom")}>
          {zooms.map((z) => (
            <button
              key={z.zoom}
              type="button"
              className={`react-agendfy-button react-agendfy-button-primary${z.zoom === zoom ? " react-agendfy-button-active" : ""}`}
              aria-pressed={z.zoom === zoom}
              onClick={() => cal.changeView(z.view)}
            >
              {cal.t(`gantt.zoom.${z.zoom}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
