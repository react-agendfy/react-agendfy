/*
 * Change pipeline (RFC 001, layer 1) through the real <Calendar>: rules,
 * middleware plugins, undo/redo and custom view ranges. A custom view
 * stands in for a drag: it calls onEventUpdate/onEventResize directly.
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Calendar } from "../index";
import type { CalendarApi, ChangeRejectedInfo, DateRangeSelection, EventChange, EventProps } from "../types/types";
import type { CalendarPlugin } from "../types/plugins";
import { useDropVerdict } from "../hooks/useDropVerdict";

/** Props the calendar passes to a custom view (the subset these tests use). */
interface ViewProps {
  events: EventProps[];
  onEventUpdate: (event: EventProps) => void;
  onEventResize: (event: EventProps) => void;
  range: { start: Date; end: Date };
}

beforeAll(() => {
  (global as unknown as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

const MARCH_11 = new Date("2026-03-11T12:00:00Z"); // Wednesday
const base = { timeZone: "UTC", lang: "en" };
const ev = (id: string, startH: number, endH: number, extra: Partial<EventProps> = {}): EventProps => ({
  id,
  title: id,
  start: `2026-03-11T${String(startH).padStart(2, "0")}:00:00.000Z`,
  end: `2026-03-11T${String(endH).padStart(2, "0")}:00:00.000Z`,
  ...extra,
});
const iso = (h: number) => `2026-03-11T${String(h).padStart(2, "0")}:00:00.000Z`;

/** Shows each event's start and offers buttons that "drop" event `a`. */
const MoveView = ({ events, onEventUpdate, onEventResize }: ViewProps) => {
  const a = events.find((e: EventProps) => e.id === "a");
  return (
    <div>
      {events.map((e: EventProps) => (
        <span key={e.id} data-testid={`start-${e.id}`}>
          {new Date(e.start).toISOString()}
        </span>
      ))}
      <button onClick={() => onEventUpdate({ ...a, start: iso(14), end: iso(15) })}>move-to-14</button>
      <button onClick={() => onEventUpdate({ ...a, start: iso(7), end: iso(8) })}>move-to-7</button>
      <button onClick={() => onEventResize({ ...a, end: iso(13) })}>resize-to-13</button>
    </div>
  );
};
const moveView: CalendarPlugin = { key: "mv", type: "view", viewName: "move", component: MoveView };

const renderMove = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) => {
  const apiRef = React.createRef<CalendarApi>();
  const utils = render(
    <Calendar
      events={[ev("a", 10, 11), ev("b", 14, 15)]}
      currentDate={MARCH_11}
      apiRef={apiRef}
      {...props}
      plugins={[moveView, ...((props.plugins as CalendarPlugin[]) ?? [])]}
      config={{ ...base, defaultView: "move" as never, ...props.config }}
    />
  );
  return { ...utils, apiRef };
};

const startOf = (id: string) => screen.getByTestId(`start-${id}`).textContent;

describe("rules", () => {
  it("eventOverlap: false refuses the move and reports the conflict", async () => {
    const onEventUpdate = jest.fn();
    const onChangeRejected = jest.fn();
    renderMove({ onEventUpdate, onChangeRejected, config: { eventOverlap: false } });
    fireEvent.click(await screen.findByText("move-to-14"));

    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(startOf("a")).toBe(iso(10));
    expect(onChangeRejected).toHaveBeenCalledTimes(1);
    const info: ChangeRejectedInfo = onChangeRejected.mock.calls[0][0];
    expect(info.reason).toBe("overlap");
    expect(info.change).toMatchObject({ kind: "move", source: "user" });
    expect(info.change.before!.start).toBe(iso(10));
    expect(info.conflicts!.map((e: EventProps) => e.id)).toEqual(["b"]);
  });

  it("overlaps stay allowed by default", async () => {
    const onEventUpdate = jest.fn();
    renderMove({ onEventUpdate });
    fireEvent.click(await screen.findByText("move-to-14"));
    expect(onEventUpdate).toHaveBeenCalledTimes(1);
    expect(startOf("a")).toBe(iso(14));
  });

  it("eventConstraint: businessHours refuses a move outside 09–17", async () => {
    const onEventUpdate = jest.fn();
    const onChangeRejected = jest.fn();
    renderMove({ onEventUpdate, onChangeRejected, config: { eventConstraint: "businessHours" } });
    fireEvent.click(await screen.findByText("move-to-7"));
    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(onChangeRejected.mock.calls[0][0].reason).toBe("constraint");
  });

  it("checks conflicts against recurring occurrences too", async () => {
    const onChangeRejected = jest.fn();
    renderMove({
      events: [ev("a", 10, 11), ev("r", 14, 15, { recurrence: "FREQ=DAILY" })],
      onChangeRejected,
      config: { eventOverlap: false },
    });
    fireEvent.click(await screen.findByText("move-to-14"));
    expect(onChangeRejected).toHaveBeenCalledTimes(1);
    expect(onChangeRejected.mock.calls[0][0].conflicts[0].originalEventId).toBe("r");
  });

  it("selectAllow sees the selection and can refuse it", async () => {
    const onDateRangeSelect = jest.fn();
    const selectAllow = jest.fn((sel: DateRangeSelection) => sel.isMultiDay === false);
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        onDateRangeSelect={onDateRangeSelect}
        config={{ ...base, defaultView: "month", selectAllow }}
      />
    );
    await screen.findAllByRole("gridcell");
    const cell = (d: string) => container.querySelector(`[data-date="${d}"]`)!;

    fireEvent.mouseDown(cell("2026-03-10"));
    fireEvent.mouseMove(cell("2026-03-12"));
    fireEvent.mouseUp(cell("2026-03-12"));
    expect(selectAllow).toHaveBeenCalledWith(expect.objectContaining({ isMultiDay: true }));
    expect(onDateRangeSelect).not.toHaveBeenCalled();

    fireEvent.mouseDown(cell("2026-03-10"));
    fireEvent.mouseUp(cell("2026-03-10"));
    expect(onDateRangeSelect).toHaveBeenCalledTimes(1);
  });
});

describe("middleware plugins", () => {
  it("validate refuses, onCommit and onRevert observe", async () => {
    let rejectHost!: (e: unknown) => void;
    const onEventUpdate = jest.fn(() => new Promise((_, r) => (rejectHost = r)));
    const onChangeRejected = jest.fn();
    const mw = {
      key: "rules",
      type: "middleware" as const,
      validate: jest.fn((c: EventChange) => (c.event.start === iso(7) ? { ok: false as const, reason: "closed" } : true)),
      onCommit: jest.fn(),
      onRevert: jest.fn(),
    };
    renderMove({ onEventUpdate, onChangeRejected, plugins: [mw] });

    fireEvent.click(await screen.findByText("move-to-7"));
    expect(onChangeRejected.mock.calls[0][0].reason).toBe("closed");
    expect(mw.onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("move-to-14"));
    expect(mw.onCommit).toHaveBeenCalledTimes(1);
    await act(async () => rejectHost(new Error("409")));
    expect(mw.onRevert).toHaveBeenCalledTimes(1);
    expect(startOf("a")).toBe(iso(10));
  });
});

describe("undo / redo", () => {
  it("undo reverts through the same callback, redo re-applies", async () => {
    const onEventUpdate = jest.fn();
    const onEventResize = jest.fn();
    const { apiRef } = renderMove({ onEventUpdate, onEventResize });

    fireEvent.click(await screen.findByText("move-to-14"));
    fireEvent.click(screen.getByText("resize-to-13"));
    expect(apiRef.current!.canUndo()).toBe(true);
    expect(apiRef.current!.canRedo()).toBe(false);

    act(() => apiRef.current!.undo()); // undo the resize
    expect(onEventResize).toHaveBeenCalledTimes(2);
    expect(onEventResize.mock.calls[1][0]).toMatchObject({ start: iso(14), end: iso(15) });

    act(() => apiRef.current!.undo()); // undo the move
    expect(onEventUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ start: iso(10), end: iso(11) }));
    expect(startOf("a")).toBe(iso(10));
    expect(apiRef.current!.canUndo()).toBe(false);
    expect(apiRef.current!.canRedo()).toBe(true);

    act(() => apiRef.current!.redo());
    expect(startOf("a")).toBe(iso(14));
    expect(onEventUpdate).toHaveBeenCalledTimes(3);
  });

  it("history changes skip validation (they restore an accepted state)", async () => {
    const onChangeRejected = jest.fn();
    const { apiRef } = renderMove({ onChangeRejected, config: { eventConstraint: { start: "2026-03-11T12:00:00Z" } } });
    // a starts at 10:00, before the constraint: moving it to 14:00 is fine, undoing back to 10:00 too.
    fireEvent.click(await screen.findByText("move-to-14"));
    act(() => apiRef.current!.undo());
    expect(onChangeRejected).not.toHaveBeenCalled();
    expect(startOf("a")).toBe(iso(10));
  });

  it("a change the host rejects leaves the history", async () => {
    let rejectHost!: (e: unknown) => void;
    const onEventUpdate = jest.fn(() => new Promise((_, r) => (rejectHost = r)));
    const { apiRef } = renderMove({ onEventUpdate });
    fireEvent.click(await screen.findByText("move-to-14"));
    expect(apiRef.current!.canUndo()).toBe(true);
    await act(async () => rejectHost(new Error("409")));
    expect(apiRef.current!.canUndo()).toBe(false);
  });

  it("a failed undo goes back on the undo stack", async () => {
    const pending: ((e: unknown) => void)[] = [];
    const onEventUpdate = jest
      .fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => new Promise((_, r) => pending.push(r)));
    const { apiRef } = renderMove({ onEventUpdate });
    fireEvent.click(await screen.findByText("move-to-14"));
    act(() => apiRef.current!.undo());
    expect(startOf("a")).toBe(iso(10));
    await act(async () => pending[0](new Error("offline")));
    expect(startOf("a")).toBe(iso(14));
    expect(apiRef.current!.canUndo()).toBe(true);
    expect(apiRef.current!.canRedo()).toBe(false);
  });

  it("dropping in place calls back but records nothing", async () => {
    const onEventUpdate = jest.fn();
    const SameView = ({ events, onEventUpdate: up }: ViewProps) => (
      <button onClick={() => up({ ...events[0], start: "2026-03-11T10:00:00+00:00" })}>drop-in-place</button>
    );
    const apiRef = React.createRef<CalendarApi>();
    render(
      <Calendar
        events={[ev("a", 10, 11)]}
        currentDate={MARCH_11}
        apiRef={apiRef}
        onEventUpdate={onEventUpdate}
        plugins={[{ key: "same", type: "view", viewName: "same", component: SameView }]}
        config={{ ...base, defaultView: "same" as never, eventOverlap: false }}
      />
    );
    fireEvent.click(await screen.findByText("drop-in-place"));
    expect(onEventUpdate).toHaveBeenCalledTimes(1);
    expect(apiRef.current!.canUndo()).toBe(false);
  });

  it("Ctrl/⌘+Z and Ctrl/⌘+Shift+Z inside the calendar; ignored while typing or when disabled", async () => {
    const { container, apiRef } = renderMove();
    fireEvent.click(await screen.findByText("move-to-14"));
    const root = container.querySelector(".agendfy")!;

    const input = document.createElement("input");
    root.appendChild(input);
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(startOf("a")).toBe(iso(14));

    fireEvent.keyDown(screen.getByText("move-to-14"), { key: "z", metaKey: true });
    expect(startOf("a")).toBe(iso(10));
    fireEvent.keyDown(screen.getByText("move-to-14"), { key: "Z", metaKey: true, shiftKey: true });
    expect(startOf("a")).toBe(iso(14));
    expect(apiRef.current!.canRedo()).toBe(false);
  });

  it("undoShortcuts: false leaves the keys alone; historyLimit: 0 disables history", async () => {
    const { apiRef } = renderMove({ config: { undoShortcuts: false, historyLimit: 0 } });
    fireEvent.click(await screen.findByText("move-to-14"));
    fireEvent.keyDown(screen.getByText("move-to-14"), { key: "z", ctrlKey: true });
    expect(startOf("a")).toBe(iso(14));
    expect(apiRef.current!.canUndo()).toBe(false);
  });
});

