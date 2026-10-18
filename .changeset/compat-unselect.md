---
"@react-agendfy/fullcalendar-compat": patch
---

`getApi()` now has `unselect()` and `select()`, which do nothing (the
selection clears itself). Code that calls
`calendarRef.current.getApi().unselect()` after a `select` callback (a
common FullCalendar pattern) threw a TypeError.
