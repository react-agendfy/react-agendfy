/*
 * Items dragged in from outside the calendar: conversion to events and the
 * "receive" change through <Calendar> (rules, revert, no history).
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Calendar } from "../index";
import type { CalendarApi, EventProps } from "../types/types";
import type { CalendarPlugin } from "../types/plugins";
import useCalendarState from "../hooks/useCalendarState";
import { eventFromExternal, eventFromExternalOnDay, externalDragData, type ExternalDragData } from "../Utils/externalDrag";

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

const ext: ExternalDragData = {
  id: "p-1",
  template: { title: "Follow-up", color: "#0ea5e9" },
  duration: 30,
  data: { patientId: 7 },
};

describe("conversion", () => {
  it("a timed drop: start + duration, template fields kept, id from item + time", () => {
    expect(eventFromExternal(ext, new Date("2026-03-11T10:00:00Z"))).toEqual({
      id: "p-1@2026-03-11T10:00:00.000Z",
      title: "Follow-up",
      color: "#0ea5e9",
      start: "2026-03-11T10:00:00.000Z",
      end: "2026-03-11T10:30:00.000Z",
      allDay: false,
    });
  });

  it("the template id wins", () => {
    expect(eventFromExternal({ ...ext, template: { ...ext.template, id: "x" } }, new Date()).id).toBe("x");
  });

  it("month drop: all-day without startTime, timed at startTime in the calendar zone", () => {
    // Midnight of 11 March in São Paulo (UTC-3).
    const day = new Date("2026-03-11T03:00:00Z");
    expect(eventFromExternalOnDay(ext, day, "America/Sao_Paulo")).toMatchObject({
      start: "2026-03-11T03:00:00.000Z",
      end: "2026-03-12T03:00:00.000Z",
      allDay: true,
    });
    expect(eventFromExternalOnDay({ ...ext, startTime: "09:30" }, day, "America/Sao_Paulo")).toMatchObject({
      start: "2026-03-11T12:30:00.000Z",
      end: "2026-03-11T13:00:00.000Z",
      allDay: false,
    });
  });

  it("externalDragData tells external items from calendar events", () => {
    expect(externalDragData({ id: "x", data: { current: { external: ext } } } as never)).toBe(ext);
    expect(externalDragData({ id: "x", data: { current: { event: {} } } } as never)).toBeNull();
    expect(externalDragData({ id: "x" } as never)).toBeNull();
    expect(externalDragData(null)).toBeNull();
  });
});

describe("receive through <Calendar>", () => {
  const at = (h: number) => `2026-03-11T${String(h).padStart(2, "0")}:00:00.000Z`;
  /** Stands in for a view's drop: hands the new event to handleEventReceive. */
  const ReceiveView = ({ events }: { events: EventProps[] }) => {
    const { handleEventReceive } = useCalendarState();
    return (
      <div>
        <span data-testid="titles">{events.map((e) => e.title).join(",")}</span>
        <span data-testid="accepts">{handleEventReceive ? "yes" : "no"}</span>
        {[10, 14].map((h) => (
          <button key={h} onClick={() => handleEventReceive?.(eventFromExternal(ext, new Date(at(h))), ext.data)}>
            {`drop-${h}`}
          </button>
        ))}
      </div>
    );
  };
  const view = { key: "r", type: "view", viewName: "receive", component: ReceiveView } as CalendarPlugin;
  const renderReceive = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) => {
    const apiRef = React.createRef<CalendarApi>();
    render(
      <Calendar
        events={[{ id: "busy", title: "Busy", start: at(10), end: at(11) }]}
        currentDate={new Date(at(12))}
        apiRef={apiRef}
        plugins={[view]}
        {...props}
        config={{ timeZone: "UTC", defaultView: "receive" as never, ...props.config }}
      />
    );
    return apiRef;
  };
  const titles = () => screen.getByTestId("titles").textContent;

  it("without onEventReceive the calendar accepts no external drops", async () => {
    renderReceive();
    expect((await screen.findByTestId("accepts")).textContent).toBe("no");
  });

  it("adds the event, calls onEventReceive with the item's data, records no history", async () => {
    const onEventReceive = jest.fn();
    const apiRef = renderReceive({ onEventReceive });
    fireEvent.click(await screen.findByText("drop-14"));
    expect(onEventReceive).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Follow-up", start: at(14), end: "2026-03-11T14:30:00.000Z" }),
      { patientId: 7 }
    );
    expect(titles()).toBe("Busy,Follow-up");
    expect(apiRef.current!.canUndo()).toBe(false);
  });

  it("the rules apply: a refused drop adds nothing and reports kind 'receive'", async () => {
    const onEventReceive = jest.fn();
    const onChangeRejected = jest.fn();
    renderReceive({ onEventReceive, onChangeRejected, config: { eventOverlap: false } });
    fireEvent.click(await screen.findByText("drop-10"));
    expect(onEventReceive).not.toHaveBeenCalled();
    expect(titles()).toBe("Busy");
    expect(onChangeRejected.mock.calls[0][0]).toMatchObject({ reason: "overlap", change: { kind: "receive", data: { patientId: 7 } } });
  });

  it("a rejected promise removes the received event", async () => {
    let reject!: (e: unknown) => void;
    const onEventReceive = jest.fn(() => new Promise((_, r) => (reject = r)));
    renderReceive({ onEventReceive });
    fireEvent.click(await screen.findByText("drop-14"));
    expect(titles()).toBe("Busy,Follow-up");
    await act(async () => reject(new Error("full")));
    expect(titles()).toBe("Busy");
  });
});
