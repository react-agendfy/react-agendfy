---
"@react-agendfy/core": minor
---

List and agenda views get a new event design: one row per event (time,
colour dot, title), the same in both views, with natural day headings
("Monday, October 19" / "segunda-feira, 19 de outubro") and a "Today" pill.
It works in dark mode.

Fixes:
- An event without a colour was invisible in the list view (white text on
  white).
- All-day events showed "00:00 - 00:00"; they now say "All day".
- A 📌 appeared on every event in every view: the placeholder resource
  that normalizeEvents assigns is no longer displayed.
- The agenda header showed the month instead of its 7-day range.
- In the week and month views, an all-day event ending at 00:00 also showed
  on the next day (the end is exclusive), and those checks used the host's
  time zone instead of the calendar's.
- Month chips of all-day events no longer show "00:00".
- The list view now orders each day's events by time (all-day first).
- The export button is styled like the other toolbar buttons.
