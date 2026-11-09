# @react-agendfy/fullcalendar-compat

## 1.3.0

### Minor Changes

- f260342: The month grid looks like FullCalendar's with a busy schedule:
  
  - `dayMaxEvents: true` now shows as many events as fit in each cell (it showed 3), and the month rows share the calendar's `height`. The "+N more" link sits under the events.
  - `displayEventEnd` is supported. As in FullCalendar, `timeText` has no end time in `dayGridMonth` ("09:00") and keeps it in the other views. It was always "09:00 - 09:30".
  
  Needs `@react-agendfy/core` 2.3.

## 1.2.0

### Minor Changes

- 0ec8fd4: `resourceTimelineDay` / `resourceTimelineWeek` / `resourceTimelineMonth` map to the timeline views of `@react-agendfy/plugin-timeline`; pass them with `agendfyPlugins={timelinePlugins}`.
- 5ad9ab0: `resourceTimeGridDay` / `resourceTimeGridWeek`, the `resources` option (array form, including per-resource `businessHours`), `datesAboveResources`, `dateClick.resource` and `eventDrop.newResource` / `oldResource`. `slotDuration` now defaults to 30 minutes, as in FullCalendar.
- b0ca71d: `eventOverlap`, `eventConstraint` (including groupId constraints), `eventAllow`, `selectAllow` and `selectOverlap` now work, along with per-event `overlap` and `constraint`. They were previously accepted and ignored. They need `@react-agendfy/core` 2.2.

## 1.1.0

### Minor Changes

- aa7b0b9: `eventClassNames` and `dayCellClassNames` now work, as in FullCalendar: a string, a list, or a function. The event function receives `event` (EventApi), `view`, `isPast` and `isFuture`; the day function receives `date`, `view`, `isToday`, `isPast`, `isFuture`, `isOther` and `isDisabled`. Requires @react-agendfy/core 2.1.

## 1.0.1

### Patch Changes

- 75fcd7b: `getApi()` now has `unselect()` and `select()`, which do nothing (the
  selection clears itself). Code that calls
  `calendarRef.current.getApi().unselect()` after a `select` callback (a
  common FullCalendar pattern) threw a TypeError.

## 1.0.0

### Minor Changes

- f5aa769: New package `@react-agendfy/fullcalendar-compat`: `@fullcalendar/react`'s
  props, callback `info` objects (`EventApi` with `startStr`, `extendedProps`
  and `_def`, `revert()` on drops and resizes, `datesSet`, `dateClick`,
  `select`, `eventContent` with `{ html }`), event sources (arrays, functions,
  JSON feeds) and `getApi()` on top of react-agendfy. FullCalendar defaults
  are kept, so migrating is an import swap. See `MIGRATING.md`.

  Core additions, all optional with defaults unchanged:

  - `apiRef` (imperative `CalendarApi`), `onDatesSet` (visible range, end
    exclusive) and `onViewChange`.
  - `headerViews` (which view buttons, in order) and `showHeader`.
  - `editable`, `eventStartEditable`, `eventDurationEditable`,
    `selectable`. Default `true`; before, these could not be turned off,
    because the views always received a handler.
  - `refetchEvents` re-runs data-source plugins, which now fetch for the
    active view (they used the initial one).
  - Resize handles only show when resizing is enabled, and the day view no
    longer shows a resize handle that did nothing.

### Patch Changes

- Updated dependencies [f5aa769]
- Updated dependencies [6fc7fc6]
- Updated dependencies [89c638a]
- Updated dependencies [c26c3e0]
- Updated dependencies [3c59b01]
- Updated dependencies [f9a62af]
  - @react-agendfy/core@2.0.0
