/*
 * eventOverlap / eventConstraint / eventAllow / selectAllow / selectOverlap
 * through <FullCalendar>, with FullCalendar argument shapes. A native agendfy
 * view stands in for a drag (jsdom has no layout).
 */
import React from "react";
import { configure, fireEvent, render, screen } from "@testing-library/react";
import type { EventProps } from "@react-agendfy/core";
import FullCalendar from "./index";
import type { DropInfo, EventApi, EventDropArg, EventInput, FullCalendarComponentProps } from "./types";

configure({ asyncUtilTimeout: 5000 });

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

const at = (h: number) => `2026-03-11T${String(h).padStart(2, "0")}:00:00.000Z`; // Wednesday

/** Drops event "1" (1h long) at the hour on the clicked button. */
const DropView = ({ events, onEventUpdate }: { events: EventProps[]; onEventUpdate: (e: EventProps) => void }) => {
  const one = events.find((e) => e.id === "1")!;
  return (
    <div>
      {[7, 12, 15, 16].map((h) => (
        <button key={h} onClick={() => onEventUpdate({ ...one, start: at(h), end: at(h + 1) })}>
          {`drop-${h}`}
        </button>
      ))}
    </div>
  );
};

const baseEvents: EventInput[] = [
  { id: "1", title: "Consulta Ana", start: at(10), end: at(11) },
  { id: "2", title: "Consulta Rui", start: at(15), end: at(16) },
];

const renderDrop = (props: Partial<FullCalendarComponentProps> = {}) => {
  const eventDrop = jest.fn<void, [EventDropArg]>();
  render(
    <FullCalendar
      initialView="dropTest"
      initialDate="2026-03-11"
      timeZone="UTC"
      editable
      events={baseEvents}
      eventDrop={eventDrop}
      agendfyPlugins={[{ key: "d", type: "view", viewName: "dropTest", component: DropView }]}
      {...props}
    />
  );
  return { eventDrop, drop: async (h: number) => fireEvent.click(await screen.findByText(`drop-${h}`)) };
};

describe("eventOverlap", () => {
  it("false refuses a drop onto another event, without calling eventDrop", async () => {
    const { eventDrop, drop } = renderDrop({ eventOverlap: false });
    await drop(15);
    expect(eventDrop).not.toHaveBeenCalled();
    await drop(12);
    expect(eventDrop).toHaveBeenCalledTimes(1);
  });

  it("a function gets (stillEvent, movingEvent) as EventApi", async () => {
    const eventOverlap = jest.fn((still: EventApi, moving: EventApi | null) => still.title !== "Consulta Rui" && !!moving);
    const { eventDrop, drop } = renderDrop({ eventOverlap });
    await drop(15);
    expect(eventDrop).not.toHaveBeenCalled();
    const [still, moving] = eventOverlap.mock.calls[0];
    expect(still.startStr).toBe("2026-03-11T15:00:00Z");
    expect(moving!.title).toBe("Consulta Ana");
    expect(moving!.startStr).toBe("2026-03-11T15:00:00Z");
  });

  it("an event's own overlap: false blocks others", async () => {
    const { eventDrop, drop } = renderDrop({
      events: [baseEvents[0], { ...baseEvents[1], overlap: false }],
    });
    await drop(15);
    expect(eventDrop).not.toHaveBeenCalled();
  });
});

