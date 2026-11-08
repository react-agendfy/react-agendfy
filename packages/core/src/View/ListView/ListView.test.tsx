import React from 'react';
import { render, screen, fireEvent } from "@testing-library/react";
import ListView from "./ListView";
import { Config, EventProps } from "../../types/types";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // do nothing
    }
    unobserve() {
      // do nothing
    }
    disconnect() {
      // do nothing
    }
  };
});

describe("ListView Component", () => {
  const mockEvents: EventProps[] = [
    {
      id: "1",
      title: "Event 1",
      start: "2023-01-15T09:00:00",
      end: "2023-01-15T10:00:00",
      color: "#ff0000",
      isAllDay: true,
      isMultiDay: true,
      resources: [{ name: "Resource 1" }],
    },
    {
      id: "2",
      title: "Event 2",
      start: "2023-01-16T14:00:00",
      end: "2023-01-16T16:00:00",
      isAllDay: true,
      isMultiDay: true,
      color: "#00ff00",
    },
  ];

  const defaultConfig: Config = {
    timeZone: 'UTC',
    defaultView: 'week',
    slotDuration: 60,
    slotLabelFormat: 'HH:mm',
    slotMin: '00:00',
    slotMax: '23:59',
    lang: 'en',
    today: 'Today',
    monthView: 'Month',
    weekView: 'Week',
    dayView: 'Day',
    listView: 'List',
    all_day: 'All day',
    clear_filter: 'Clear Filters',
    filter_resources: 'Filter',
    businessHours: {
      enabled: true,
      intervals: [
        { daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00" }
      ]
    },
    
    alerts: {
      enabled: false,          
      thresholdMinutes: 15,  
    }, 
   };

  test("should render events grouped by day", () => {
    render(<ListView events={mockEvents} currentDate={new Date("2023-01-01")} />);

    // Day headings use the language's natural form (Intl): en → "Sunday, January 15".
    expect(screen.getByText("Sunday, January 15")).toBeInTheDocument();
    expect(screen.getByText("Monday, January 16")).toBeInTheDocument();
    expect(screen.getByText("Event 1")).toBeInTheDocument();
    expect(screen.getByText("Event 2")).toBeInTheDocument();
  });

  test("should display a message when there are no events", () => {
    render(<ListView events={[]} currentDate={new Date("2023-01-01")} />);

    expect(
      screen.getByText("There are no events for this period.")
    ).toBeInTheDocument();
  });

  test("should call onEventClick when an event is clicked", () => {
    const onEventClickMock = jest.fn();
    render(
      <ListView events={mockEvents} onEventClick={onEventClickMock} currentDate={new Date("2023-01-01")} />
    );

    const eventItem = screen.getByText("Event 1");
    fireEvent.click(eventItem);

    expect(onEventClickMock).toHaveBeenCalledWith(mockEvents[0]);
  });

  test("orders each day's events by start time, all-day first", () => {
    const unordered: EventProps[] = [
      { id: "a", title: "Late", start: "2023-01-15T10:30:00", end: "2023-01-15T11:00:00" },
      { id: "b", title: "Early", start: "2023-01-15T09:00:00", end: "2023-01-15T09:30:00" },
      { id: "c", title: "Holiday", start: "2023-01-15T00:00:00", end: "2023-01-16T00:00:00", allDay: true },
    ];
    render(<ListView events={unordered} currentDate={new Date("2023-01-01")} />);
    const titles = screen.getAllByText(/^(Late|Early|Holiday)$/).map((el) => el.textContent);
    expect(titles).toEqual(["Holiday", "Early", "Late"]);
  });

  test("a multi-day event that started before the period shows on its first day", () => {
    const running: EventProps[] = [
      { id: "trip", title: "Trip", start: "2022-12-30T00:00:00Z", end: "2023-01-03T00:00:00Z", allDay: true },
    ];
    render(<ListView events={running} currentDate={new Date("2023-01-10T12:00:00Z")} config={{ ...defaultConfig, listRange: "month" }} />);
    expect(screen.getByText("Sunday, January 1")).toBeInTheDocument();
    expect(screen.getByText("Trip")).toBeInTheDocument();
  });

  test("listRange: only the day or week of the navigated date", () => {
    const { rerender } = render(<ListView events={mockEvents} currentDate={new Date("2023-01-15T12:00:00Z")} config={{ ...defaultConfig, listRange: "day" }} />);
    expect(screen.getByText("Event 1")).toBeInTheDocument();
    expect(screen.queryByText("Event 2")).toBeNull();
    rerender(<ListView events={mockEvents} currentDate={new Date("2023-01-15T12:00:00Z")} config={{ ...defaultConfig, listRange: "week", weekStartsOn: 1 }} />);
    // Week Mon 9 – Sun 15: Monday the 16th is out.
    expect(screen.queryByText("Event 2")).toBeNull();
  });

  test("agenda variant: the next 7 days from the date, with its own empty message", () => {
    const week: EventProps[] = [
      { id: "d0", title: "Day 0", start: "2023-01-15T09:00:00Z", end: "2023-01-15T10:00:00Z" },
      { id: "d6", title: "Day 6", start: "2023-01-21T09:00:00Z", end: "2023-01-21T10:00:00Z" },
      { id: "d7", title: "Day 7", start: "2023-01-22T09:00:00Z", end: "2023-01-22T10:00:00Z" },
    ];
    const { container, rerender } = render(
      <ListView variant="agenda" events={week} currentDate={new Date("2023-01-15T12:00:00Z")} config={defaultConfig} />
    );
    expect(container.querySelector(".react-agendfy-agendaview-container")).not.toBeNull();
    expect(screen.getByText("Day 0")).toBeInTheDocument();
    expect(screen.getByText("Day 6")).toBeInTheDocument();
    expect(screen.queryByText("Day 7")).toBeNull();
    rerender(<ListView variant="agenda" events={[]} currentDate={new Date("2023-01-15T12:00:00Z")} config={defaultConfig} />);
    expect(screen.getByText("There are no events for the next 7 days.")).toBeInTheDocument();
  });
});
