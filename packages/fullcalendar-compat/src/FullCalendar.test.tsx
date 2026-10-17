/*
 * The import swap: FullCalendar-style props, callbacks and getApi() on top
 * of react-agendfy, rendered for real (no view mocks).
 */
import React, { createRef } from "react";
import { act, configure, fireEvent, render, screen } from "@testing-library/react";
import FullCalendar, { type FullCalendarHandle } from "./index";
import type { DatesSetArg, EventClickArg, EventDropArg } from "./types";

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

const events = [
  {
    id: "1",
    title: "Consulta Ana",
    start: "2026-03-11T10:00:00Z",
    end: "2026-03-11T11:00:00Z",
    extendedProps: { status: "confirmed" },
    patientId: "p-1",
  },
];

describe("FullCalendar compat", () => {
  it("renders the initial view with only the toolbar's view buttons", async () => {
    const { container } = render(
      <FullCalendar
        plugins={[]}
        initialView="timeGridWeek"
        initialDate="2026-03-11"
        timeZone="UTC"
        locale="pt"
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth" }}
        events={events}
      />
    );
    await screen.findAllByRole("columnheader");
    const viewButtons = [...container.querySelectorAll(".react-agendfy-toolbar-chunk:last-child .react-agendfy-button")].map(
      (b) => b.textContent
    );
    expect(viewButtons).toEqual(["Semana", "Mês"]);
    expect(await screen.findByText(/Consulta Ana/)).toBeInTheDocument();
  });

  it("calls eventClick with a FullCalendar EventApi", async () => {
    const eventClick = jest.fn<void, [EventClickArg]>();
    render(
      <FullCalendar initialView="listWeek" initialDate="2026-03-11" timeZone="UTC" events={events} eventClick={eventClick} />
    );
    fireEvent.click(await screen.findByText("Consulta Ana"));
    const { event, view } = eventClick.mock.calls[0][0];
    expect(event.id).toBe("1");
    expect(event.startStr).toBe("2026-03-11T10:00:00Z");
    expect(event.extendedProps).toEqual({ status: "confirmed", patientId: "p-1" });
    expect(event._def.extendedProps.status).toBe("confirmed");
    expect(view.type).toBe("listWeek");
  });

  it("reports datesSet and fetches function sources for the visible range", async () => {
    const datesSet = jest.fn<void, [DatesSetArg]>();
    const source = jest.fn((_info, success) => success([{ id: "r", title: "Remoto", start: "2026-03-12T09:00:00Z" }]));
    render(
      <FullCalendar
        initialView="dayGridMonth"
        initialDate="2026-03-11"
        timeZone="UTC"
        firstDay={1}
        events={source}
        datesSet={datesSet}
      />
    );
    expect(await screen.findByText(/Remoto/)).toBeInTheDocument();
    const arg = datesSet.mock.calls[0][0];
    // fixedWeekCount (FullCalendar default): 6 weeks from Mon 23 Feb.
    expect([arg.startStr, arg.endStr, arg.view.type]).toEqual(["2026-02-23T00:00:00Z", "2026-04-06T00:00:00Z", "dayGridMonth"]);
    expect(source.mock.calls[0][0]).toMatchObject({ startStr: "2026-02-23T00:00:00Z", timeZone: "UTC" });
  });

  it("exposes getApi() for navigation and view changes", async () => {
    const ref = createRef<FullCalendarHandle>();
    render(<FullCalendar ref={ref} initialView="timeGridWeek" initialDate="2026-03-11" timeZone="UTC" events={events} />);
    await screen.findAllByRole("columnheader");
    const api = ref.current!.getApi();

    act(() => api.next());
    expect(api.getDate().toISOString().slice(0, 10)).toBe("2026-03-18");

    act(() => api.changeView("listMonth", "2026-03-11"));
    expect(api.view.type).toBe("listMonth");
    expect(await screen.findByText("Consulta Ana")).toBeInTheDocument();
    expect(api.getEventById("1")?.title).toBe("Consulta Ana");
    expect(api.getEvents()).toHaveLength(1);
  });

  it("passes info.revert() to eventDrop and puts the event back when called", async () => {
    // A native agendfy view stands in for a drag (jsdom has no layout).
    const DropView = ({ events: shown, onEventUpdate }: any) => (
      <div>
        <span data-testid="start">{shown[0]?.start}</span>
        <button onClick={() => onEventUpdate({ ...shown[0], start: "2026-03-11T15:00:00.000Z", end: "2026-03-11T16:00:00.000Z" })}>
          simulate-drop
        </button>
      </div>
    );
    const eventDrop = jest.fn<void, [EventDropArg]>();
    render(
      <FullCalendar
        initialView="dropTest"
        initialDate="2026-03-11"
        timeZone="UTC"
        editable
        events={events}
        eventDrop={eventDrop}
        agendfyPlugins={[{ key: "d", type: "view", viewName: "dropTest", component: DropView }]}
      />
    );
    fireEvent.click(await screen.findByText("simulate-drop"));
    const arg = eventDrop.mock.calls[0][0];
    expect(arg.oldEvent.startStr).toBe("2026-03-11T10:00:00Z");
    expect(arg.event.startStr).toBe("2026-03-11T15:00:00Z");
    expect(arg.delta).toEqual({ years: 0, months: 0, days: 0, milliseconds: 5 * 3600000 });
    expect(screen.getByTestId("start")).toHaveTextContent("2026-03-11T15:00:00.000Z");

    await act(async () => arg.revert());
    expect(screen.getByTestId("start")).toHaveTextContent("2026-03-11T10:00:00.000Z");
  });

  it("bases oldEvent on the last accepted move, like FullCalendar's store", async () => {
    let drop = 0;
    const DropView = ({ events: shown, onEventUpdate }: any) => (
      <button
        onClick={() => {
          drop += 1;
          const start = new Date(Date.parse("2026-03-11T10:00:00Z") + drop * 3600000).toISOString();
          const end = new Date(Date.parse(start) + 3600000).toISOString();
          onEventUpdate({ ...shown[0], start, end });
        }}
      >
        simulate-drop
      </button>
    );
    const eventDrop = jest.fn<void, [EventDropArg]>();
    const ref = createRef<FullCalendarHandle>();
    render(
      <FullCalendar
        ref={ref}
        initialView="dropTest"
        timeZone="UTC"
        editable
        events={events}
        eventDrop={eventDrop}
        agendfyPlugins={[{ key: "d", type: "view", viewName: "dropTest", component: DropView }]}
      />
    );
    fireEvent.click(await screen.findByText("simulate-drop"));
    fireEvent.click(screen.getByText("simulate-drop"));
    const second = eventDrop.mock.calls[1][0];
    expect([second.oldEvent.startStr, second.event.startStr]).toEqual(["2026-03-11T11:00:00Z", "2026-03-11T12:00:00Z"]);
    expect(second.delta.milliseconds).toBe(3600000);
    expect(ref.current!.getApi().getEventById("1")!.startStr).toBe("2026-03-11T12:00:00Z");

    await act(async () => second.revert());
    expect(ref.current!.getApi().getEventById("1")!.startStr).toBe("2026-03-11T11:00:00Z");
  });

  it("does not allow dragging unless editable (FullCalendar default)", async () => {
    const DropView = ({ onEventUpdate }: any) => <span data-testid="drag">{String(typeof onEventUpdate)}</span>;
    render(
      <FullCalendar
        initialView="dropTest"
        timeZone="UTC"
        events={events}
        agendfyPlugins={[{ key: "d", type: "view", viewName: "dropTest", component: DropView }]}
      />
    );
    expect(await screen.findByTestId("drag")).toHaveTextContent("undefined");
  });

  it("renders eventContent results, including { html }", async () => {
    render(
      <FullCalendar
        initialView="listWeek"
        initialDate="2026-03-11"
        timeZone="UTC"
        events={events}
        eventContent={(arg) => ({ html: `<b data-testid="custom">${arg.timeText} ${arg.event.title}</b>` })}
      />
    );
    expect(await screen.findByTestId("custom")).toHaveTextContent("10:00 - 11:00 Consulta Ana");
  });
});
