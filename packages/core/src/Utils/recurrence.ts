import { TZDate } from "@date-fns/tz";
import { parseISO } from "date-fns";
import { Frequency, RRule, RRuleSet, Weekday } from "rrule";
import type { Options as RRuleOptions } from "rrule";
import type { EventProps, RecurrenceInput, RecurrenceObject } from "../types/types";

/*
 * Recurrence expansion — the single place recurring events become concrete
 * occurrences. Views never expand rules themselves: the calendar context
 * expands once per visible window and hands them plain events.
 *
 * Time model: rrule.js computes in "floating" time — a Date whose UTC fields
 * are the wall-clock fields. We convert the anchor into floating time in the
 * calendar time zone, let rrule iterate, and convert each occurrence back.
 * This keeps "every Monday at 09:00" at 09:00 local across DST changes,
 * which an instant-based iteration would shift by an hour.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ICS_DATE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;

const wallClock = (date: Date, timeZone?: string): Date =>
  timeZone ? new TZDate(date, timeZone) : new Date(date.getTime());

/** Instant → floating Date whose UTC fields are the wall clock in `timeZone`. */
export const toFloating = (date: Date, timeZone?: string): Date => {
  const w = wallClock(date, timeZone);
  return new Date(
    Date.UTC(w.getFullYear(), w.getMonth(), w.getDate(), w.getHours(), w.getMinutes(), w.getSeconds())
  );
};

/** Floating Date → real instant for that wall clock in `timeZone`. */
export const fromFloating = (floating: Date, timeZone?: string): Date => {
  const args = [
    floating.getUTCFullYear(),
    floating.getUTCMonth(),
    floating.getUTCDate(),
    floating.getUTCHours(),
    floating.getUTCMinutes(),
    floating.getUTCSeconds(),
  ] as const;
  return timeZone ? new TZDate(...args, timeZone) : new Date(...args);
};

const floatingDayKey = (floating: Date) => floating.toISOString().slice(0, 10);
const floatingMinuteKey = (floating: Date) => Math.floor(floating.getTime() / 60000);

type ParsedMoment =
  | { kind: "day"; key: string }
  | { kind: "floating"; date: Date };

/**
 * Parses a date given by the host app. "YYYY-MM-DD" is a whole day; an ISO
 * string with Z/offset (or a Date) is an instant; an ISO string without an
 * offset is a wall-clock time in the calendar time zone.
 */
const parseMoment = (value: string | Date, timeZone?: string): ParsedMoment | null => {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : { kind: "floating", date: toFloating(value, timeZone) };
  }
  const str = String(value).trim();
  if (DATE_ONLY.test(str)) return { kind: "day", key: str };

  const ics = ICS_DATE.exec(str);
  if (ics) {
    const [, y, mo, d, h, mi, s, z] = ics;
    if (h === undefined) return { kind: "day", key: `${y}-${mo}-${d}` };
    const fields = [+y, +mo - 1, +d, +h, +mi, +s] as const;
    return z
      ? { kind: "floating", date: toFloating(new Date(Date.UTC(...fields)), timeZone) }
      : { kind: "floating", date: new Date(Date.UTC(...fields)) };
  }

  const parsed = parseISO(str);
  if (isNaN(parsed.getTime())) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    return { kind: "floating", date: toFloating(parsed, timeZone) };
  }
  // No offset: parseISO read it as host-local wall clock — keep those fields.
  return {
    kind: "floating",
    date: new Date(
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours(), parsed.getMinutes(), parsed.getSeconds())
    ),
  };
};

const toFloatingStart = (value: string | Date, timeZone?: string): Date | null => {
  const m = parseMoment(value, timeZone);
  if (!m) return null;
  return m.kind === "day" ? new Date(`${m.key}T00:00:00Z`) : m.date;
};

const FREQUENCIES: Record<string, Frequency> = {
  yearly: Frequency.YEARLY,
  monthly: Frequency.MONTHLY,
  weekly: Frequency.WEEKLY,
  daily: Frequency.DAILY,
  hourly: Frequency.HOURLY,
  minutely: Frequency.MINUTELY,
  secondly: Frequency.SECONDLY,
};

