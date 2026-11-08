import type { Config, EventChange, EventProps } from "../types/types";
import { findOverlapConflicts, satisfiesConstraint, validateChange } from "./changeRules";
import { ChangeHistory, sameSchedule, withSchedule } from "./changeHistory";
import { defaultResource } from "./calendarHelpers";

// 2026-03-11 is a Wednesday.
const ev = (id: string, startH: number, endH: number, extra: Partial<EventProps> = {}): EventProps => ({
  id,
  title: id,
  start: `2026-03-11T${String(startH).padStart(2, "0")}:00:00.000Z`,
  end: `2026-03-11T${String(endH).padStart(2, "0")}:00:00.000Z`,
  ...extra,
});

const config = (extra: Partial<Config> = {}) =>
  ({
    timeZone: "UTC",
    businessHours: {
      enabled: true,
      intervals: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" }],
    },
    ...extra,
  }) as Config;

const move = (event: EventProps, before?: EventProps): EventChange => ({
  kind: "move",
  event,
  before,
  source: "user",
});

const ctx = (events: EventProps[], extra: Partial<Config> = {}) => ({
  config: config(extra),
  eventsInRange: () => events,
});

describe("findOverlapConflicts", () => {
  const still = ev("a", 10, 11);

  it("allows overlaps by default", () => {
    expect(findOverlapConflicts(ev("m", 10, 11), [still], undefined)).toEqual([]);
  });

  it("finds intersecting events when overlap is false", () => {
    expect(findOverlapConflicts(ev("m", 10, 12), [still], false)).toEqual([still]);
  });

  it("treats touching ends as no overlap ([start, end))", () => {
    expect(findOverlapConflicts(ev("m", 11, 12), [still], false)).toEqual([]);
  });

  it("ignores the moving event itself", () => {
    expect(findOverlapConflicts(ev("a", 10, 12), [still], false)).toEqual([]);
  });

  it("ignores events on disjoint resources", () => {
    const onRoom1 = ev("a", 10, 11, { resourceId: "room1" });
    expect(findOverlapConflicts(ev("m", 10, 11, { resourceIds: ["room2"] }), [onRoom1], false)).toEqual([]);
    expect(findOverlapConflicts(ev("m", 10, 11, { resourceIds: ["room1"] }), [onRoom1], false)).toEqual([onRoom1]);
  });

  it("reads legacy `resources` objects but not the default placeholder", () => {
    const onR1 = ev("a", 10, 11, { resources: [{ id: "r1" }] });
    expect(findOverlapConflicts(ev("m", 10, 11, { resources: [{ id: "r2" }] }), [onR1], false)).toEqual([]);
    expect(findOverlapConflicts(ev("m", 10, 11, { resourceId: "r1" }), [onR1], false)).toEqual([onR1]);
    // Placeholder from normalizeEvents = no resources: conflicts with anything.
    expect(
      findOverlapConflicts(ev("m", 10, 11, { resources: [defaultResource] }), [onR1], false)
    ).toEqual([onR1]);
  });

  it("lets per-event overlap override the rule", () => {
    expect(findOverlapConflicts(ev("m", 10, 11), [ev("a", 10, 11, { overlap: false })], undefined)).toHaveLength(1);
    expect(findOverlapConflicts(ev("m", 10, 11, { overlap: true }), [still], false)).toEqual([]);
  });

  it("asks a function rule per pair", () => {
    const rule = jest.fn((s: EventProps) => s.id !== "a");
    expect(findOverlapConflicts(ev("m", 10, 11), [still, ev("b", 10, 11)], rule).map((e) => e.id)).toEqual(["a"]);
    expect(rule).toHaveBeenCalledTimes(2);
  });
});