describe("ViewPlugin.range / step", () => {
  // A two-week view starting on the Monday of the current week.
  const twoWeeks: CalendarPlugin = {
    key: "tw",
    type: "view",
    viewName: "twoWeeks",
    range: (date) => {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      return { start, end: new Date(start.getTime() + 14 * 864e5) };
    },
    step: { unit: "week", amount: 2 },
    component: ({ range, events }: ViewProps) => (
      <div>
        <span data-testid="range">{`${range.start.toISOString()}|${range.end.toISOString()}`}</span>
        <span data-testid="count">{events.length}</span>
      </div>
    ),
  } as CalendarPlugin;

  it("drives the range prop, onDatesSet, getView and prev/next", async () => {
    const onDatesSet = jest.fn();
    const apiRef = React.createRef<CalendarApi>();
    render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        apiRef={apiRef}
        onDatesSet={onDatesSet}
        plugins={[twoWeeks]}
        config={{ ...base, defaultView: "twoWeeks" as never }}
      />
    );
    expect((await screen.findByTestId("range")).textContent).toBe(
      "2026-03-09T00:00:00.000Z|2026-03-23T00:00:00.000Z"
    );
    expect(onDatesSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: new Date("2026-03-09T00:00:00Z"), end: new Date("2026-03-23T00:00:00Z") })
    );
    expect(apiRef.current!.getView().activeEnd).toEqual(new Date("2026-03-23T00:00:00Z"));

    act(() => apiRef.current!.next());
    expect(screen.getByTestId("range").textContent).toBe("2026-03-23T00:00:00.000Z|2026-04-06T00:00:00.000Z");
  });

  it("expands recurrences over the whole custom range", async () => {
    const longView: CalendarPlugin = {
      key: "q",
      type: "view",
      viewName: "quarter",
      range: () => ({ start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-06-01T00:00:00Z") }),
      component: ({ events }: ViewProps) => <span data-testid="count">{events.length}</span>,
    } as CalendarPlugin;
    render(
      <Calendar
        events={[ev("w", 9, 10, { recurrence: "FREQ=WEEKLY" })]}
        currentDate={MARCH_11}
        plugins={[longView]}
        config={{ ...base, defaultView: "quarter" as never }}
      />
    );
    // Wednesdays from Mar 11 to May 27: 12 occurrences (the month window alone would stop in early April).
    expect((await screen.findByTestId("count")).textContent).toBe("12");
  });

  it("feeds the custom range to data sources", async () => {
    const fetchEvents = jest.fn(async () => []);
    render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        plugins={[twoWeeks, { key: "ds", type: "data-source", fetchEvents } as CalendarPlugin]}
        config={{ ...base, defaultView: "twoWeeks" as never }}
      />
    );
    await screen.findByTestId("range");
    expect(fetchEvents).toHaveBeenLastCalledWith(
      new Date("2026-03-09T00:00:00Z"),
      new Date("2026-03-23T00:00:00Z"),
      expect.anything()
    );
  });
});

