import type { EventProps } from "@react-agendfy/core";
import type { EventApi } from "./types";

/*
 * FullCalendar-shaped, read-only EventApi built from an agendfy event.
 * Recurring occurrences keep the ORIGINAL id (FullCalendar gives every
 * occurrence the series id), which is what apps send back to their API.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock parts of `date` in `timeZone`. */
const zonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
};

/**
 * ISO string in the calendar time zone, like FullCalendar's startStr:
 * "2026-03-11T14:00:00+01:00", "…Z" for UTC, or "2026-03-11" when all-day.
 */
export const formatIsoInZone = (date: Date, timeZone: string, allDay = false): string => {
  const p = zonedParts(date, timeZone);
  const day = `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
  if (allDay) return day;
  const wall = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  const offsetMin = Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const time = `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return `${day}T${time}Z`;
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${day}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

export const createEventApi = (event: EventProps, timeZone: string): EventApi => {
  const fc = (event.fc ?? {}) as Record<string, any>;
  const id = String(event.originalEventId ?? event.id ?? "");
  const allDay = !!event.allDay;
  const start = toDate(event.start);
  const end = toDate(event.end);
  // Week-view segments of a midnight-crossing event carry the true bounds.
  const segment = event.__segment as { originalStart?: string; originalEnd?: string } | undefined;
  const trueStart = toDate(segment?.originalStart) ?? start;
  const trueEnd = toDate(segment?.originalEnd) ?? end;
  const extendedProps = (event.extendedProps as Record<string, any>) ?? {};
  const title = event.title ?? "";

  const api: EventApi = {
    id,
    groupId: fc.groupId ?? "",
    title,
    start: trueStart,
    end: trueEnd,
    startStr: trueStart ? formatIsoInZone(trueStart, timeZone, allDay) : "",
    endStr: trueEnd ? formatIsoInZone(trueEnd, timeZone, allDay) : "",
    allDay,
    url: fc.url ?? "",
    display: fc.display ?? "auto",
    backgroundColor: event.color ?? "",
    borderColor: fc.borderColor ?? "",
    textColor: fc.textColor ?? "",
    extendedProps,
    _def: { publicId: id, groupId: fc.groupId ?? "", title, url: fc.url ?? "", extendedProps },
    _instance: { range: { start: trueStart, end: trueEnd } },
    toPlainObject: () => ({
      id,
      title,
      start: api.startStr,
      end: api.endStr,
      allDay,
      ...(Object.keys(extendedProps).length ? { extendedProps } : {}),
    }),
  };
  return api;
};
