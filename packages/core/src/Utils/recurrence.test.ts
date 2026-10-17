import { expandRecurrences } from "./recurrence";
import { EventProps } from "../types/types";

const TZ = "Europe/Lisbon";
const range = (start: string, end: string) => [new Date(start), new Date(end)] as const;

const weekly = (extra: Partial<EventProps> = {}): EventProps => ({
  id: "s1",
  title: "Fisioterapia",
  // Monday 2026-03-02 10:00 Lisbon (UTC+0 in winter)
  start: "2026-03-02T10:00:00Z",
  end: "2026-03-02T10:45:00Z",
  recurrence: "FREQ=WEEKLY;COUNT=6",
  ...extra,
});

const starts = (events: EventProps[]) => events.map((e) => e.start);

describe("expandRecurrences", () => {
  it("passes non-recurring events through untouched", () => {
    const plain = { id: "p", title: "x", start: "2026-03-02T10:00:00Z", end: "2026-03-02T11:00:00Z" };
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z");
    expect(expandRecurrences([plain], from, to, TZ)).toEqual([plain]);
  });

  it("expands an RRULE string into plain occurrences with unique ids", () => {
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-20T00:00:00Z");
    const out = expandRecurrences([weekly()], from, to, TZ);
    expect(starts(out)).toEqual([
      "2026-03-02T10:00:00.000Z",
      "2026-03-09T10:00:00.000Z",
      "2026-03-16T10:00:00.000Z",
    ]);
    expect(new Set(out.map((e) => e.id)).size).toBe(3);
    out.forEach((e) => {
      expect(e.recurrence).toBeUndefined();
      expect(e.isRecurrenceInstance).toBe(true);
      expect(e.originalEventId).toBe("s1");
      expect(e.occurrenceStart).toBe(e.start);
      // duration preserved
      expect(new Date(e.end).getTime() - new Date(e.start).getTime()).toBe(45 * 60000);
    });
  });

  it("keeps the wall-clock time across a DST change (Lisbon, 29 Mar 2026)", () => {
    const [from, to] = range("2026-03-20T00:00:00Z", "2026-04-10T00:00:00Z");
    const out = expandRecurrences([weekly()], from, to, TZ);
    // 10:00 local = 10:00Z before DST, 09:00Z after.
    expect(starts(out)).toEqual([
      "2026-03-23T10:00:00.000Z",
      "2026-03-30T09:00:00.000Z",
      "2026-04-06T09:00:00.000Z",
    ]);
  });

  it("drops occurrences listed in exdate (date-only and date-time)", () => {
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-04-10T00:00:00Z");
    const out = expandRecurrences(
      [weekly({ exdate: ["2026-03-09", "2026-03-23T10:00:00Z"] })],
      from,
      to,
      TZ
    );
    expect(starts(out)).toEqual([
      "2026-03-02T10:00:00.000Z",
      "2026-03-16T10:00:00.000Z",
      "2026-03-30T09:00:00.000Z",
      "2026-04-06T09:00:00.000Z",
    ]);
  });

  it("honours EXDATE and DTSTART lines inside a multi-line rule", () => {
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-20T00:00:00Z");
    const out = expandRecurrences(
      [
        weekly({
          recurrence: "DTSTART:20260302T100000Z\nRRULE:FREQ=WEEKLY;COUNT=3\nEXDATE:20260309T100000Z",
        }),
      ],
      from,
      to,
      TZ
    );
    expect(starts(out)).toEqual(["2026-03-02T10:00:00.000Z", "2026-03-16T10:00:00.000Z"]);
  });

  it("accepts a FullCalendar-style rrule object via the `rrule` alias", () => {
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-08T00:00:00Z");
    const event: EventProps = {
      id: "o1",
      title: "Consulta",
      start: "2026-03-02T14:00:00Z",
      end: "2026-03-02T15:00:00Z",
      rrule: { freq: "weekly", byweekday: ["mo", "we"], count: 10 },
    };
    const out = expandRecurrences([event], from, to, TZ);
    expect(starts(out)).toEqual(["2026-03-02T14:00:00.000Z", "2026-03-04T14:00:00.000Z"]);
    expect(out[0].rrule).toBeUndefined();
  });

  it("respects a date-only UNTIL in the object form (inclusive day)", () => {
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z");
    const out = expandRecurrences(
      [weekly({ recurrence: { freq: "weekly", until: "2026-03-16" } })],
      from,
      to,
      TZ
    );
    expect(starts(out)).toEqual([
      "2026-03-02T10:00:00.000Z",
      "2026-03-09T10:00:00.000Z",
      "2026-03-16T10:00:00.000Z",
    ]);
  });

  it("keeps an occurrence that started before the window but runs into it", () => {
    const event = weekly({
      start: "2026-03-01T23:00:00Z",
      end: "2026-03-02T02:00:00Z",
      recurrence: "FREQ=DAILY;COUNT=3",
    });
    const [from, to] = range("2026-03-02T00:00:00Z", "2026-03-02T12:00:00Z");
    expect(starts(expandRecurrences([event], from, to, TZ))).toEqual(["2026-03-01T23:00:00.000Z"]);
  });

  it("falls back to the original event on an invalid rule", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const event = weekly({ recurrence: { freq: "fortnightly" as any } });
    const [from, to] = range("2026-03-01T00:00:00Z", "2026-03-31T00:00:00Z");
    expect(expandRecurrences([event], from, to, TZ)).toEqual([event]);
    spy.mockRestore();
  });
});
