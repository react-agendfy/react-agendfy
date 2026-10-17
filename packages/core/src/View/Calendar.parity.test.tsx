/*
 * Integration tests for the FullCalendar-parity features, rendered through
 * the real <Calendar> (no view mocks): recurrence with exdate in every view,
 * hidden days, weekStartsOn, validRange and eventContent.
 */
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { Calendar } from "../index";
import { EventProps } from "../types/types";

beforeAll(() => {
  // react-window (list view) measures rows with ResizeObserver; jsdom lacks it.
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
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

const TZ = "UTC";
const MARCH_11 = new Date("2026-03-11T12:00:00Z"); // Wednesday
const baseConfig = { timeZone: TZ, lang: "pt", alerts: { enabled: false, thresholdMinutes: 15 } };

const series: EventProps = {
  id: "serie",
  title: "Fisio",
  start: "2026-03-02T10:00:00Z",
  end: "2026-03-02T11:00:00Z",
  rrule: { freq: "weekly", count: 6 },
  exdate: ["2026-03-16"],
};

describe("Calendar parity features", () => {
  it("renders recurring occurrences (minus exdates) in the list view", async () => {
    render(<Calendar events={[series]} currentDate={MARCH_11} config={{ ...baseConfig, defaultView: "list" }} />);
    const items = await screen.findAllByTestId("list-event-container");
    // March: 2, 9, (16 excluded), 23, 30
    expect(items).toHaveLength(4);
  });

  it("renders a recurring occurrence in the day view", async () => {
    const { container } = render(
      <Calendar
        events={[{ ...series, exdate: [] }]}
        config={{ ...baseConfig, defaultView: "day", slotMin: "08:00", slotMax: "12:00" }}
        currentDate={new Date("2026-03-09T00:00:00Z")}
      />
    );
    await screen.findAllByText(/Fisio/);
    expect(container.querySelectorAll(".react-agendfy-baseevent")).toHaveLength(1);
  });

  it("drops hidden weekdays from the month grid and honours weekStartsOn", async () => {
    const { container } = render(
      <Calendar events={[]} currentDate={MARCH_11} config={{ ...baseConfig, defaultView: "month", weekends: false }} />
    );
    await screen.findAllByRole("gridcell");
    const labels = container.querySelectorAll(".react-agendfy-monthview-day-label");
    expect(labels).toHaveLength(5);
    // pt → Monday first
    expect(labels[0].getAttribute("aria-label")).toMatch(/segunda/i);
    const firstRow = container.querySelector(".react-agendfy-monthview-week-row") as HTMLElement;
    expect(firstRow.style.gridTemplateColumns).toBe("repeat(5, 1fr)");
    expect(firstRow.querySelectorAll(".react-agendfy-calendar-day")).toHaveLength(5);
  });

  it("renders only visible week columns", async () => {
    const { container } = render(
      <Calendar events={[]} currentDate={MARCH_11} config={{ ...baseConfig, defaultView: "week", hiddenDays: [0, 3] }} />
    );
    await screen.findAllByRole("columnheader");
    expect(container.querySelectorAll(".react-agendfy-weekview-day-column")).toHaveLength(5);
  });

  it("disables days and navigation outside validRange", async () => {
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={MARCH_11}
        config={{
          ...baseConfig,
          defaultView: "month",
          validRange: { start: "2026-03-05", end: "2026-04-01" },
        }}
      />
    );
    await screen.findAllByRole("gridcell");
    const disabled = container.querySelectorAll(".react-agendfy-calendar-day.react-agendfy-day-disabled");
    // Mon 23 Feb .. Wed 4 Mar before, Wed 1 Apr .. Sun 5 Apr after (pt grid starts Monday)
    expect(disabled.length).toBe(10 + 5);
    expect(container.querySelector(".react-agendfy-prev-button")).toBeDisabled();
    expect(container.querySelector(".react-agendfy-next-button")).toBeDisabled();
  });

  it("uses eventContent in month, list and agenda views without losing the frame", async () => {
    const eventContent = jest.fn(({ event, view, timeText }) => (
      <span data-testid="custom">{`${view}:${event.title}:${timeText}`}</span>
    ));
    const single: EventProps = {
      id: "e1",
      title: "Consulta",
      start: "2026-03-11T14:00:00Z",
      end: "2026-03-11T15:00:00Z",
    };
    const view = (defaultView: "month" | "list" | "agenda") => (
      <Calendar events={[single]} currentDate={MARCH_11} eventContent={eventContent} config={{ ...baseConfig, defaultView }} />
    );
    const month = render(view("month"));
    expect(await screen.findByText("month:Consulta:14:00 - 15:00")).toBeInTheDocument();
    month.unmount();

    const list = render(view("list"));
    expect(await screen.findByText("list:Consulta:14:00 - 15:00")).toBeInTheDocument();
    list.unmount();

    render(view("agenda"));
    expect(await screen.findByText("agenda:Consulta:14:00 - 15:00")).toBeInTheDocument();
    const agendaItem = screen.getByRole("button", { name: /Consulta/ });
    expect(within(agendaItem).getByTestId("custom")).toBeInTheDocument();
  });

  it("uses an event-rendering plugin in the week view", async () => {
    const Content = ({ event }: { event: EventProps }) => <b data-testid="plugin-content">{event.title}!</b>;
    render(
      <Calendar
        events={[{ id: "w1", title: "Exame", start: "2026-03-11T10:00:00Z", end: "2026-03-11T11:00:00Z" }]}
        currentDate={MARCH_11}
        plugins={[{ key: "r", type: "event-rendering", component: Content }]}
        config={{ ...baseConfig, defaultView: "week", slotMin: "08:00", slotMax: "12:00" }}
      />
    );
    expect(await screen.findByTestId("plugin-content")).toHaveTextContent("Exame!");
  });

  it("lists mid-window events in the agenda view", async () => {
    render(
      <Calendar
        events={[{ id: "a1", title: "Sexta", start: "2026-03-13T09:00:00Z", end: "2026-03-13T10:00:00Z" }]}
        currentDate={MARCH_11}
        config={{ ...baseConfig, defaultView: "agenda" }}
      />
    );
    expect(await screen.findByText("Sexta")).toBeInTheDocument();
  });

  it("navigates the day view over hidden weekdays", async () => {
    const { container } = render(
      <Calendar
        events={[]}
        currentDate={new Date("2026-03-13T12:00:00Z")}
        config={{ ...baseConfig, defaultView: "day", weekends: false }}
      />
    );
    await screen.findByText(/13 março 2026/i);
    fireEvent.click(container.querySelector(".react-agendfy-next-button")!);
    expect(container.querySelector(".react-agendfy-toolbar-title")).toHaveTextContent(/16 março 2026/i);
  });

  it("reports the displayed date through onDateChange", async () => {
    const onDateChange = jest.fn();
    const { container } = render(
      <Calendar events={[]} currentDate={MARCH_11} onDateChange={onDateChange} config={{ ...baseConfig, defaultView: "week" }} />
    );
    await screen.findAllByRole("columnheader");
    expect(onDateChange).toHaveBeenLastCalledWith(new Date(MARCH_11.getTime()));
    fireEvent.click(container.querySelector(".react-agendfy-next-button")!);
    expect(onDateChange).toHaveBeenLastCalledWith(new Date("2026-03-18T12:00:00Z"));
  });
});
