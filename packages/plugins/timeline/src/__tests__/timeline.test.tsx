/*
 * The timeline views through the real <Calendar> (jsdom: no layout, so
 * every row and slot is rendered).
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Calendar, type CalendarApi, type EventProps, type Resource } from "@react-agendfy/core";
import timelinePlugins, { createTimelinePlugins } from "../index";

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

const at = (h: number, m = 0, day = 11) =>
  `2026-03-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const WEDNESDAY = new Date(at(12));

const resources: Resource[] = [
  {
    id: "clinic",
    title: "Clinic",
    children: [
      { id: "ana", title: "Dr. Ana" },
      { id: "rui", title: "Dr. Rui", businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "13:00" }] },
    ],
  },
  { id: "room", title: "Room 2" },
];
const events: EventProps[] = [
  { id: "a1", title: "Consulta A", start: at(10), end: at(11), resourceId: "ana" },
  { id: "a2", title: "Consulta B", start: at(10, 30), end: at(11, 30), resourceId: "ana" },
  { id: "free", title: "Sem recurso", start: at(14), end: at(15) },
];

const renderTimeline = (view = "timelineDay", props: Partial<React.ComponentProps<typeof Calendar>> = {}) => {
  const apiRef = React.createRef<CalendarApi>();
  const utils = render(
    <Calendar
      events={events}
      resources={resources}
      currentDate={WEDNESDAY}
      apiRef={apiRef}
      plugins={timelinePlugins}
      {...props}
      config={{ timeZone: "UTC", defaultView: view as never, slotMin: "08:00", slotMax: "18:00", slotDuration: 30, ...props.config }}
    />
  );
  return { ...utils, apiRef };
};

const rowTitles = (container: HTMLElement) =>
  [...container.querySelectorAll(".agendfy-timeline-resource-title")].map((e) => e.textContent);
const rowOf = (container: HTMLElement, title: string) =>
  [...container.querySelectorAll<HTMLElement>(".agendfy-timeline-row")].find((r) =>
    r.querySelector(".agendfy-timeline-resource-title")!.textContent === title
  )!;

it("offers timelineDay / Week / Month, translated", async () => {
  render(<Calendar events={[]} resources={resources} currentDate={WEDNESDAY} plugins={timelinePlugins} config={{ timeZone: "UTC", defaultView: "week", lang: "pt" }} />);
  expect(await screen.findByRole("button", { name: "Linha do tempo (dia)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Linha do tempo (semana)" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Linha do tempo (mês)" })).toBeInTheDocument();
});

it("rows follow the resource tree, then the unassigned events", async () => {
  const { container } = renderTimeline();
  await screen.findByRole("grid");
  expect(rowTitles(container)).toEqual(["Clinic", "Dr. Ana", "Dr. Rui", "Room 2", "Unassigned"]);
  expect(rowOf(container, "Unassigned").querySelector('[data-event-id="free"]')).not.toBeNull();
});

it("collapsing a group hides its children", async () => {
  const { container } = renderTimeline();
  await screen.findByRole("grid");
  fireEvent.click(screen.getByRole("button", { name: "Collapse Clinic" }));
  expect(rowTitles(container)).toEqual(["Clinic", "Room 2", "Unassigned"]);
  expect(screen.getByRole("button", { name: "Expand Clinic" })).toHaveAttribute("aria-expanded", "false");
});

it("positions bars on the time axis and stacks overlaps in lanes", async () => {
  const { container } = renderTimeline();
  await screen.findByRole("grid");
  const ana = rowOf(container, "Dr. Ana");
  const a1 = ana.querySelector<HTMLElement>('[data-event-id="a1"]')!;
  const a2 = ana.querySelector<HTMLElement>('[data-event-id="a2"]')!;
  // Day zoom: 30-min slots of 48px from 08:00.
  expect(a1.style.left).toBe("192px");
  expect(a1.style.width).toBe("96px");
  expect(a1.style.top).not.toBe(a2.style.top);
  // Two lanes: the row is taller than a one-lane row.
  expect(parseFloat(ana.style.height)).toBeGreaterThan(parseFloat(rowOf(container, "Room 2").style.height));
});

it("shades the time outside each resource's hours", async () => {
  const { container } = renderTimeline();
  await screen.findByRole("grid");
  const off = (title: string) =>
    [...rowOf(container, title).querySelectorAll<HTMLElement>(".react-agendfy-non-business")].map(
      (s) => `${s.style.left}+${s.style.width}`
    );
  // 08:00–18:00 at 96px/h. Calendar 09–17; Dr. Rui 09–13.
  expect(off("Dr. Ana")).toEqual(["0px+96px", "864px+96px"]);
  expect(off("Dr. Rui")).toEqual(["0px+96px", "480px+480px"]);
});

it("a slot click reports the time and the resource", async () => {
  const onSlotClick = jest.fn();
  const { container } = renderTimeline("timelineDay", { onSlotClick });
  await screen.findByRole("grid");
  fireEvent.click(rowOf(container, "Room 2").querySelectorAll(".agendfy-timeline-slot")[4]);
  expect(onSlotClick).toHaveBeenCalledWith(new Date(at(10)), { resourceId: "room" });
});

it("week and month ranges, and navigation by their own step", async () => {
  const onDatesSet = jest.fn();
  const { apiRef, unmount } = renderTimeline("timelineWeek", { onDatesSet, config: { weekStartsOn: 1 } });
  await screen.findByRole("grid");
  expect(apiRef.current!.getView()).toMatchObject({ activeStart: new Date(at(0, 0, 9)), activeEnd: new Date(at(0, 0, 16)) });
  act(() => apiRef.current!.next());
  expect(apiRef.current!.getView().activeStart).toEqual(new Date(at(0, 0, 16)));
  unmount();

  const month = renderTimeline("timelineMonth");
  await screen.findAllByRole("grid");
  expect(month.apiRef.current!.getView()).toMatchObject({
    activeStart: new Date("2026-03-01T00:00:00.000Z"),
    activeEnd: new Date("2026-04-01T00:00:00.000Z"),
  });
});

it("options: unassigned row off, custom slot width", async () => {
  const { container } = renderTimeline("timelineDay", {
    plugins: createTimelinePlugins({ showUnassigned: false, slotWidth: 20 }),
  });
  await screen.findByRole("grid");
  expect(rowTitles(container)).not.toContain("Unassigned");
  expect(rowOf(container, "Dr. Ana").querySelector<HTMLElement>('[data-event-id="a1"]')!.style.left).toBe("80px");
});