const WEEKDAYS: Record<string, Weekday> = {
  mo: RRule.MO, tu: RRule.TU, we: RRule.WE, th: RRule.TH, fr: RRule.FR, sa: RRule.SA, su: RRule.SU,
};

const toWeekday = (day: string | number): Weekday | number | null => {
  if (typeof day === "number") return day; // rrule convention: 0 = Monday
  return WEEKDAYS[day.trim().slice(0, 2).toLowerCase()] ?? null;
};

const asArray = <T,>(value: T | T[] | undefined | null): T[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

/** FullCalendar-style rrule object → rrule.js options (dtstart resolved by caller). */
const optionsFromObject = (
  rule: RecurrenceObject,
  timeZone?: string
): Partial<RRuleOptions> | null => {
  const freq =
    typeof rule.freq === "number" ? rule.freq : FREQUENCIES[String(rule.freq).toLowerCase()];
  if (freq === undefined) return null;

  const options: Partial<RRuleOptions> = { freq };
  if (rule.interval) options.interval = Number(rule.interval);
  if (rule.count) options.count = Number(rule.count);
  if (rule.until) {
    const until = parseMoment(rule.until, timeZone);
    if (until) {
      // A date-only UNTIL includes that whole day.
      options.until =
        until.kind === "day" ? new Date(`${until.key}T23:59:59Z`) : until.date;
    }
  }
  const byweekday = asArray(rule.byweekday)
    .map(toWeekday)
    .filter((d): d is Weekday | number => d !== null);
  if (byweekday.length) options.byweekday = byweekday;
  if (rule.bymonthday !== undefined) options.bymonthday = asArray(rule.bymonthday);
  if (rule.bymonth !== undefined) options.bymonth = asArray(rule.bymonth);
  if (rule.bysetpos !== undefined) options.bysetpos = asArray(rule.bysetpos);
  if (rule.wkst !== undefined) {
    const wkst = toWeekday(rule.wkst);
    if (wkst !== null) options.wkst = wkst;
  }
  return options;
};

interface CompiledRule {
  between: (after: Date, before: Date) => Date[];
  excluded: ParsedMoment[];
}

/**
 * Compiles a recurrence (RRULE string, possibly multi-line with DTSTART /
 * EXDATE, or a FullCalendar-style object) anchored at `fallbackStart`.
 */
const compileRule = (
  recurrence: RecurrenceInput,
  fallbackStart: Date,
  timeZone?: string
): CompiledRule => {
  const excluded: ParsedMoment[] = [];
  let dtstart = toFloating(fallbackStart, timeZone);

  if (typeof recurrence === "string") {
    // Parsed line by line (not via rrulestr's forceset mode, which ignores
    // the `dtstart` option): DTSTART/EXDATE/RDATE are resolved in the
    // calendar time zone, RRULE lines become rules anchored at dtstart.
    const ruleLines: string[] = [];
    const rdates: Date[] = [];
    for (const rawLine of recurrence.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const colon = line.indexOf(":");
      const isProperty = colon > 0 && !line.slice(0, colon).includes("=");
      const name = isProperty ? line.slice(0, colon).split(";")[0].toUpperCase() : "RRULE";
      const value = isProperty ? line.slice(colon + 1) : line;
      if (name === "DTSTART") {
        const parsed = toFloatingStart(value, timeZone);
        if (parsed) dtstart = parsed;
      } else if (name === "EXDATE") {
        value.split(",").forEach((v) => {
          const m = parseMoment(v, timeZone);
          if (m) excluded.push(m);
        });
      } else if (name === "RDATE") {
        value.split(",").forEach((v) => {
          const parsed = toFloatingStart(v, timeZone);
          if (parsed) rdates.push(parsed);
        });
      } else if (name === "RRULE") {
        ruleLines.push(value);
      }
    }
    if (ruleLines.length === 0 && rdates.length === 0) {
      throw new Error(`Recurrence has no RRULE: ${recurrence}`);
    }
    const set = new RRuleSet();
    ruleLines.forEach((value) => set.rrule(new RRule({ ...RRule.parseString(value), dtstart })));
    rdates.forEach((d) => set.rdate(d));
    return { between: (a, b) => set.between(a, b, true), excluded };
  }

  if (recurrence.dtstart) {
    const parsed = toFloatingStart(recurrence.dtstart, timeZone);
    if (parsed) dtstart = parsed;
  }
  const options = optionsFromObject(recurrence, timeZone);
  if (!options) throw new Error(`Unsupported recurrence frequency: ${String(recurrence.freq)}`);
  const rule = new RRule({ ...options, dtstart });
  return { between: (a, b) => rule.between(a, b, true), excluded };
};

const isExcluded = (occurrence: Date, excluded: ParsedMoment[]) => {
  if (excluded.length === 0) return false;
  const day = floatingDayKey(occurrence);
  const minute = floatingMinuteKey(occurrence);
  return excluded.some((m) =>
    m.kind === "day" ? m.key === day : floatingMinuteKey(m.date) === minute
  );
};

const toInstant = (value: string | Date): Date =>
  value instanceof Date ? value : parseISO(String(value));

/** The rule carried by an event — `recurrence` or its FullCalendar alias `rrule`. */
export const getRecurrence = (event: EventProps): RecurrenceInput | undefined => {
  const rule = event.recurrence ?? event.rrule;
  return rule ? (rule as RecurrenceInput) : undefined;
};

/**
 * Expands every recurring event into the occurrences that overlap
 * [rangeStart, rangeEnd]. Non-recurring events pass through untouched.
 *
 * Each occurrence is a plain event (no `recurrence`/`rrule`/`exdate`) with:
 *  - `id`: `${originalId}-${occurrenceStartISO}` (unique, stable per occurrence)
 *  - `isRecurrenceInstance: true`, `originalEventId`
 *  - `occurrenceStart`: the occurrence's scheduled start (ISO), unaffected by
 *    later drags — use it to create exceptions for a single occurrence.
 *
 * Exclusions come from `event.exdate` (string | Date | array of them) and
 * EXDATE lines in an RRULE string. "YYYY-MM-DD" excludes the whole day; a
 * date-time excludes the occurrence starting at that minute.
 */
export const expandRecurrences = <T extends EventProps>(
  events: T[],
  rangeStart: Date,
  rangeEnd: Date,
  timeZone?: string
): T[] => {
  const result: T[] = [];
  const floatingRangeStart = toFloating(rangeStart, timeZone);
  const floatingRangeEnd = toFloating(rangeEnd, timeZone);

  for (const event of events) {
    const recurrence = getRecurrence(event);
    if (!recurrence) {
      result.push(event);
      continue;
    }

    const start = toInstant(event.start);
    const end = toInstant(event.end);
    if (isNaN(start.getTime())) continue;
    const duration = isNaN(end.getTime()) ? 0 : Math.max(0, end.getTime() - start.getTime());

    try {
      const { between, excluded } = compileRule(recurrence, start, timeZone);
      asArray(event.exdate as string | Date | (string | Date)[] | undefined).forEach((v) => {
        const m = parseMoment(v, timeZone);
        if (m) excluded.push(m);
      });

      // Look back by the event duration so an occurrence that started before
      // the window but is still running inside it is kept. Floating-time
      // arithmetic: +1 day of slack covers a DST shift on the boundary.
      const occurrences = between(
        new Date(floatingRangeStart.getTime() - duration - DAY_MS),
        floatingRangeEnd
      );

      const { recurrence: _r, rrule: _rr, exdate: _ex, ...base } = event;
      for (const occurrence of occurrences) {
        if (isExcluded(occurrence, excluded)) continue;
        const occStart = fromFloating(occurrence, timeZone);
        const occEnd = new Date(occStart.getTime() + duration);
        if (occEnd.getTime() < rangeStart.getTime() || occStart.getTime() > rangeEnd.getTime()) {
          continue;
        }
        const startIso = new Date(occStart.getTime()).toISOString();
        result.push({
          ...base,
          id: `${event.id}-${startIso}`,
          start: startIso,
          end: new Date(occEnd.getTime()).toISOString(),
          isRecurrenceInstance: true,
          originalEventId: event.id,
          occurrenceStart: startIso,
        } as unknown as T);
      }
    } catch (error) {
      console.error("Invalid recurrence rule for event", event.id, error);
      result.push(event);
    }
  }
  return result;
};
