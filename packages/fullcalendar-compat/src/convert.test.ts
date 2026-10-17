import {
  durationToClock,
  durationToMinutes,
  formatterToPattern,
  headerViewsFrom,
  toAgendfyConfig,
  toAgendfyEvent,
  toAgendfyView,
  toFcView,
  toLang,
} from "./convert";
import { createEventApi, formatIsoInZone } from "./eventApi";

describe("conversions", () => {
  it("parses FullCalendar durations", () => {
    expect(durationToMinutes("00:30:00")).toBe(30);
    expect(durationToMinutes("01:15")).toBe(75);
    expect(durationToMinutes({ hours: 1, minutes: 30 })).toBe(90);
    expect(durationToMinutes(15 * 60000)).toBe(15);
    expect(durationToMinutes("1.02:00")).toBe(1560);
    expect(durationToMinutes("nonsense")).toBeNull();
    expect(durationToClock("07:00:00")).toBe("07:00");
  });

  it("maps formatter objects to date-fns patterns", () => {
    expect(formatterToPattern({ hour: "2-digit", minute: "2-digit", hour12: false })).toBe("HH:mm");
    expect(formatterToPattern({ hour: "numeric", minute: "2-digit", meridiem: "short" })).toBe("h:mm a");
    expect(formatterToPattern({ hour: "numeric", meridiem: "lowercase" })).toBe("h aaa");
    expect(formatterToPattern("HH:mm")).toBe("HH:mm");
  });

  it("maps views, toolbar and locale", () => {
    expect(toAgendfyView("timeGridWeek")).toEqual({ view: "week" });
    expect(toAgendfyView("listMonth")).toEqual({ view: "list", listRange: "month" });
    expect(toFcView("list", "day")).toBe("listDay");
    expect(headerViewsFrom({ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }))
      .toEqual(["day", "week", "month", "list"]);
    expect(headerViewsFrom({ left: "prev,next", right: "today" })).toBeUndefined();
    expect(toLang("pt-br")).toBe("pt-BR");
    expect(toLang("es")).toBe("es");
  });

  it("applies FullCalendar defaults where they differ from agendfy", () => {
    const config = toAgendfyConfig({ slotDuration: "00:20:00", firstDay: 1, timeZone: "UTC" }, { view: "week" });
    expect(config).toMatchObject({
      slotDuration: 20,
      weekStartsOn: 1,
      timeZone: "UTC",
      dayMaxEvents: false,
      fixedWeekCount: true,
      nowIndicator: false,
      editable: false,
      selectable: false,
      businessHours: { enabled: false, intervals: [] },
    });
  });

  it("converts EventInput like FullCalendar does", () => {
    const allDay = toAgendfyEvent({ id: 7, title: "Feriado", start: "2026-03-11" })!;
    expect(allDay).toMatchObject({ id: "7", allDay: true });
    expect(new Date(allDay.end as string).getTime() - new Date(allDay.start as string).getTime()).toBe(86400000);

    const withProps = toAgendfyEvent({
      id: "a",
      title: "x",
      start: "2026-03-11T10:00:00Z",
      end: "2026-03-11T11:00:00Z",
      patientId: "p1",
      extendedProps: { status: "confirmed" },
    })!;
    expect(withProps.extendedProps).toEqual({ status: "confirmed", patientId: "p1" });
    expect(withProps.patientId).toBe("p1");

    const series = toAgendfyEvent({
      id: "s",
      title: "Sessão",
      rrule: { freq: "weekly", count: 3, dtstart: "2026-03-02T09:00:00Z" },
      duration: "00:45",
      exdate: ["2026-03-09T09:00:00Z"],
    })!;
    expect(series.start).toBe("2026-03-02T09:00:00.000Z");
    expect(series.end).toBe("2026-03-02T09:45:00.000Z");
    expect(series.recurrence).toEqual({ freq: "weekly", count: 3 });
    expect(series.exdate).toEqual(["2026-03-09T09:00:00Z"]);

    expect(toAgendfyEvent({ title: "sem início" })).toBeNull();
  });

  it("builds EventApi with FullCalendar strings and the series id", () => {
    const api = createEventApi(
      {
        id: "s-2026-03-09T09:00:00.000Z",
        originalEventId: "s",
        title: "Sessão",
        start: "2026-03-09T09:00:00.000Z",
        end: "2026-03-09T09:45:00.000Z",
        extendedProps: { room: 3 },
      },
      "Europe/Lisbon"
    );
    expect(api.id).toBe("s");
    expect(api.startStr).toBe("2026-03-09T09:00:00Z".replace("Z", "+00:00"));
    expect(api._def.extendedProps).toEqual({ room: 3 });
    expect(formatIsoInZone(new Date("2026-07-01T09:00:00Z"), "Europe/Lisbon")).toBe("2026-07-01T10:00:00+01:00");
    expect(formatIsoInZone(new Date("2026-07-01T09:00:00Z"), "UTC")).toBe("2026-07-01T09:00:00Z");
    expect(formatIsoInZone(new Date("2026-07-01T23:30:00Z"), "Europe/Lisbon", true)).toBe("2026-07-02");
  });
});