describe("eventConstraint", () => {
  it('"businessHours" uses the businessHours option', async () => {
    const { eventDrop, drop } = renderDrop({ businessHours: true, eventConstraint: "businessHours" });
    await drop(7);
    expect(eventDrop).not.toHaveBeenCalled();
    await drop(12);
    expect(eventDrop).toHaveBeenCalledTimes(1);
  });

  it("business-hours-like objects", async () => {
    const { eventDrop, drop } = renderDrop({ eventConstraint: { startTime: "14:00", endTime: "18:00" } });
    await drop(12);
    expect(eventDrop).not.toHaveBeenCalled();
    await drop(16);
    expect(eventDrop).toHaveBeenCalledTimes(1);
  });

  it("a groupId: inside an event of that group only (global and per event)", async () => {
    const availability = { id: "slot", groupId: "available", title: "Livre", start: at(14), end: at(18) };
    const global = renderDrop({ events: [...baseEvents, availability], eventConstraint: "available" });
    await global.drop(12);
    expect(global.eventDrop).not.toHaveBeenCalled();
    await global.drop(16);
    expect(global.eventDrop).toHaveBeenCalledTimes(1);
  });

  it("a per-event groupId constraint", async () => {
    const availability = { id: "slot", groupId: "available", title: "Livre", start: at(14), end: at(18) };
    const { eventDrop, drop } = renderDrop({
      events: [{ ...baseEvents[0], constraint: "available" }, availability],
    });
    await drop(12);
    expect(eventDrop).not.toHaveBeenCalled();
    await drop(16);
    expect(eventDrop).toHaveBeenCalledTimes(1);
  });
});

describe("eventAllow", () => {
  it("gets (dropInfo, draggedEvent) and can refuse", async () => {
    const eventAllow = jest.fn((info: DropInfo, dragged: EventApi | null) => info.start.getUTCHours() !== 16 && !!dragged);
    const { eventDrop, drop } = renderDrop({ eventAllow });
    await drop(16);
    expect(eventDrop).not.toHaveBeenCalled();
    const [info, dragged] = eventAllow.mock.calls[0];
    expect(info).toMatchObject({ startStr: "2026-03-11T16:00:00Z", endStr: "2026-03-11T17:00:00Z", allDay: false });
    expect(dragged!.startStr).toBe("2026-03-11T10:00:00Z"); // before the drop, like FullCalendar
    await drop(12);
    expect(eventDrop).toHaveBeenCalledTimes(1);
  });
});

describe("selectAllow / selectOverlap", () => {
  const renderMonth = (props: Partial<FullCalendarComponentProps>) => {
    const select = jest.fn();
    const utils = render(
      <FullCalendar
        initialView="dayGridMonth"
        initialDate="2026-03-11"
        timeZone="UTC"
        selectable
        events={[{ id: "x", title: "Ocupado", start: "2026-03-11T10:00:00Z", end: "2026-03-11T11:00:00Z" }]}
        select={select}
        {...props}
      />
    );
    const cell = (d: string) => utils.container.querySelector(`[data-date="${d}"]`)!;
    const selectDays = (from: string, to: string) => {
      fireEvent.mouseDown(cell(from));
      fireEvent.mouseMove(cell(to));
      fireEvent.mouseUp(cell(to));
    };
    return { select, selectDays };
  };

  it("selectAllow gets FullCalendar's selectInfo (exclusive all-day end) and can refuse", async () => {
    const selectAllow = jest.fn((info: DropInfo) => info.endStr !== "2026-03-14");
    const { select, selectDays } = renderMonth({ selectAllow });
    await screen.findAllByRole("gridcell");
    selectDays("2026-03-12", "2026-03-13");
    expect(selectAllow).toHaveBeenCalledWith(
      expect.objectContaining({ startStr: "2026-03-12", endStr: "2026-03-14", allDay: true })
    );
    expect(select).not.toHaveBeenCalled();
    selectDays("2026-03-12", "2026-03-12");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("selectOverlap: false refuses selections over events", async () => {
    const { select, selectDays } = renderMonth({ selectOverlap: false });
    await screen.findAllByRole("gridcell");
    selectDays("2026-03-10", "2026-03-12");
    expect(select).not.toHaveBeenCalled();
    selectDays("2026-03-16", "2026-03-17");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("selectOverlap as a function decides per event", async () => {
    const selectOverlap = jest.fn((event: EventApi) => event.title !== "Ocupado");
    const { select, selectDays } = renderMonth({ selectOverlap });
    await screen.findAllByRole("gridcell");
    selectDays("2026-03-11", "2026-03-11");
    expect(selectOverlap).toHaveBeenCalledWith(expect.objectContaining({ title: "Ocupado" }));
    expect(select).not.toHaveBeenCalled();
  });
});
