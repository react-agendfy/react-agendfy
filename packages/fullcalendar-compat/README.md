# @react-agendfy/fullcalendar-compat

Move from `@fullcalendar/react` to [react-agendfy](../core) by changing
one import. The package keeps the same props, the same callback `info`
objects (an `EventApi` with `startStr`, `extendedProps`, `_def` and
`info.revert()`) and the same `ref.current.getApi()`.

```bash
npm i @react-agendfy/core @react-agendfy/fullcalendar-compat
```

```diff
- import FullCalendar from "@fullcalendar/react";
- import dayGridPlugin from "@fullcalendar/daygrid";
- import timeGridPlugin from "@fullcalendar/timegrid";
- import interactionPlugin from "@fullcalendar/interaction";
+ import FullCalendar from "@react-agendfy/fullcalendar-compat";
+ import "@react-agendfy/core/core.css";

  <FullCalendar
-   plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
    initialView="timeGridWeek"
    headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listWeek" }}
    editable
    selectable
    events={events}
    eventClick={(info) => openModal(info.event.id, info.event.extendedProps)}
    eventDrop={(info) => api.move(info.event.id, info.event.startStr).catch(info.revert)}
  />
```

You can keep the `plugins` prop if you like. It is accepted and ignored,
because recurrence, interaction and lists are built into the core.

## What you get on top of FullCalendar

- **Recurrence, list views and interaction are built in.** No
  `@fullcalendar/rrule` and no extra plugins. `exdate` works, and
  occurrences keep the series `id`.
- **Per-day overlap layout**, with a drag preview that snaps to slots and
  stays aligned while the grid scrolls.
- **Time zones** come from `@date-fns/tz`, so you don't need a time-zone
  plugin. `timeZone="Europe/Lisbon"` works out of the box.
- **SSR-safe** rendering (`renderToString`) and an
  `@react-agendfy/ai` add-on.
- **Native agendfy plugins** (custom views, export, themes) are available
  through the `agendfyPlugins` prop.

See **[MIGRATING.md](./MIGRATING.md)** for the full compatibility table.
