---
"@react-agendfy/core": minor
"@react-agendfy/plugin-export-pdf": patch
"@react-agendfy/plugin-export-reports": patch
"@react-agendfy/plugin-google-calendar": patch
---

FullCalendar-parity features for migrating scheduling apps:

- Recurrence is expanded once in the calendar context and works in every view
  (month, week, day, list, agenda). Accepts RRULE strings (incl. DTSTART /
  EXDATE / RDATE lines) or FullCalendar-style objects, the `rrule` alias, and
  `exdate` exclusions. Wall-clock times are kept across DST. Each occurrence
  carries `originalEventId` and `occurrenceStart`. `expandRecurrences` is
  exported.
- New config: `weekStartsOn` (defaults to the locale's convention),
  `hiddenDays`, `weekends`, and `validRange` (days outside it are disabled,
  prev/next is clamped and disabled).
- New `eventContent` prop, plus `event-rendering` plugins that now actually
  render, in every view. Only the inner content is replaced; drag and resize
  are kept.
- `currentDate` and `onDateChange` props now work.
- Business hours are shaded in the day view. In the week view they now honour
  `slotMin` and the calendar time zone.
- Views render inside `<Suspense>`, so SSR (`renderToString`) works.
- Fixes: the header and grids agreed on different first days of the week; the
  agenda dropped events in the middle of the week; the list view used the
  time zone as its locale.
- Published type declarations were empty (the `vite-plugin-dts` option
  `outputDir` → `outDir`).
