import { layoutLanes } from "./lanes";

const ev = (id: string, from: number, to: number) => ({
  id,
  title: id,
  start: new Date(Date.UTC(2026, 2, 11, from)).toISOString(),
  end: new Date(Date.UTC(2026, 2, 11, to)).toISOString(),
});

it("stacks overlapping events in the first free lane", () => {
  const { lanes, count } = layoutLanes([ev("a", 9, 12), ev("b", 10, 11), ev("c", 11, 13), ev("d", 12, 14)]);
  expect(Object.fromEntries(lanes)).toEqual({ a: 0, b: 1, c: 1, d: 0 });
  expect(count).toBe(2);
});

it("a custom span (pixels with a minimum width) separates short events drawn wider", () => {
  // 09:00–10:00 and 11:00–12:00 never overlap in time, but drawn 40px wide
  // at 10px per hour they cover each other.
  const px = (e: { start: string; end: string }) => {
    const x = (new Date(e.start).getUTCHours() - 9) * 10;
    return [x, x + 40] as [number, number];
  };
  expect(layoutLanes([ev("a", 9, 10), ev("b", 11, 12)]).count).toBe(1);
  expect(Object.fromEntries(layoutLanes([ev("a", 9, 10), ev("b", 11, 12)], px).lanes)).toEqual({ a: 0, b: 1 });
});

it("touching events share a lane; an empty row has one lane", () => {
  expect(Object.fromEntries(layoutLanes([ev("a", 9, 10), ev("b", 10, 11)]).lanes)).toEqual({ a: 0, b: 0 });
  expect(layoutLanes([]).count).toBe(1);
});
