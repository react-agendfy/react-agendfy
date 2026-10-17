import {
  clampToValidRange,
  getDayRules,
  getHiddenDays,
  getNavigationTarget,
  getVisibleDayOffsets,
  resolveWeekStartsOn,
} from "./calendarRange";

const TZ = "Europe/Lisbon";

describe("calendarRange", () => {
  it("resolves weekStartsOn: explicit, then locale, then Sunday", () => {
    expect(resolveWeekStartsOn({ weekStartsOn: 3, lang: "pt" })).toBe(3);
    expect(resolveWeekStartsOn({ lang: "pt" })).toBe(1);
    expect(resolveWeekStartsOn({ lang: "en" })).toBe(0);
  });

  it("merges hiddenDays with weekends:false and ignores hiding every day", () => {
    expect([...getHiddenDays({ hiddenDays: [3], weekends: false })].sort()).toEqual([0, 3, 6]);
    expect(getHiddenDays({ hiddenDays: [0, 1, 2, 3, 4, 5, 6] }).size).toBe(0);
  });

  it("lists visible column offsets from the week start", () => {
    // Monday start, weekends hidden → Mon..Fri
    expect(getVisibleDayOffsets(1, getHiddenDays({ weekends: false }))).toEqual([0, 1, 2, 3, 4]);
    // Sunday start, Wednesday hidden
    expect(getVisibleDayOffsets(0, new Set([3]))).toEqual([0, 1, 2, 4, 5, 6]);
  });

  it("treats validRange end as exclusive", () => {
    const rules = getDayRules({ timeZone: TZ, validRange: { start: "2026-03-02", end: "2026-03-10" } });
    expect(rules.isDisabled(new Date("2026-03-01T12:00:00Z"))).toBe(true);
    expect(rules.isDisabled(new Date("2026-03-02T00:30:00Z"))).toBe(false);
    expect(rules.isDisabled(new Date("2026-03-09T23:00:00Z"))).toBe(false);
    expect(rules.isDisabled(new Date("2026-03-10T00:00:00Z"))).toBe(true);
  });

  it("clamps dates into the valid range", () => {
    const { validRange } = getDayRules({ timeZone: TZ, validRange: { start: "2026-03-02", end: "2026-03-10" } });
    const iso = (d: Date) => new Date(d.getTime()).toISOString();
    expect(iso(clampToValidRange(new Date("2026-01-01T00:00:00Z"), validRange))).toBe(
      "2026-03-02T00:00:00.000Z"
    );
    expect(iso(clampToValidRange(new Date("2026-05-01T00:00:00Z"), validRange))).toBe(
      "2026-03-09T00:00:00.000Z"
    );
  });

  it("blocks navigation into periods fully outside the range", () => {
    const rules = getDayRules({ timeZone: TZ, lang: "pt", validRange: { start: "2026-03-02", end: "2026-04-01" } });
    const inMarch = new Date("2026-03-15T12:00:00Z");
    expect(getNavigationTarget("month", inMarch, -1, rules)).toBeNull();
    expect(getNavigationTarget("month", inMarch, 1, rules)).toBeNull();
    expect(getNavigationTarget("week", inMarch, 1, rules)).not.toBeNull();
  });

  it("skips hidden weekdays when navigating the day view", () => {
    const rules = getDayRules({ timeZone: TZ, weekends: false });
    const friday = new Date("2026-03-06T12:00:00Z");
    const next = getNavigationTarget("day", friday, 1, rules)!;
    expect(next.getDay()).toBe(1); // Monday
    const back = getNavigationTarget("day", new Date("2026-03-09T12:00:00Z"), -1, rules)!;
    expect(back.getDay()).toBe(5); // Friday
  });
});
