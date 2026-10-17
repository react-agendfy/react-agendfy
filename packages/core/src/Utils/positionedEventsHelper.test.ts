import { computeDayLayout, layoutPositionStyle } from "./positionedEventsHelper";

const ev = (id: string, start: string, end: string) => ({
  id,
  title: id,
  start: `2026-10-14T${start}:00Z`,
  end: `2026-10-14T${end}:00Z`,
});

describe("computeDayLayout", () => {
  it("gives a lone event the full width", () => {
    const layout = computeDayLayout([ev("a", "09:00", "10:00")], "UTC");
    expect(layout.get("a")).toEqual({ column: 0, columns: 1, span: 1 });
    expect(layoutPositionStyle(layout.get("a"))).toEqual({ left: "0%", width: "100%" });
  });

  it("splits events that overlap even when they start in different slots", () => {
    // The per-slot layout drew b on top of a at full width.
    const layout = computeDayLayout([ev("a", "12:00", "12:45"), ev("b", "12:15", "13:00")], "UTC");
    expect(layout.get("a")).toMatchObject({ column: 0, columns: 2 });
    expect(layout.get("b")).toMatchObject({ column: 1, columns: 2 });
  });

  it("keeps back-to-back events full width (touching is not overlapping)", () => {
    const layout = computeDayLayout([ev("a", "11:30", "12:00"), ev("b", "12:00", "12:30")], "UTC");
    expect(layout.get("a")!.columns).toBe(1);
    expect(layout.get("b")!.columns).toBe(1);
  });

  it("reuses a freed column and lets events stretch over free columns", () => {
    // a 9-12 | b 9-10 | c 9-10, then d 10-11 reuses b's column and can
    // stretch into c's freed column.
    const layout = computeDayLayout(
      [ev("a", "09:00", "12:00"), ev("b", "09:00", "10:00"), ev("c", "09:00", "10:00"), ev("d", "10:00", "11:00")],
      "UTC"
    );
    expect(layout.get("a")).toMatchObject({ column: 0, columns: 3, span: 1 });
    expect(layout.get("d")).toMatchObject({ column: 1, columns: 3, span: 2 });
  });

  it("starts a new cluster after a gap", () => {
    const layout = computeDayLayout(
      [ev("a", "09:00", "10:00"), ev("b", "09:30", "10:30"), ev("c", "14:00", "15:00")],
      "UTC"
    );
    expect(layout.get("a")!.columns).toBe(2);
    expect(layout.get("c")).toEqual({ column: 0, columns: 1, span: 1 });
  });

  it("uses plain percentages (re-resizable mangles calc() widths)", () => {
    expect(layoutPositionStyle({ column: 0, columns: 2, span: 1 })).toEqual({ left: "0%", width: "50%" });
    expect(layoutPositionStyle({ column: 1, columns: 3, span: 2 })).toEqual({
      left: `${100 / 3}%`,
      width: `${(100 / 3) * 2}%`,
    });
  });
});