describe("satisfiesConstraint", () => {
  it("businessHours: inside one interval only", () => {
    expect(satisfiesConstraint(ev("m", 9, 17), "businessHours", config())).toBe(true);
    expect(satisfiesConstraint(ev("m", 8, 10), "businessHours", config())).toBe(false);
    expect(satisfiesConstraint(ev("m", 16, 18), "businessHours", config())).toBe(false);
  });

  it("businessHours: weekends are out, all-day events are not constrained", () => {
    const saturday = { ...ev("m", 10, 11), start: "2026-03-14T10:00:00Z", end: "2026-03-14T11:00:00Z" };
    expect(satisfiesConstraint(saturday, "businessHours", config())).toBe(false);
    expect(satisfiesConstraint({ ...saturday, allDay: true }, "businessHours", config())).toBe(true);
  });

  it("businessHours: no constraint when business hours are disabled", () => {
    expect(
      satisfiesConstraint(ev("m", 1, 2), "businessHours", config({ businessHours: { enabled: false, intervals: [] } }))
    ).toBe(true);
  });

  it("uses the calendar time zone for weekly intervals", () => {
    // 12:00Z is 09:00 in São Paulo (UTC-3): inside 09:00–17:00 there, not in UTC terms.
    const atNineLocal = ev("m", 12, 13);
    const intervals = [{ daysOfWeek: [3], startTime: "09:00", endTime: "10:00" }];
    expect(satisfiesConstraint(atNineLocal, intervals, config({ timeZone: "America/Sao_Paulo" }))).toBe(true);
    expect(satisfiesConstraint(atNineLocal, intervals, config())).toBe(false);
  });

  it("date range: [start, end), date-only strings in the calendar zone", () => {
    const range = { start: "2026-03-11", end: "2026-03-12" };
    expect(satisfiesConstraint(ev("m", 0, 23), range, config())).toBe(true);
    expect(
      satisfiesConstraint({ ...ev("m", 0, 1), start: "2026-03-10T23:00:00Z" }, range, config())
    ).toBe(false);
  });

  it("per-event constraint wins over the rule", () => {
    expect(satisfiesConstraint(ev("m", 1, 2, { constraint: { start: "2026-03-01" } }), "businessHours", config())).toBe(true);
  });
});

describe("validateChange", () => {
  it("accepts by default", () => {
    expect(validateChange(move(ev("m", 1, 2)), ctx([ev("a", 1, 2)]))).toBe(true);
  });

  it("reports overlap with the conflicting events", () => {
    const still = ev("a", 10, 11);
    expect(validateChange(move(ev("m", 10, 11)), ctx([still], { eventOverlap: false }))).toEqual({
      ok: false,
      reason: "overlap",
      conflicts: [still],
    });
  });

  it("reports constraint and eventAllow refusals", () => {
    expect(validateChange(move(ev("m", 7, 8)), ctx([], { eventConstraint: "businessHours" }))).toMatchObject({
      reason: "constraint",
    });
    const eventAllow = jest.fn(() => false);
    const change = move(ev("m", 10, 11));
    expect(validateChange(change, ctx([], { eventAllow }))).toMatchObject({ reason: "not-allowed" });
    expect(eventAllow).toHaveBeenCalledWith(change);
  });

  it("runs middleware validators after the built-in rules", () => {
    const custom = { key: "mw", type: "middleware" as const, validate: () => ({ ok: false as const, reason: "busy" }) };
    const deny = { key: "deny", type: "middleware" as const, validate: () => false };
    expect(validateChange(move(ev("m", 10, 11)), ctx([]), [custom])).toEqual({ ok: false, reason: "busy" });
    expect(validateChange(move(ev("m", 10, 11)), ctx([]), [deny])).toEqual({
      ok: false,
      reason: "not-allowed",
      message: "deny",
    });
  });
});

describe("change history helpers", () => {
  it("sameSchedule compares instants, not string forms", () => {
    expect(sameSchedule(ev("a", 10, 11), { ...ev("a", 10, 11), start: "2026-03-11T10:00:00+00:00" })).toBe(true);
    expect(sameSchedule(ev("a", 10, 11), ev("a", 10, 12))).toBe(false);
    expect(sameSchedule(ev("a", 10, 11), ev("a", 10, 11, { allDay: false }))).toBe(true);
  });

  it("withSchedule restores schedule fields only", () => {
    const before = ev("a", 10, 11);
    const current = { ...ev("a", 12, 13, { resourceId: "r2" }), title: "renamed" };
    expect(withSchedule(current, before)).toEqual({ ...before, title: "renamed" });
  });

  it("records, undoes, redoes and caps the stack", () => {
    const h = new ChangeHistory(2);
    h.record("move", ev("a", 1, 2), ev("a", 2, 3));
    h.record("move", ev("a", 2, 3), ev("a", 3, 4));
    h.record("move", ev("a", 3, 4), ev("a", 4, 5));
    expect(h.takeUndo()?.after.start).toBe(ev("a", 4, 5).start);
    expect(h.takeUndo()?.after.start).toBe(ev("a", 3, 4).start);
    expect(h.canUndo()).toBe(false);
  });

  it("a new record clears redo; limit 0 disables history", () => {
    const h = new ChangeHistory();
    h.record("move", ev("a", 1, 2), ev("a", 2, 3));
    h.pushRedo(h.takeUndo()!);
    expect(h.canRedo()).toBe(true);
    h.record("move", ev("a", 1, 2), ev("a", 5, 6));
    expect(h.canRedo()).toBe(false);
    expect(new ChangeHistory(0).record("move", ev("a", 1, 2), ev("a", 2, 3))).toBeNull();
  });
});
