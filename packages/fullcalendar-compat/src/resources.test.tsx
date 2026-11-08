/*
 * FullCalendar premium resource options on agendfy's resource views:
 * resourceTimeGridDay/Week, `resources`, dateClick.resource and
 * eventDrop.newResource / oldResource.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import FullCalendar from "./index";
import { toAgendfyResources, toAgendfyView, toFcView } from "./convert";
import type { DateClickArg, EventDropArg, ResourceInput } from "./types";

type DndProps = { onDragEnd?: (e: unknown) => void };
const dnd: DndProps[] = [];
jest.mock("@dnd-kit/core", () => {
  const actual = jest.requireActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props: DndProps & { children: React.ReactNode }) => {
      dnd.push(props);
      return <>{props.children}</>;
    },
    DragOverlay: () => null,
  };
});

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

const resources: ResourceInput[] = [
  { id: "a", title: "Dr. Ana", specialty: "GP" },
  { id: "b", title: "Dr. Rui", businessHours: { daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "13:00" } },
];
const events = [{ id: "1", title: "Consulta", start: "2026-03-11T10:00:00Z", end: "2026-03-11T11:00:00Z", resourceId: "a" }];

it("maps the resource views and ResourceInput", () => {
  expect(toAgendfyView("resourceTimeGridDay")).toEqual({ view: "resourceDay" });
  expect(toAgendfyView("resourceTimeGridWeek")).toEqual({ view: "resourceWeek" });
  expect(toFcView("resourceDay")).toBe("resourceTimeGridDay");
  expect(toAgendfyResources(resources)).toEqual([
    { id: "a", title: "Dr. Ana", specialty: "GP", extendedProps: { specialty: "GP" } },
    {
      id: "b",
      title: "Dr. Rui",
      extendedProps: {},
      businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "13:00" }],
    },
  ]);
});

it("renders resourceTimeGridDay with one column per resource; dateClick gets the resource", async () => {
  const dateClick = jest.fn<void, [DateClickArg]>();
  const { container } = render(
    <FullCalendar
      initialView="resourceTimeGridDay"
      initialDate="2026-03-11"
      timeZone="UTC"
      resources={resources}
      events={events}
      dateClick={dateClick}
      slotMinTime="08:00:00"
    />
  );
  await screen.findAllByRole("columnheader");
  expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Dr. Ana", "Dr. Rui"]);
  const rui = [...container.querySelectorAll(".react-agendfy-rtg-column")][1];
  fireEvent.click(rui.querySelectorAll(".react-agendfy-rtg-slot")[2]);
  expect(dateClick.mock.calls[0][0]).toMatchObject({
    dateStr: "2026-03-11T09:00:00Z",
    allDay: false,
    resource: { id: "b", title: "Dr. Rui" },
  });
});

it("eventDrop reports newResource / oldResource when the resource changes", async () => {
  dnd.length = 0;
  const eventDrop = jest.fn<void, [EventDropArg]>();
  render(
    <FullCalendar
      initialView="resourceTimeGridDay"
      initialDate="2026-03-11"
      timeZone="UTC"
      editable
      resources={resources}
      events={events}
      eventDrop={eventDrop}
    />
  );
  await screen.findAllByRole("columnheader");
  const moved = { ...events[0], start: events[0].start, end: events[0].end };
  act(() =>
    dnd[dnd.length - 1].onDragEnd?.({
      active: { id: "1@a", data: { current: { event: moved, resourceId: "a" } } },
      over: { id: "zone", data: { current: { zone: { date: new Date("2026-03-11T12:00:00Z"), resourceIds: ["b"] } } } },
      delta: { x: 200, y: 80 },
    })
  );
  const arg = eventDrop.mock.calls[0][0];
  expect(arg.event.startStr).toBe("2026-03-11T12:00:00Z");
  expect(arg.oldResource).toMatchObject({ id: "a", title: "Dr. Ana", extendedProps: { specialty: "GP" } });
  expect(arg.newResource).toMatchObject({ id: "b", title: "Dr. Rui" });
});
