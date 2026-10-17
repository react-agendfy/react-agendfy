/*
 * Imperative API (apiRef — FullCalendar's getApi()), onDatesSet (datesSet)
 * and onViewChange.
 */
import React, { createRef } from "react";
import { render, screen, act, configure, fireEvent } from "@testing-library/react";
import { Calendar } from "../index";
import type { CalendarApi, DatesSetInfo } from "../index";

configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  (global as any).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
});

const base = { timeZone: "UTC", lang: "pt", alerts: { enabled: false, thresholdMinutes: 15 } };
const MARCH_11 = new Date("2026-03-11T12:00:00Z"); // Wednesday
const iso = (d: Date) => new Date(d.getTime()).toISOString().slice(0, 10);

describe("CalendarApi / onDatesSet / onViewChange", () => {
  it("reports the visible range on mount and on navigation (end exclusive)", async () => {
    const onDatesSet = jest.fn<void, [DatesSetInfo]>();
    const { container } = render(
      <Calendar events={[]} currentDate={MARCH_11} onDatesSet={onDatesSet} config={{ ...base, defaultView: "month" }} />
    );
    await screen.findAllByRole("gridcell");
    // pt grid starts Monday: 23 Feb .. 5 Apr (exclusive end 6 Apr).
    const first = onDatesSet.mock.calls[0][0];
    expect([iso(first.start), iso(first.end), first.view]).toEqual(["2026-02-23", "2026-04-06", "month"]);

    fireEvent.click(container.querySelector(".react-agendfy-next-button")!);
    const last = onDatesSet.mock.calls[onDatesSet.mock.calls.length - 1][0];
    expect([iso(last.start), iso(last.end)]).toEqual(["2026-03-30", "2026-05-04"]);
  });

  it("drives navigation and views through apiRef", async () => {
    const api = createRef<CalendarApi>();
    const onViewChange = jest.fn();
    const onDatesSet = jest.fn<void, [DatesSetInfo]>();
    render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        apiRef={api}
        onViewChange={onViewChange}
        onDatesSet={onDatesSet}
        config={{ ...base, defaultView: "week" }}
      />
    );
    await screen.findAllByRole("columnheader");
    expect(api.current!.getView()).toMatchObject({ type: "week" });
    expect(iso(api.current!.getView().activeStart)).toBe("2026-03-09");

    act(() => api.current!.next());
    expect(iso(api.current!.getDate())).toBe("2026-03-18");

    act(() => api.current!.changeView("day", "2026-04-02T10:00:00Z"));
    expect(onViewChange).toHaveBeenCalledWith("day");
    expect(api.current!.getView().type).toBe("day");
    expect(iso(api.current!.getDate())).toBe("2026-04-02");
    const last = onDatesSet.mock.calls[onDatesSet.mock.calls.length - 1][0];
    expect([iso(last.start), iso(last.end), last.view]).toEqual(["2026-04-02", "2026-04-03", "day"]);

    act(() => api.current!.gotoDate(new Date("2026-05-20T10:00:00Z")));
    expect(iso(api.current!.getDate())).toBe("2026-05-20");
  });

  it("refetches data-source plugins", async () => {
    const api = createRef<CalendarApi>();
    const fetchEvents = jest.fn(async () => []);
    render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        apiRef={api}
        plugins={[{ key: "ds", type: "data-source", fetchEvents }]}
        config={{ ...base, defaultView: "month" }}
      />
    );
    await screen.findAllByRole("gridcell");
    const before = fetchEvents.mock.calls.length;
    await act(async () => api.current!.refetchEvents());
    expect(fetchEvents.mock.calls.length).toBe(before + 1);
  });
});

describe("header options", () => {
  it("shows only headerViews, in order, and hides the header with showHeader=false", async () => {
    const { container, unmount } = render(
      <Calendar events={[]} currentDate={MARCH_11} config={{ ...base, defaultView: "week", headerViews: ["day", "week", "nope"] }} />
    );
    await screen.findAllByRole("columnheader");
    const buttons = [...container.querySelectorAll(".react-agendfy-toolbar-chunk:last-child .react-agendfy-button")].map(
      (b) => b.textContent
    );
    expect(buttons).toEqual(["Dia", "Semana"]);
    unmount();

    const hidden = render(<Calendar events={[]} currentDate={MARCH_11} config={{ ...base, defaultView: "week", showHeader: false }} />);
    await screen.findAllByRole("columnheader");
    expect(hidden.container.querySelector(".react-agendfy-header-toolbar")).toBeNull();
  });
});

describe("editable / selectable", () => {
  it("turns dragging and range selection off", async () => {
    const Probe = ({ onEventUpdate, onEventResize }: any) => (
      <span data-testid="probe">{`${typeof onEventUpdate}/${typeof onEventResize}`}</span>
    );
    const view = (extra: object) => (
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        plugins={[{ key: "p", type: "view", viewName: "probe", component: Probe }]}
        config={{ ...base, defaultView: "probe" as any, ...extra }}
      />
    );
    const a = render(view({}));
    expect(await screen.findByTestId("probe")).toHaveTextContent("function/function");
    a.unmount();
    const b = render(view({ editable: false }));
    expect(await screen.findByTestId("probe")).toHaveTextContent("undefined/undefined");
    b.unmount();
    render(view({ editable: false, eventDurationEditable: true }));
    expect(await screen.findByTestId("probe")).toHaveTextContent("undefined/function");
  });
});
