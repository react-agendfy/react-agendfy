/*
 * Styling/customization hooks through the real <Calendar>: config.slotHeight
 * (single source of truth for the time-grid geometry), eventClassNames,
 * dayCellClassNames, root className and the data-* attributes.
 */
import React from "react";
import { render, screen, configure } from "@testing-library/react";
import { Calendar } from "../index";
import type { EventProps } from "../types/types";
import { DEFAULT_SLOT_HEIGHT, getSlotHeight, slotHeightStyle } from "../Utils/slotHeight";
import { nowLineOffset } from "../Utils/calculateRedLineOffset";
import { computePositionedEvents } from "../Utils/positionedEventsHelper";
import { publicEventId, toClassName } from "../context/ClassNamesContext";

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
const base = { timeZone: "UTC", lang: "en", alerts: { enabled: false, thresholdMinutes: 15 } };
const ev = (id: string, day: number, h: number, extra: Partial<EventProps> = {}): EventProps => ({
  id,
  title: `Ev ${id}`,
  start: `2026-03-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`,
  end: `2026-03-${String(day).padStart(2, "0")}T${String(h + 1).padStart(2, "0")}:00:00Z`,
  ...extra,
});

/** First px height found on the element or its ancestors (the event frame). */
const frameHeight = (el: Element | null): string | undefined => {
  for (let node = el as HTMLElement | null; node; node = node.parentElement) {
    if (node.style?.height?.endsWith("px")) return node.style.height;
  }
  return undefined;
};

describe("slotHeight helpers", () => {
  it("defaults to 40 and ignores invalid values", () => {
    expect(DEFAULT_SLOT_HEIGHT).toBe(40);
    expect(getSlotHeight(undefined)).toBe(40);
    expect(getSlotHeight({})).toBe(40);
    expect(getSlotHeight({ slotHeight: 0 })).toBe(40);
    expect(getSlotHeight({ slotHeight: -5 })).toBe(40);
    expect(getSlotHeight({ slotHeight: NaN })).toBe(40);
    expect(getSlotHeight({ slotHeight: 24 })).toBe(24);
    expect(slotHeightStyle({ slotHeight: 24 })).toEqual({ "--agendfy-slot-height": "24px" });
  });

  it("scales the now line and slot positions", () => {
    const now = new Date("2026-03-11T10:00:00Z");
    // 10:00 with slotMin 08:00, 30-min slots → 4 slots down.
    expect(nowLineOffset(now, 8, 18, 30, "UTC", now)).toBe(160);
    expect(nowLineOffset(now, 8, 18, 30, "UTC", now, 20)).toBe(80);

    const [positioned] = computePositionedEvents([ev("1", 11, 9)], { slotDuration: 30, slotHeight: 20 });
    expect(positioned.positionStyle.height).toBe("40px");
  });

  it("normalizes class name results and public ids", () => {
    expect(toClassName("a")).toBe("a");
    expect(toClassName(["a", "", false, null, " b "])).toBe("a b");
    expect(toClassName(undefined)).toBe("");
    expect(publicEventId({ id: "7::cont" } as EventProps)).toBe("7");
    expect(publicEventId({ id: "7::overlay" } as EventProps)).toBe("7");
  });
});

describe("slotHeight in the time grids", () => {
  const weekConfig = { ...base, defaultView: "week" as const, slotDuration: 30, slotMin: "08:00", slotMax: "12:00" };

  it("keeps the 40px default (CSS var + event height)", async () => {
    const { container } = render(
      <Calendar events={[ev("1", 11, 9)]} currentDate={MARCH_11} config={weekConfig} />
    );
    await screen.findAllByRole("columnheader");
    const grid = container.querySelector(".react-agendfy-weekview-container") as HTMLElement;
    expect(grid.style.getPropertyValue("--agendfy-slot-height")).toBe("40px");
    expect(frameHeight(container.querySelector('[data-event-id="1"]'))).toBe("80px");
  });

  it("drives the week view geometry from config.slotHeight", async () => {
    const { container } = render(
      <Calendar events={[ev("1", 11, 9)]} currentDate={MARCH_11} config={{ ...weekConfig, slotHeight: 20 }} />
    );
    await screen.findAllByRole("columnheader");
    const grid = container.querySelector(".react-agendfy-weekview-container") as HTMLElement;
    expect(grid.style.getPropertyValue("--agendfy-slot-height")).toBe("20px");
    // 1h event over 30-min slots of 20px.
    expect(frameHeight(container.querySelector('[data-event-id="1"]'))).toBe("40px");
    // 8 slots * 20px.
    const slots = container.querySelector(".react-agendfy-daycolumn-slot-container") as HTMLElement;
    expect(slots.style.minHeight).toBe("160px");
    // First hour line one hour (2 slots) down; lines are classes, not inline borders.
    const hourLine = container.querySelector(".react-agendfy-grid-line--hour") as HTMLElement;
    expect(hourLine.style.top).toBe("40px");
    expect(hourLine.style.borderTop).toBe("");
    expect(container.querySelector(".react-agendfy-grid-line--minor")).not.toBeNull();
  });

  it("drives the day view geometry from config.slotHeight", async () => {
    const { container } = render(
      <Calendar
        events={[ev("1", 11, 9)]}
        currentDate={MARCH_11}
        config={{ ...weekConfig, defaultView: "day", slotHeight: 24 }}
      />
    );
    const event = await screen.findByRole("button", { name: /Ev 1/ });
    expect(event.style.height).toBe("48px");
    const day = container.querySelector(".react-agendfy-dayview-container") as HTMLElement;
    expect(day.style.getPropertyValue("--agendfy-slot-height")).toBe("24px");
    expect(day.getAttribute("data-date")).toBe("2026-03-11");
  });
});

