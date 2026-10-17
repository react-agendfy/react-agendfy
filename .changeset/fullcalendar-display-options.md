---
"@react-agendfy/core": minor
---

More FullCalendar-parity options. All are optional and the defaults render
exactly as before:

- `eventTimeFormat` / `slotLabelFormat`: date-fns patterns for event times
  and time-grid labels, in every view, in the tooltips and in
  `eventContent`'s `timeText`. `slotLabelFormat` existed but was ignored.
- `slotLabelInterval`: time-grid labels every N minutes.
- `weekNumbers` + `weekNumberCalculation` ("local" | "ISO"): week numbers
  in month rows and in the week view corner.
- `dayMaxEvents` (number | boolean): month cell limit. The "+N" link now
  opens a popover with the day's events instead of a browser `alert()`.
- `fixedWeekCount`: 6-row month.
- `listRange` ("day" | "week" | "month"): list view span. Navigation and the
  title follow it.
- `allDaySlot`, `nowIndicator`.
- Revert on failure: when `onEventUpdate` or `onEventResize` returns a
  rejected Promise, the move or resize is undone (FullCalendar's
  `info.revert()`).

Fixes:
- Optimistic moves and resizes did not show until the host re-sent the
  events: filtering returned the plugin copies frozen at the last sync.
- The current-time line was drawn in every column, at the time of the
  navigated date (or at the top). It now shows only in today's column, at
  the real time, inside the grid hours, and moves every minute.
- Tooltips showed times in the host time zone instead of the calendar's.
