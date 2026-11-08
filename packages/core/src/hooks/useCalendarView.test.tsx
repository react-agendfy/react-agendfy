/*
 * The public SDK for custom views: useCalendarView (texts, formatting,
 * actions) and drag & drop through useEventDraggable / useDropZone.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Calendar, useCalendarView, useDropZone, useEventDraggable } from "../index";
import type { CalendarApi, EventProps } from "../types/types";
import type { CalendarPlugin } from "../types/plugins";

type DndProps = { onDragEnd?: (e: unknown) => void; onDragMove?: (e: unknown) => void };
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
const lastDnd = () => dnd[dnd.length - 1];

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
});
beforeEach(() => {
  dnd.length = 0;
});

const at = (h: number, day = 11) => `2026-03-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00.000Z`;
const ev = (id: string, h: number, extra: Partial<EventProps> = {}): EventProps => ({
  id,
  title: id,
  start: at(h),
  end: at(h + 1),
  ...extra,
});
const MARCH_11 = new Date(at(12));

const messages = {
  en: { "team.title": "Team ({count})", "team.button": "Team" },
  pt: { "team.title": "Equipa ({count})", "team.button": "Equipa" },
};

/** A custom view written only against the public SDK. */
const TeamView = () => {
  const cal = useCalendarView();
  return (
    <div>
      <h3 data-testid="title">{cal.t("team.title", { count: cal.events.length })}</h3>
      <span data-testid="time">{cal.formatTime(at(14))}</span>
      <span data-testid="date">{cal.formatDate(cal.date, "d MMM")}</span>
      <span data-testid="range">{`${cal.range.start.toISOString()}|${cal.range.end.toISOString()}`}</span>
      {cal.events.map((e) => (
        <button key={e.id} onClick={() => cal.moveEvent(e, { start: new Date(at(15)), end: new Date(at(16)) })}>
          {`move-${e.id}`}
        </button>
      ))}
      <span data-testid="valid">
        {String(cal.validate({ kind: "move", event: ev("a", 9), before: cal.events[0] }) === true)}
      </span>
      <button onClick={() => cal.gotoDate("2026-04-01")}>goto-april</button>
    </div>
  );
};
const team = (extra: Partial<CalendarPlugin> = {}) =>
  ({
    key: "team",
    type: "view",
    viewName: "team",
    label: { key: "team.button" },
    messages,
    component: TeamView,
    ...extra,
  }) as CalendarPlugin;

describe("useCalendarView", () => {
  it("translates with the plugin's messages for the language, config keys win", async () => {
    const { rerender } = render(
      <Calendar events={[ev("a", 10)]} currentDate={MARCH_11} plugins={[team()]} config={{ timeZone: "UTC", lang: "pt-PT", defaultView: "team" as never }} />
    );
    expect((await screen.findByTestId("title")).textContent).toBe("Equipa (1)");
    expect(screen.getByRole("button", { name: "Equipa" })).toBeInTheDocument();

    rerender(
      <Calendar
        events={[ev("a", 10)]}
        currentDate={MARCH_11}
        plugins={[team()]}
        config={{ timeZone: "UTC", lang: "fr", defaultView: "team" as never, ["team.title" as never]: "Mon équipe ({count})" }}
      />
    );
    expect(screen.getByTestId("title").textContent).toBe("Mon équipe (1)");
    // No French messages: the label falls back to English.
    expect(screen.getByRole("button", { name: "Team" })).toBeInTheDocument();
  });

  it("formats in the calendar zone and reports the view's range", async () => {
    render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        plugins={[team({ range: () => ({ start: new Date(at(0, 9)), end: new Date(at(0, 16)) }) })]}
        config={{ timeZone: "Europe/Lisbon", lang: "en", defaultView: "team" as never, eventTimeFormat: "h:mm a" }}
      />
    );
    expect((await screen.findByTestId("time")).textContent).toBe("2:00 PM");
    expect(screen.getByTestId("date").textContent).toBe("11 Mar");
    expect(screen.getByTestId("range").textContent).toBe(`${at(0, 9)}|${at(0, 16)}`);
  });

  it("moveEvent goes through the pipeline (rules, callback, undo); validate has no side effects", async () => {
    const onEventUpdate = jest.fn();
    const apiRef = React.createRef<CalendarApi>();
    render(
      <Calendar
        events={[ev("a", 10), ev("b", 15)]}
        currentDate={MARCH_11}
        apiRef={apiRef}
        onEventUpdate={onEventUpdate}
        plugins={[team()]}
        config={{ timeZone: "UTC", defaultView: "team" as never, eventConstraint: { start: at(10) } }}
      />
    );
    // 09:00 is before the constraint: refused, nothing applied.
    expect((await screen.findByTestId("valid")).textContent).toBe("false");
    expect(onEventUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("move-a"));
    expect(onEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "a", start: at(15), end: at(16) }));
    expect(apiRef.current!.canUndo()).toBe(true);
  });

  it("gotoDate navigates", async () => {
    const apiRef = React.createRef<CalendarApi>();
    render(<Calendar events={[]} currentDate={MARCH_11} apiRef={apiRef} plugins={[team()]} config={{ timeZone: "UTC", defaultView: "team" as never }} />);
    fireEvent.click(await screen.findByText("goto-april"));
    expect(apiRef.current!.getDate().toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("throws a clear error outside a calendar", () => {
    const Lost = () => {
      useCalendarView();
      return null;
    };
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Lost />)).toThrow(/inside <Calendar>/);
  });
});

