---
"@react-agendfy/core": minor
---

Month cells can show as many events as fit, like FullCalendar's `dayMaxEvents: true`:

- `dayMaxEvents: "fit"` measures each cell and shows the events that fit, with the rest behind "+N". The month rows share the calendar's height when it has one (a parent with a fixed height), so a busy day no longer makes its week taller; with an automatic height each row keeps `--agendfy-month-cell-min-height`. `true` still means 3.
- `moreLinkPosition: "bottom"` puts the "+N" link under the visible events instead of next to the day number (default `"header"`).
- `displayEventEnd: false` gives `timeText` without the end time ("09:00"). Default true.
