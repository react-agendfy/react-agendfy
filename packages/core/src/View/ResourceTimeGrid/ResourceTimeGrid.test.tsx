/*
 * resourceDay / resourceWeek through the real <Calendar> (jsdom: no layout,
 * so every column is rendered at its minimum width).
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Calendar } from "../../index";
import type { CalendarApi, EventProps, Resource } from "../../types/types";

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

const WEDNESDAY = new Date("2026-03-11T12:00:00Z");
const at = (h: number, m = 0, day = 11) =>
  `2026-03-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
const resources: Resource[] = [
  { id: "r1", title: "Dr. Ana" },
  { id: "r2", title: "Dr. Rui", businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "13:00" }] },
];
const events: EventProps[] = [
  { id: "a", title: "Consulta A", start: at(10), end: at(11), resourceId: "r1" },
  { id: "both", title: "Reunião", start: at(14), end: at(15), resourceIds: ["r1", "r2"] },
  { id: "off", title: "Sem recurso", start: at(10), end: at(11) },
  { id: "allday", title: "Congresso", start: "2026-03-11T00:00:00Z", end: "2026-03-12T00:00:00Z", allDay: true, resourceId: "r2" },
];

const renderView = (view: "resourceDay" | "resourceWeek", props: Partial<React.ComponentProps<typeof Calendar>> = {}) => {
  const apiRef = React.createRef<CalendarApi>();
  const utils = render(
    <Calendar
      events={events}
      resources={resources}
      currentDate={WEDNESDAY}
      apiRef={apiRef}
      {...props}
      config={{ timeZone: "UTC", defaultView: view, slotMin: "08:00", slotMax: "18:00", slotDuration: 30, ...props.config }}
    />
  );
  return { ...utils, apiRef };
};

const column = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll<HTMLElement>(".react-agendfy-rtg-column")].find((c) =>
    c.getAttribute("aria-label")!.startsWith(`${label},`)
  )!;
const idsIn = (el: HTMLElement) => [...el.querySelectorAll("[data-event-id]")].map((e) => e.getAttribute("data-event-id"));

describe("resourceDay", () => {
  it("one column per resource; events by resourceId/resourceIds; none without a resource", async () => {
    const { container } = renderView("resourceDay");
    await screen.findAllByRole("columnheader");
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Dr. Ana", "Dr. Rui"]);
    expect(idsIn(column(container, "Dr. Ana"))).toEqual(["a", "both"]);
    expect(idsIn(column(container, "Dr. Rui"))).toEqual(["both"]);
    expect(container.querySelector('[data-event-id="off"]')).toBeNull();
    // 10:00 with an 08:00 grid start, 30-min slots of 40px.
    const a = column(container, "Dr. Ana").querySelector<HTMLElement>('[data-event-id="a"]')!;
    expect(a.style.top).toBe("160px");
    expect(a.style.height).toBe("80px");
  });

  it("shows all-day events in the all-day row of their resource", async () => {
    const { container } = renderView("resourceDay");
    await screen.findAllByRole("columnheader");
    const cells = container.querySelectorAll(".react-agendfy-rtg-allday-cell");
    expect(idsIn(cells[0] as HTMLElement)).toEqual([]);
    expect(idsIn(cells[1] as HTMLElement)).toEqual(["allday"]);
  });

  it("shades each resource's own business hours, else the calendar's", async () => {
    const { container } = renderView("resourceDay");
    await screen.findAllByRole("columnheader");
    const shade = (label: string) =>
      [...column(container, label).querySelectorAll<HTMLElement>(".react-agendfy-business-hours")].map(
        (s) => `${s.style.top}+${s.style.height}`
      );
    // Calendar default 09:00–17:00; Dr. Rui 09:00–13:00 (grid from 08:00).
    expect(shade("Dr. Ana")).toEqual(["80px+640px"]);
    expect(shade("Dr. Rui")).toEqual(["80px+320px"]);
  });

  it("a slot click reports the time and the resource", async () => {
    const onSlotClick = jest.fn();
    const { container } = renderView("resourceDay", { onSlotClick });
    await screen.findAllByRole("columnheader");
    const slots = column(container, "Dr. Rui").querySelectorAll(".react-agendfy-rtg-slot");
    fireEvent.click(slots[4]); // 10:00
    expect(onSlotClick).toHaveBeenCalledWith(new Date(at(10)), { resourceId: "r2" });
  });

  it("navigates by one day and reports a one-day range", async () => {
    const onDatesSet = jest.fn();
    const { apiRef } = renderView("resourceDay", { onDatesSet });
    await screen.findAllByRole("columnheader");
    expect(onDatesSet).toHaveBeenLastCalledWith(expect.objectContaining({ start: new Date(at(0)), end: new Date(at(0, 0, 12)), view: "resourceDay" }));
    act(() => apiRef.current!.next());
    expect(apiRef.current!.getView().activeStart).toEqual(new Date(at(0, 0, 12)));
  });
});

describe("resourceWeek", () => {
  it("columns by resource then date (default), or by date then resource", async () => {
    const { container, unmount } = renderView("resourceWeek", { config: { weekStartsOn: 1, hiddenDays: [0, 6] } });
    await screen.findAllByRole("columnheader");
    const groups = () => [...container.querySelectorAll(".react-agendfy-rtg-group")].map((g) => g.textContent);
    expect(groups()).toEqual(["Dr. Ana", "Dr. Rui"]);
    expect(container.querySelectorAll(".react-agendfy-rtg-column")).toHaveLength(10);
    unmount();

    const byDate = renderView("resourceWeek", { config: { weekStartsOn: 1, hiddenDays: [0, 6], datesAboveResources: true } });
    await screen.findAllByRole("columnheader");
    expect([...byDate.container.querySelectorAll(".react-agendfy-rtg-group")].map((g) => g.textContent)).toEqual([
      "Mon 9",
      "Tue 10",
      "Wed 11",
      "Thu 12",
      "Fri 13",
    ]);
  });
});

describe("header buttons", () => {
  it("the resource views are offered only when there are resources", async () => {
    const { rerender } = render(<Calendar events={[]} currentDate={WEDNESDAY} config={{ timeZone: "UTC", defaultView: "week" }} />);
    await screen.findAllByRole("columnheader");
    expect(screen.queryByRole("button", { name: "Resource day" })).toBeNull();
    rerender(<Calendar events={[]} resources={resources} currentDate={WEDNESDAY} config={{ timeZone: "UTC", defaultView: "week" }} />);
    expect(screen.getByRole("button", { name: "Resource day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resource week" })).toBeInTheDocument();
  });

  it("translated labels", async () => {
    render(<Calendar events={[]} resources={resources} currentDate={WEDNESDAY} config={{ timeZone: "UTC", defaultView: "week", lang: "pt" }} />);
    expect(await screen.findByRole("button", { name: "Recursos (dia)" })).toBeInTheDocument();
  });
});