describe("drag & drop in custom views", () => {
  /** Two resource rows × one zone at 14:00, and draggable events. */
  const RowsView = () => {
    const { events } = useCalendarView();
    return (
      <div>
        {["r1", "r2"].map((r) => (
          <Zone key={r} id={r} />
        ))}
        {events.map((e) => (
          <Draggable key={e.id} event={e} />
        ))}
      </div>
    );
  };
  const Zone = ({ id }: { id: string }) => {
    const { setNodeRef } = useDropZone(id, { date: new Date(at(14)), resourceIds: [id] });
    return <div ref={setNodeRef}>{`zone-${id}`}</div>;
  };
  const Draggable = ({ event }: { event: EventProps }) => {
    const { setNodeRef, attributes, listeners } = useEventDraggable(event);
    return (
      <div ref={setNodeRef} {...attributes} {...listeners}>
        {event.title}
      </div>
    );
  };
  const rows = { key: "rows", type: "view", viewName: "rows", component: RowsView } as CalendarPlugin;

  const zone = (id: string, date = new Date(at(14)), extra = {}) => ({
    id: `agendfy-zone:${id}`,
    data: { current: { zone: { date, resourceIds: [id], ...extra } } },
  });
  const drag = (event: EventProps) => ({ id: event.id, data: { current: { event } } });

  const renderRows = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) =>
    render(
      <Calendar
        events={[ev("a", 10, { resourceId: "r1" }), ev("b", 14, { resourceId: "r2" })]}
        currentDate={MARCH_11}
        plugins={[rows]}
        {...props}
        config={{ timeZone: "UTC", defaultView: "rows" as never, ...props.config }}
      />
    );

  it("a drop on a zone moves the event there, keeping its duration and switching resource", async () => {
    const onEventUpdate = jest.fn();
    renderRows({ onEventUpdate });
    await screen.findByText("zone-r1");
    act(() => lastDnd().onDragEnd?.({ active: drag(ev("a", 10, { resourceId: "r1" })), over: zone("r2", new Date(at(16))), delta: { x: 0, y: 80 } }));
    expect(onEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", start: at(16), end: at(17), resourceId: "r2", allDay: false })
    );
  });

  it("the rules apply: overlapping on the same resource is refused", async () => {
    const onEventUpdate = jest.fn();
    const onChangeRejected = jest.fn();
    renderRows({ onEventUpdate, onChangeRejected, config: { eventOverlap: false } });
    await screen.findByText("zone-r1");
    act(() => lastDnd().onDragEnd?.({ active: drag(ev("a", 10, { resourceId: "r1" })), over: zone("r2"), delta: { x: 0, y: 80 } }));
    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(onChangeRejected.mock.calls[0][0].reason).toBe("overlap");
    // Same time, other resource: fine.
    act(() => lastDnd().onDragEnd?.({ active: drag(ev("a", 10, { resourceId: "r1" })), over: zone("r1"), delta: { x: 0, y: 80 } }));
    expect(onEventUpdate).toHaveBeenCalledWith(expect.objectContaining({ start: at(14), resourceId: "r1" }));
  });

  it("an all-day zone makes the event all-day; events with resourceIds keep using resourceIds", async () => {
    const onEventUpdate = jest.fn();
    renderRows({ onEventUpdate, events: [ev("m", 10, { resourceIds: ["r1", "r3"] })] });
    await screen.findByText("zone-r1");
    act(() =>
      lastDnd().onDragEnd?.({
        active: drag(ev("m", 10, { resourceIds: ["r1", "r3"] })),
        over: zone("r2", new Date("2026-03-12T00:00:00.000Z"), { allDay: true }),
        delta: { x: 40, y: 0 },
      })
    );
    expect(onEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ start: "2026-03-12T00:00:00.000Z", end: "2026-03-13T00:00:00.000Z", allDay: true, resourceIds: ["r2"] })
    );
  });

  it("a tiny movement is a click; no zone means no move", async () => {
    const onEventUpdate = jest.fn();
    const onEventClick = jest.fn();
    renderRows({ onEventUpdate, onEventClick });
    await screen.findByText("zone-r1");
    act(() => lastDnd().onDragEnd?.({ active: drag(ev("a", 10)), over: zone("r2"), delta: { x: 2, y: 1 } }));
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    act(() => lastDnd().onDragEnd?.({ active: drag(ev("a", 10)), over: null, delta: { x: 0, y: 200 } }));
    expect(onEventUpdate).not.toHaveBeenCalled();
  });

  it("an external item dropped on a zone becomes an event on that resource", async () => {
    const onEventReceive = jest.fn();
    renderRows({ onEventReceive });
    await screen.findByText("zone-r1");
    const external = { id: "p-1", template: { title: "Follow-up" }, duration: 30, data: { patient: 7 } };
    act(() =>
      lastDnd().onDragEnd?.({ active: { id: "agendfy-external:p-1", data: { current: { external } } }, over: zone("r2", new Date(at(9))), delta: { x: 300, y: 0 } })
    );
    expect(onEventReceive).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Follow-up", start: at(9), end: "2026-03-11T09:30:00.000Z", resourceId: "r2" }),
      { patient: 7 }
    );
  });

  it("events with legacy `resources` objects get them updated too, and undo restores them", async () => {
    const onEventUpdate = jest.fn();
    const apiRef = React.createRef<CalendarApi>();
    const legacy = ev("l", 10, { resources: [{ id: "r1", title: "Room 1" }] });
    renderRows({
      onEventUpdate,
      apiRef,
      events: [legacy],
      resources: [{ id: "r1", title: "Room 1" }, { id: "r2", title: "Room 2" }],
    });
    await screen.findByText("zone-r1");
    act(() => lastDnd().onDragEnd?.({ active: drag(legacy), over: zone("r2", new Date(at(16))), delta: { x: 0, y: 80 } }));
    expect(onEventUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ resourceId: "r2", resources: [{ id: "r2", title: "Room 2" }] })
    );
    act(() => apiRef.current!.undo());
    expect(onEventUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: at(10), resources: [{ id: "r1", title: "Room 1" }] })
    );
    expect(onEventUpdate.mock.calls[1][0].resourceId).toBeUndefined();
  });

  it("not editable: drops do nothing", async () => {
    const onEventUpdate = jest.fn();
    renderRows({ onEventUpdate, config: { editable: false } });
    await screen.findByText("zone-r1");
    act(() => lastDnd().onDragEnd?.({ active: drag(ev("a", 10)), over: zone("r2", new Date(at(16))), delta: { x: 0, y: 80 } }));
    expect(onEventUpdate).not.toHaveBeenCalled();
  });
});
