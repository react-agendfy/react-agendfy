---
"@react-agendfy/core": minor
"@react-agendfy/fullcalendar-compat": minor
---

New package `@react-agendfy/fullcalendar-compat`: `@fullcalendar/react`'s
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
