/*
 * Timed events are indexed once per render by the slot they start in; a
 * start between slot lines is shown in the slot below it, offset down.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { Calendar } from "../../index";
import { slotOffsetTop } from "../../Utils/slotHeight";

beforeAll(() => {
  (global as unknown as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
});

const renderWeek = (events: { id: string; start: string; end: string }[], extra = {}) =>
  render(
    <Calendar
      events={events.map((e) => ({ title: e.id, ...e }))}
      currentDate={new Date("2026-03-11T12:00:00Z")}
      config={{ timeZone: "UTC", defaultView: "week", slotDuration: 30, slotHeight: 40, ...extra }}
    />
  );

/** `top` of the event's box inside its slot (the slot's direct child). */
const topOf = (container: HTMLElement, id: string) =>
  (container.querySelector(`[data-event-id="${id}"]`)?.closest(".react-agendfy-weektimeslot > *") as HTMLElement | null)
    ?.style.top;

it("shows events that start between slot lines, offset inside the slot", async () => {
  const { container } = renderWeek([
    { id: "on", start: "2026-03-11T10:00:00Z", end: "2026-03-11T11:00:00Z" },
    { id: "off", start: "2026-03-12T10:15:00Z", end: "2026-03-12T11:00:00Z" },
  ]);
  await screen.findAllByRole("columnheader");
  expect(container.querySelector('[data-event-id="on"]')).not.toBeNull();
  expect(container.querySelector('[data-event-id="off"]')).not.toBeNull();
  // 15 of 30 minutes into the slot, 40px per slot.
  expect(topOf(container, "off")).toBe("20px");
});

it("keeps midnight-crossing events as one segment per day", async () => {
  const { container } = renderWeek(
    [{ id: "night", start: "2026-03-11T22:00:00Z", end: "2026-03-12T02:00:00Z" }],
    { slotMin: "00:00", slotMax: "24:00" }
  );
  await screen.findAllByRole("columnheader");
  // Both segments carry the public id (the continuation's internal id is "night::cont").
  const segments = container.querySelectorAll('[data-event-id="night"]');
  expect(segments).toHaveLength(2);
  // On-grid start (22:00): top of its slot.
  expect(topOf(container, "night")).toBe("0px");
});

it("slotOffsetTop: on-grid and continuation starts sit at the top", () => {
  const config = { slotDuration: 30, slotHeight: 40 };
  expect(slotOffsetTop({ start: "2026-03-11T10:00:00Z" }, "2026-03-11T10:00:00Z", config)).toBe("0");
  expect(slotOffsetTop({ start: "2026-03-11T10:10:00Z" }, "2026-03-11T10:00:00Z", config)).toBe(`${(10 / 30) * 40}px`);
  expect(slotOffsetTop({ start: "2026-03-11T09:00:00Z" }, "2026-03-11T10:00:00Z", config)).toBe("0");
});