describe("eventClassNames", () => {
  const events = [ev("1", 11, 9, { category: "work" }), ev("2", 11, 10, { category: "personal" })];
  const eventClassNames = jest.fn(({ event, view }: { event: EventProps; view: string }) => [
    `cat-${event.category}`,
    `in-${view}`,
  ]);

  beforeEach(() => eventClassNames.mockClear());

  it.each(["week", "day", "month", "list", "agenda"] as const)("applies to events in the %s view", async (view) => {
    const { container } = render(
      <Calendar
        events={events}
        currentDate={MARCH_11}
        eventClassNames={eventClassNames}
        config={{ ...base, defaultView: view, slotMin: "08:00", slotMax: "12:00" }}
      />
    );
    await screen.findAllByText(/Ev 1/);
    const el = container.querySelector('[data-event-id="1"]');
    expect(el).not.toBeNull();
    expect(el).toHaveClass("cat-work", `in-${view}`);
    expect(container.querySelector('[data-event-id="2"]')).toHaveClass("cat-personal");
    expect(eventClassNames).toHaveBeenCalledWith(expect.objectContaining({ view }));
  });

  it("applies to week all-day chips", async () => {
    const allDay = { id: "a", title: "Holiday", start: "2026-03-11T00:00:00Z", end: "2026-03-12T00:00:00Z", allDay: true };
    const { container } = render(
      <Calendar
        events={[allDay]}
        currentDate={MARCH_11}
        eventClassNames={() => "is-holiday"}
        config={{ ...base, defaultView: "week" }}
      />
    );
    await screen.findByText("Holiday");
    expect(container.querySelector('.react-agendfy-weekview-all-day-event[data-event-id="a"]')).toHaveClass("is-holiday");
  });

  it("survives a throwing callback", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Calendar
        events={events}
        currentDate={MARCH_11}
        eventClassNames={() => {
          throw new Error("boom");
        }}
        config={{ ...base, defaultView: "list" }}
      />
    );
    expect(await screen.findByText("Ev 1")).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("dayCellClassNames", () => {
  it("applies to month cells with date flags and data attributes", async () => {
    const dayCellClassNames = jest.fn(({ date, isOtherMonth }: { date: Date; isOtherMonth?: boolean }) =>
      date.getUTCDate() === 11 && !isOtherMonth ? "payday" : ""
    );
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        dayCellClassNames={dayCellClassNames}
        config={{ ...base, defaultView: "month" }}
      />
    );
    await screen.findAllByRole("gridcell");
    const cell = container.querySelector('.react-agendfy-calendar-day[data-date="2026-03-11"]');
    expect(cell).toHaveClass("payday");
    expect(container.querySelectorAll(".payday")).toHaveLength(1);
    expect(dayCellClassNames).toHaveBeenCalledWith(
      expect.objectContaining({ view: "month", isToday: expect.any(Boolean), isDisabled: false })
    );
    expect(container.querySelector('[data-other-month="true"]')).not.toBeNull();
  });

  it("applies to week columns", async () => {
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        dayCellClassNames={({ date, view }) => `col-${view}-${date.getDay()}`}
        config={{ ...base, defaultView: "week" }}
      />
    );
    await screen.findAllByRole("columnheader");
    const column = container.querySelector('.react-agendfy-daycolumn-container[data-date="2026-03-11"]');
    expect(column).toHaveClass("col-week-3");
  });
});

describe("root className and data-view", () => {
  it("adds className to the .agendfy root and exposes the active view", async () => {
    const { container } = render(
      <Calendar events={[]} currentDate={MARCH_11} className="my-cal" config={{ ...base, defaultView: "month" }} />
    );
    await screen.findAllByRole("gridcell");
    const root = container.querySelector(".agendfy") as HTMLElement;
    expect(root).toHaveClass("my-cal", "react-agendfy-layout");
    expect(root.getAttribute("data-view")).toBe("month");
  });

  it("renders the default root classes unchanged", async () => {
    const { container } = render(<Calendar events={[]} currentDate={MARCH_11} config={{ ...base, defaultView: "month" }} />);
    await screen.findAllByRole("gridcell");
    expect((container.querySelector(".agendfy") as HTMLElement).className).toBe("agendfy react-agendfy-layout theme-default");
  });
});