describe("live drop validation (useDropVerdict)", () => {
  /** A view that "hovers" event a over 14:00/12:00 and shows the live verdict. */
  const HoverView = ({ events }: ViewProps) => {
    const a = events.find((e) => e.id === "a")!;
    const { verdict, check, clear } = useDropVerdict();
    return (
      <div>
        <span data-testid="verdict">{verdict ? verdict.reason : "ok"}</span>
        <button onClick={() => check({ ...a, start: iso(14), end: iso(15) }, a)}>hover-14</button>
        <button onClick={() => check({ ...a, start: iso(12), end: iso(13) }, a)}>hover-12</button>
        <button onClick={() => check(null)}>hover-nowhere</button>
        <button onClick={clear}>end</button>
      </div>
    );
  };

  it("reports the rule that would refuse the drop, without applying or calling back", async () => {
    const onEventUpdate = jest.fn();
    const onChangeRejected = jest.fn();
    render(
      <Calendar
        events={[ev("a", 10, 11), ev("b", 14, 15)]}
        currentDate={MARCH_11}
        onEventUpdate={onEventUpdate}
        onChangeRejected={onChangeRejected}
        plugins={[{ key: "h", type: "view", viewName: "hover", component: HoverView } as CalendarPlugin]}
        config={{ ...base, defaultView: "hover" as never, eventOverlap: false }}
      />
    );
    const verdict = () => screen.getByTestId("verdict").textContent;
    fireEvent.click(await screen.findByText("hover-14"));
    expect(verdict()).toBe("overlap");
    fireEvent.click(screen.getByText("hover-12"));
    expect(verdict()).toBe("ok");
    fireEvent.click(screen.getByText("hover-14"));
    fireEvent.click(screen.getByText("hover-nowhere"));
    expect(verdict()).toBe("ok");
    fireEvent.click(screen.getByText("hover-14"));
    fireEvent.click(screen.getByText("end"));
    expect(verdict()).toBe("ok");
    expect(onEventUpdate).not.toHaveBeenCalled();
    expect(onChangeRejected).not.toHaveBeenCalled();
  });

  it("a standalone view (no calendar) never rejects", () => {
    const Probe = () => {
      const { verdict, check } = useDropVerdict();
      return <button onClick={() => check(ev("a", 1, 2))}>{verdict ? "rejected" : "ok"}</button>;
    };
    render(<Probe />);
    fireEvent.click(screen.getByText("ok"));
    expect(screen.getByRole("button").textContent).toBe("ok");
  });
});

