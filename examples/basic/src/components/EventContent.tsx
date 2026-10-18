import React from "react";
import type { EventContentArg } from "@react-agendfy/core";
import { Brain, Briefcase, Heart, MapPin, Plane, Repeat, Rocket, Users, type LucideIcon } from "lucide-react";
import { categories } from "../demoEvents";
import { avatarColor, initials } from "../lib/time";

export const categoryIcons: Record<string, LucideIcon> = {
  meeting: Users,
  client: Briefcase,
  focus: Brain,
  release: Rocket,
  personal: Heart,
  travel: Plane,
};

export function Avatars({ people: raw, max = 3 }: { people?: unknown; max?: number }) {
  const people = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string" && p !== "") : [];
  if (!people.length) return null;
  const shown = people.slice(0, max);
  return (
    <span className="avatars" aria-label={`${people.length} attendees`}>
      {shown.map((p) => (
        <span key={p} className="avatar" style={{ background: avatarColor(p) }} title={p}>
          {initials(p)}
        </span>
      ))}
      {people.length > max && <span className="avatar avatar-more">+{people.length - max}</span>}
    </span>
  );
}

/**
 * The demo's `eventContent`: one renderer, three densities. This is the
 * whole point of the demo — the calendar draws whatever the app wants
 * inside each event; positioning, drag and resize stay with the library.
 */
export function renderEventContent({ event, view, timeText }: EventContentArg) {
  const Icon = categoryIcons[event.category] ?? Users;
  const recurring = Boolean(event.isRecurrenceInstance || event.recurrence);
  const startTime = timeText.split(" - ")[0];

  if (view === "month") {
    return (
      <span className="ev ev-month">
        <Icon size={12} className="ev-icon" aria-hidden />
        <span className="ev-title">{event.title}</span>
        {!event.allDay && <span className="ev-time">{startTime}</span>}
      </span>
    );
  }

  if (view === "week" || view === "day") {
    return (
      <span className="ev ev-block">
        <span className="ev-head">
          <Icon size={12} className="ev-icon" aria-hidden />
          <span className="ev-title">{event.title}</span>
          {recurring && <Repeat size={11} className="ev-icon" aria-label="Recurring" />}
        </span>
        {!event.allDay && <span className="ev-meta">{timeText}</span>}
        {event.location && !event.allDay && (
          <span className="ev-meta">
            <MapPin size={11} aria-hidden /> {event.location}
          </span>
        )}
        {view === "day" && <Avatars people={event.attendees} max={5} />}
      </span>
    );
  }

  // list / agenda rows: the library already draws the time and colour dot.
  const category = categories.find((c) => c.id === event.category);
  return (
    <span className="ev ev-row">
      <span className="ev-title">{event.title}</span>
      {category && (
        <span className="ev-tag" style={{ ["--tag" as any]: category.color }}>
          {category.label}
        </span>
      )}
      {recurring && <Repeat size={13} className="ev-icon" aria-label="Recurring" />}
      {event.location && (
        <span className="ev-meta">
          <MapPin size={12} aria-hidden /> {event.location}
        </span>
      )}
      <Avatars people={event.attendees} max={4} />
    </span>
  );
}
