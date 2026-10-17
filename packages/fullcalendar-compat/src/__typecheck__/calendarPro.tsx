/*
 * Type-level drop-in check: the exact props of a real FullCalendar usage
 * (ClinicaPro's CalendarPro) must compile against this package unchanged.
 * Not shipped; compiled by `tsc --noEmit` (typecheck script).
 */
import React, { useRef } from "react";
import FullCalendar from "../index";

const conf: any = {};
const grid = { slotDuration: "00:30:00", slotLabelInterval: "01:00:00", slotMinTime: "07:00:00", slotMaxTime: "20:00:00" };
const fcLocale: string = "pt";
const events: any[] = [];

export function CalendarProLike() {
  const calendarRef = useRef<any>(null);
  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[{}, {}, {}, {}, {}]}
      timeZone="local"
      initialView={conf?.default_view}
      headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }}
      locales={[{}, {}]}
      locale={fcLocale}
      weekNumbers={conf?.week_numbers}
      weekNumberCalculation={conf?.week_number_calculation ? "local" : "ISO"}
      dayMaxEvents={conf?.day_max_events ?? 3}
      fixedWeekCount={false}
      nowIndicator
      stickyHeaderDates
      expandRows
      eventDisplay="block"
      slotDuration={grid.slotDuration}
      slotLabelInterval={grid.slotLabelInterval}
      editable={conf?.editable}
      navLinkWeekClick={() => {}}
      selectable={conf?.selectable}
      selectMirror={conf?.select_mirror}
      weekends={conf?.weekends}
      hiddenDays={conf?.hidden_days && JSON.parse(conf?.hidden_days)}
      businessHours={conf?.business_hours}
      validRange={{ ...(conf?.valid_range_start && { start: conf.valid_range_start }) }}
      slotMinTime={grid.slotMinTime}
      slotMaxTime={grid.slotMaxTime}
      allDaySlot={conf?.all_day_slot}
      eventStartEditable={!!conf?.editable && !conf?.disable_dragging}
      eventDurationEditable={!!conf?.editable && !conf?.disable_resizing}
      droppable={!!conf?.editable && !conf?.disable_dragging}
      height={"80vh"}
      themeSystem={"standard"}
      events={events}
      eventTimeFormat={fcLocale === "en" ? { hour: "numeric", minute: "2-digit", meridiem: "short" } : { hour: "2-digit", minute: "2-digit", hour12: false }}
      eventAdd={() => {}}
      dayCellDidMount={() => {}}
      eventContent={(info) => <span>{info.timeText} {info.event.extendedProps?.tipo} {info.event.title}</span>}
      select={(info) => void info.startStr}
      eventClick={({ event }) => void event._def.extendedProps}
      eventDrop={(info) => { void info.event.start; info.revert(); }}
      eventResize={(info) => info.revert()}
    />
  );
}
