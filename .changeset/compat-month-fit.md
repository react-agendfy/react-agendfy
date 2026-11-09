---
"@react-agendfy/fullcalendar-compat": minor
---

The month grid looks like FullCalendar's with a busy schedule:

- `dayMaxEvents: true` now shows as many events as fit in each cell (it showed 3), and the month rows share the calendar's `height`. The "+N more" link sits under the events.
- `displayEventEnd` is supported. As in FullCalendar, `timeText` has no end time in `dayGridMonth` ("09:00") and keeps it in the other views. It was always "09:00 - 09:30".

Needs `@react-agendfy/core` 2.3.
