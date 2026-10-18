# @react-agendfy/fullcalendar-compat

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
