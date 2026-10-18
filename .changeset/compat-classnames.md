---
"@react-agendfy/fullcalendar-compat": minor
---

`eventClassNames` and `dayCellClassNames` now work, as in FullCalendar: a string, a list, or a function. The event function receives `event` (EventApi), `view`, `isPast` and `isFuture`; the day function receives `date`, `view`, `isToday`, `isPast`, `isFuture`, `isOther` and `isDisabled`. Requires @react-agendfy/core 2.1.
