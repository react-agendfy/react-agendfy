/*
 * FullCalendar-parity display options through the real <Calendar>:
 * eventTimeFormat, slotLabelInterval, weekNumbers, dayMaxEvents (+N popover),
 * fixedWeekCount, listRange, allDaySlot, nowIndicator, and revert on a
 * rejected onEventUpdate. Defaults must render exactly as before.
 */
import React from "react";
import { render, screen, fireEvent, within, configure, act } from "@testing-library/react";
import { Calendar } from "../index";
import type { EventProps } from "../types/types";
import { resolveDayMaxEvents, weekNumberOf } from "../Utils/displayOptions";

configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  (global as any).ResizeObserver ??= class {
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
const base = { timeZone: "UTC", lang: "pt", alerts: { enabled: false, thresholdMinutes: 15 } };
const ev = (id: string, day: number, h: number): EventProps => ({
  id,
  title: `Ev ${id}`,
  start: `2026-03-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`,
  end: `2026-03-${String(day).padStart(2, "0")}T${String(h + 1).padStart(2, "0")}:00:00Z`,
});

describe("display helpers", () => {
  it("resolves dayMaxEvents like FullCalendar", () => {
    expect(resolveDayMaxEvents({})).toBe(3);
    expect(resolveDayMaxEvents({ dayMaxEvents: true })).toBe(3);
    expect(resolveDayMaxEvents({ dayMaxEvents: false })).toBe(Infinity);
    expect(resolveDayMaxEvents({ dayMaxEvents: 5 })).toBe(5);
  });

  it("computes ISO and locale week numbers", () => {
    // 2027-01-01 is a Friday: ISO week 53 (of 2026); en-US local week 1.
    const d = new Date(2027, 0, 1);
    expect(weekNumberOf(d, { weekNumberCalculation: "ISO" })).toBe(53);
    expect(weekNumberOf(d, { lang: "en" })).toBe(1);
  });
});

describe("Calendar FullCalendar options", () => {
  it("formats event times with eventTimeFormat", async () => {
    render(
      <Calendar
        events={[ev("1", 11, 14)]}
        currentDate={MARCH_11}
        config={{ ...base, lang: "en", defaultView: "list", eventTimeFormat: "h:mm a" }}
      />
    );
    expect(await screen.findByText(/2:00 PM - 3:00 PM/)).toBeInTheDocument();
  });

  it("keeps HH:mm by default", async () => {
    render(<Calendar events={[ev("1", 11, 14)]} currentDate={MARCH_11} config={{ ...base, defaultView: "list" }} />);
    expect(await screen.findByText(/14:00 - 15:00/)).toBeInTheDocument();
  });

  it("labels the time grid every slotLabelInterval minutes", async () => {
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        config={{ ...base, defaultView: "week", slotDuration: 30, slotMin: "08:00", slotMax: "12:00", slotLabelInterval: 60 }}
      />
    );
    await screen.findAllByRole("columnheader");
    const labels = [...container.querySelectorAll(".react-agendfy-weekview-timeslot")].map((e) => e.textContent);
    expect(labels).toEqual(["08:00", "", "09:00", "", "10:00", "", "11:00", ""]);
  });

  it("shows week numbers in month rows and the week view", async () => {
    const month = render(
      <Calendar events={[]} currentDate={MARCH_11} config={{ ...base, defaultView: "month", weekNumbers: true }} />
    );
    await screen.findAllByRole("gridcell");
    const rows = month.container.querySelectorAll(".react-agendfy-monthview-week-row");
    const numbers = month.container.querySelectorAll(".react-agendfy-calendar-day .react-agendfy-week-number");
    expect(numbers).toHaveLength(rows.length);
    // pt: week starting Mon 9 Mar 2026 → "S11".
    expect([...numbers].map((n) => n.textContent)).toContain("S11");
    month.unmount();

    const week = render(
      <Calendar events={[]} currentDate={MARCH_11} config={{ ...base, defaultView: "week", weekNumbers: true }} />
    );
    await screen.findAllByRole("columnheader");
    expect(week.container.querySelector(".react-agendfy-weekview-timeslot-label-top")).toHaveTextContent("S11");
  });

  it("limits month cells with dayMaxEvents and lists the rest in a popover", async () => {
    const onEventClick = jest.fn();
    const events = [ev("a", 11, 8), ev("b", 11, 9), ev("c", 11, 10), ev("d", 11, 11)];
    const { container } = render(
      <Calendar
        events={events}
        currentDate={MARCH_11}
        onEventClick={onEventClick}
        config={{ ...base, defaultView: "month", dayMaxEvents: 2 }}
      />
    );
    const more = await screen.findByText("+2 mais");
    const cell = more.closest(".react-agendfy-calendar-day") as HTMLElement;
    expect(cell.querySelectorAll(".react-agendfy-event-item")).toHaveLength(2);

    fireEvent.click(more);
    const popover = await screen.findByRole("dialog");
    const items = within(popover).getAllByRole("button").filter((b) => b.classList.contains("react-agendfy-more-popover-item"));
    expect(items.map((b) => b.textContent)).toEqual(["08:00Ev a", "09:00Ev b", "10:00Ev c", "11:00Ev d"]);

    fireEvent.click(items[3]);
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: "d" }));
    expect(container.querySelector(".react-agendfy-more-popover")).toBeNull();
  });

  it("renders 6 rows with fixedWeekCount", async () => {
    // February 2027 starts on a Monday and fits in exactly 4 weeks.
    const feb = new Date("2027-02-11T12:00:00Z");
    const plain = render(<Calendar events={[]} currentDate={feb} config={{ ...base, defaultView: "month" }} />);
    await screen.findAllByRole("gridcell");
    expect(plain.container.querySelectorAll(".react-agendfy-monthview-week-row")).toHaveLength(4);
    plain.unmount();

    const fixed = render(
      <Calendar events={[]} currentDate={feb} config={{ ...base, defaultView: "month", fixedWeekCount: true }} />
    );
    await screen.findAllByRole("gridcell");
    expect(fixed.container.querySelectorAll(".react-agendfy-monthview-week-row")).toHaveLength(6);
  });

  it("spans a week with listRange and navigates by week", async () => {
    const events = [ev("in", 12, 9), ev("next-week", 17, 9)];
    const { container } = render(
      <Calendar events={events} currentDate={MARCH_11} config={{ ...base, defaultView: "list", listRange: "week" }} />
    );
    expect(await screen.findByText("Ev in")).toBeInTheDocument();
    expect(screen.queryByText("Ev next-week")).toBeNull();
    expect(container.querySelector(".react-agendfy-toolbar-title")).toHaveTextContent(/9 - 15 mar 2026/i);

    fireEvent.click(container.querySelector(".react-agendfy-next-button")!);
    expect(await screen.findByText("Ev next-week")).toBeInTheDocument();
    expect(container.querySelector(".react-agendfy-toolbar-title")).toHaveTextContent(/16 - 22 mar 2026/i);
  });

  it("hides the all-day row and the now line when asked", async () => {
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={new Date()}
        config={{ ...base, defaultView: "week", allDaySlot: false, nowIndicator: false }}
      />
    );
    await screen.findAllByRole("columnheader");
    expect(container.querySelector(".react-agendfy-weekview-all-day")).toBeNull();
    expect(container.querySelector(".react-agendfy-now-line")).toBeNull();
  });

  it("reverts a move when onEventUpdate rejects (FullCalendar info.revert)", async () => {
    // A custom view stands in for a drag: it calls onEventUpdate directly.
    const MoveView = ({ events, onEventUpdate }: any) => (
      <div>
        <span data-testid="start">{String(events[0]?.start)}</span>
        <button onClick={() => onEventUpdate({ ...events[0], start: "2026-03-11T16:00:00.000Z" })}>simulate-drop</button>
      </div>
    );
    let reject!: (e: unknown) => void;
    const onEventUpdate = jest.fn(() => new Promise((_, r) => (reject = r)));
    render(
      <Calendar
        events={[ev("1", 11, 9)]}
        currentDate={MARCH_11}
        onEventUpdate={onEventUpdate}
        plugins={[{ key: "mv", type: "view", viewName: "move", component: MoveView }]}
        config={{ ...base, defaultView: "move" as any }}
      />
    );
    fireEvent.click(await screen.findByText("simulate-drop"));
    expect(screen.getByTestId("start")).toHaveTextContent("2026-03-11T16:00:00.000Z");

    await act(async () => reject(new Error("409")));
    expect(screen.getByTestId("start")).toHaveTextContent("2026-03-11T09:00:00Z");
  });
});
