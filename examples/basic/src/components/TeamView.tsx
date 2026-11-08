import React from "react";
import {
  eventResourceIds,
  useCalendarView,
  useDropZone,
  useEventDraggable,
  type CalendarPlugin,
  type EventProps,
} from "@react-agendfy/core";
import { addDaysKey, dayKey, fromZoned } from "../lib/time";

/*
 * A custom view written only against the public SDK (useCalendarView,
 * useEventDraggable, useDropZone): today's events in one column per
 * resource. Drag an event to another person/room or time; the calendar's
 * rules, live preview, undo and external drops all apply.
 */

const SLOT_MINUTES = 30;
const SLOT_PX = 24;

const hm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const toMinutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
};

function Slot({ id, date, resourceId, disabled }: { id: string; date: Date; resourceId: string; disabled: boolean }) {
  const { setNodeRef, isOver } = useDropZone(id, { date, resourceIds: [resourceId] }, { disabled });
  return <div ref={setNodeRef} className={`team-slot${isOver ? " team-slot--over" : ""}`} style={{ height: SLOT_PX }} />;
}

function TeamEvent({ event, top, height }: { event: EventProps; top: number; height: number }) {
  const cal = useCalendarView();
  const { setNodeRef, attributes, listeners, isDragging } = useEventDraggable(event);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`team-event ${cal.eventClassName(event)}`}
      data-event-id={event.id}
      style={{ top, height, background: event.color, opacity: isDragging ? 0.35 : 1 }}
      onClick={() => cal.onEventClick(event)}
      aria-label={`${event.title}, ${cal.timeText(event)}`}
    >
      <strong>{event.title}</strong>
      <span>{cal.timeText(event)}</span>
    </div>
  );
}

function TeamView() {
  const cal = useCalendarView();
  const day = dayKey(cal.date, cal.timeZone);
  const startMin = toMinutes(cal.config.slotMin || "07:00");
  const endMin = toMinutes(cal.config.slotMax || "21:00");
  const slots = Array.from({ length: Math.ceil((endMin - startMin) / SLOT_MINUTES) }, (_, i) => startMin + i * SLOT_MINUTES);
  const dayStart = fromZoned(day, "00:00", cal.timeZone).getTime();
  const disabled = cal.isDisabled(new Date(dayStart));
  const members = cal.resources.filter((r) => r.type !== "group");

  const placed = (event: EventProps) => {
    const from = (new Date(event.start).getTime() - dayStart) / 60000;
    const to = (new Date(event.end).getTime() - dayStart) / 60000;
    if (event.allDay || to <= startMin || from >= endMin) return null;
    const top = ((Math.max(from, startMin) - startMin) / SLOT_MINUTES) * SLOT_PX;
    const height = Math.max(SLOT_PX / 2, ((Math.min(to, endMin) - Math.max(from, startMin)) / SLOT_MINUTES) * SLOT_PX - 2);
    return { top, height };
  };

  return (
    <div className="team-view" role="grid" aria-label={cal.t("team.aria", { day: cal.formatDate(cal.date, "EEEE, d MMMM") })}>
      <div className="team-head" role="row">
        <div className="team-corner">{cal.formatDate(cal.date, "EEE d")}</div>
        {members.map((r) => (
          <div key={r.id} className="team-name" role="columnheader">
            {r.name ?? r.title}
          </div>
        ))}
      </div>
      <div className="team-body" role="row">
        <div className="team-times">
          {slots.map((m) => (
            <div key={m} className="team-time" style={{ height: SLOT_PX }}>
              {m % 60 === 0 ? cal.formatTime(fromZoned(day, hm(m), cal.timeZone)) : ""}
            </div>
          ))}
        </div>
        {members.map((r) => (
          <div key={r.id} className="team-column" role="gridcell" aria-label={String(r.name ?? r.id)}>
            {slots.map((m) => (
              <Slot
                key={m}
                id={`${r.id}-${m}`}
                resourceId={String(r.id)}
                date={fromZoned(day, hm(m), cal.timeZone)}
                disabled={disabled}
              />
            ))}
            {cal.events
              .filter((e) => eventResourceIds(e).includes(String(r.id)))
              .map((e) => {
                const box = placed(e);
                return box ? <TeamEvent key={e.id} event={e} {...box} /> : null;
              })}
          </div>
        ))}
      </div>
      {members.length === 0 && <p className="team-empty">{cal.t("team.empty")}</p>}
    </div>
  );
}

export const teamViewPlugin: CalendarPlugin = {
  key: "team-view",
  type: "view",
  viewName: "team",
  label: { key: "team.label" },
  messages: {
    en: { "team.label": "Team", "team.aria": "Team schedule, {day}", "team.empty": "No resources." },
    pt: { "team.label": "Equipa", "team.aria": "Agenda da equipa, {day}", "team.empty": "Sem recursos." },
    "pt-BR": { "team.label": "Equipe", "team.aria": "Agenda da equipe, {day}" },
    es: { "team.label": "Equipo", "team.aria": "Agenda del equipo, {day}", "team.empty": "Sin recursos." },
    fr: { "team.label": "Équipe", "team.aria": "Planning de l’équipe, {day}", "team.empty": "Aucune ressource." },
  },
  // One day: the navigated date's, in the calendar zone; prev/next by a day.
  range: (date, { timeZone }) => {
    const key = dayKey(date, timeZone);
    return { start: fromZoned(key, "00:00", timeZone), end: fromZoned(addDaysKey(key, 1), "00:00", timeZone) };
  },
  step: { unit: "day" },
  component: TeamView,
};
