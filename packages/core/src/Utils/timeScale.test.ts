import { clockToMinutes, createTimeScale } from "./timeScale";

const utc = (iso: string) => new Date(`${iso}Z`);

describe("createTimeScale", () => {
  // Week of 9 Mar 2026 (Mon) in UTC, 07:00–21:00, 30-min slots of 40px.
  const week = () =>
    createTimeScale({
      start: utc("2026-03-09T00:00:00"),
      end: utc("2026-03-16T00:00:00"),
      timeZone: "UTC",
      unitMinutes: 30,
      unitPx: 40,
      dayStartMinutes: 7 * 60,
      dayEndMinutes: 21 * 60,
    });

  it("lays the visible window of each day end to end", () => {
    const s = week();
    expect(s.segments).toHaveLength(7);
    expect(s.segments[1].offsetPx).toBe(14 * 2 * 40);
    expect(s.totalPx).toBe(7 * 14 * 2 * 40);
    expect(s.pxPerMinute).toBeCloseTo(40 / 30);
  });

  it("maps instants to px and back", () => {
    const s = week();
    expect(s.toPx(utc("2026-03-09T07:00:00"))).toBe(0);
    expect(s.toPx(utc("2026-03-09T10:15:00"))).toBe((195 * 40) / 30);
    expect(s.toPx(utc("2026-03-10T07:00:00"))).toBe(1120);
    for (const iso of ["2026-03-09T07:00:00", "2026-03-11T13:30:00", "2026-03-15T20:59:00"]) {
      expect(s.toDate(s.toPx(utc(iso))).getTime()).toBe(utc(iso).getTime());
    }
  });

  it("clamps times outside a day's window to its edges", () => {
    const s = week();
    expect(s.toPx(utc("2026-03-09T05:00:00"))).toBe(0);
    expect(s.toPx(utc("2026-03-09T23:00:00"))).toBe(1120);
    expect(s.toDate(-50).getTime()).toBe(utc("2026-03-09T07:00:00").getTime());
    expect(s.toDate(1e9).getTime()).toBe(utc("2026-03-15T21:00:00").getTime());
  });

  it("leaves hidden weekdays out (not linear in time)", () => {
    const s = createTimeScale({
      start: utc("2026-03-09T00:00:00"),
      end: utc("2026-03-16T00:00:00"),
      timeZone: "UTC",
      unitMinutes: 60,
      unitPx: 10,
      hiddenDays: [0, 6],
    });
    expect(s.segments.map((x) => x.day.getUTCDay())).toEqual([1, 2, 3, 4, 5]);
    expect(s.segmentOf(utc("2026-03-14T12:00:00"))).toBeNull();
    // Saturday maps to the end of Friday.
    expect(s.toPx(utc("2026-03-14T12:00:00"))).toBe(5 * 240);
    expect(s.toPx(utc("2026-03-16T12:00:00"))).toBe(5 * 240);
  });

  it("snaps to the step within the day's window", () => {
    const s = week();
    expect(s.snap(utc("2026-03-09T10:14:00")).getTime()).toBe(utc("2026-03-09T10:00:00").getTime());
    expect(s.snap(utc("2026-03-09T10:16:00")).getTime()).toBe(utc("2026-03-09T10:30:00").getTime());
    expect(s.snap(utc("2026-03-09T10:16:00"), 15).getTime()).toBe(utc("2026-03-09T10:15:00").getTime());
  });

  it("ticks every step of every visible day", () => {
    const ticks = week().ticks(60);
    expect(ticks).toHaveLength(7 * 14);
    expect(ticks[1]).toEqual({ date: utc("2026-03-09T08:00:00"), px: 80 });
  });

  it("follows the wall clock in the calendar zone", () => {
    // São Paulo is UTC-3: 10:00 there is 13:00Z.
    const s = createTimeScale({
      start: new Date("2026-03-11T03:00:00Z"),
      end: new Date("2026-03-12T03:00:00Z"),
      timeZone: "America/Sao_Paulo",
      unitMinutes: 60,
      unitPx: 60,
    });
    expect(s.segments).toHaveLength(1);
    expect(s.toPx(new Date("2026-03-11T13:00:00Z"))).toBe(600);
    expect(s.toDate(600).toISOString()).toBe("2026-03-11T13:00:00.000Z");
  });

  describe("DST (Europe/Lisbon)", () => {
    const lisbon = (start: string, end: string) =>
      createTimeScale({ start: new Date(start), end: new Date(end), timeZone: "Europe/Lisbon", unitMinutes: 60, unitPx: 60 });

    it("spring forward: the 23-hour day keeps a 24-hour grid, 10:00 on the 10:00 line", () => {
      // 29 Mar 2026: 01:00 → 02:00.
      // Lisbon midnights: 29 Mar 00:00 WET = 00:00Z, 30 Mar 00:00 WEST = 29 Mar 23:00Z.
      const s = lisbon("2026-03-29T00:00:00Z", "2026-03-29T23:00:00Z");
      expect(s.segments).toHaveLength(1);
      expect(s.totalPx).toBe(24 * 60);
      // 10:00 WEST = 09:00Z.
      expect(s.toPx(new Date("2026-03-29T09:00:00Z"))).toBe(600);
      expect(s.toDate(600).toISOString()).toBe("2026-03-29T09:00:00.000Z");
    });

    it("fall back: the repeated hour maps to one place", () => {
      // 25 Oct 2026: 02:00 → 01:00; 01:30 happens at 00:30Z and 01:30Z.
      const s = lisbon("2026-10-25T00:00:00Z", "2026-10-26T00:00:00Z");
      expect(s.toPx(new Date("2026-10-25T00:30:00Z"))).toBe(90);
      expect(s.toPx(new Date("2026-10-25T01:30:00Z"))).toBe(90);
      // 12:00 WET = 12:00Z, on the 12:00 line.
      expect(s.toPx(new Date("2026-10-25T12:00:00Z"))).toBe(720);
    });
  });

  it("an empty range has no segments", () => {
    const s = createTimeScale({ start: utc("2026-03-09T00:00:00"), end: utc("2026-03-09T00:00:00"), timeZone: "UTC", unitMinutes: 30, unitPx: 40 });
    expect(s.segments).toEqual([]);
    expect(s.totalPx).toBe(0);
    expect(s.toPx(utc("2026-03-09T10:00:00"))).toBe(0);
  });
});

it("clockToMinutes reads HH:mm; 23:59 means the end of the day", () => {
  expect(clockToMinutes("07:30", 0)).toBe(450);
  expect(clockToMinutes("23:59", 0)).toBe(1440);
  expect(clockToMinutes("24:00", 0)).toBe(1440);
  expect(clockToMinutes(undefined, 60)).toBe(60);
  expect(clockToMinutes("x", 60)).toBe(60);
});
