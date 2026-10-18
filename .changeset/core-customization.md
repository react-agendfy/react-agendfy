---
"@react-agendfy/core": minor
---

Easier styling and customization. All additions are optional and default to
the current look.

- `config.slotHeight` (px, default 40): one source of truth for the week/day
  time grid — event positions/heights, the now line, hour/15-min lines and
  resize steps all follow it, and it is mirrored to `--agendfy-slot-height`.
  Time labels stay aligned with the grid lines at any height.
- `eventClassNames({ event, view })`: extra classes on every event element
  (week/day blocks, week all-day chips, month chips, list/agenda rows, drag
  preview).
- `dayCellClassNames({ date, view, isToday, isDisabled, isOtherMonth })`:
  extra classes on month cells, week columns and the day view.
- `className` on the calendar root; `data-view` on the root, `data-event-id`
  on events, `data-date` / `data-today` / `data-disabled` /
  `data-other-month` on day cells and columns.
- New component tokens (defaults = previous values): `--agendfy-slot-height`,
  `--agendfy-time-gutter-width`, `--agendfy-column-header-height`,
  `--agendfy-grid-line-hour/-minor`, `--agendfy-now-line-width`,
  `--agendfy-business-hours-bg/-opacity`, `--agendfy-color-selection`,
  `--agendfy-disabled-stripe/-opacity`, `--agendfy-month-cell-min-height`
  (+`-compact`), `--agendfy-event-radius/-font-size/-font-weight/-shadow`,
  `--agendfy-color-event-default/-default-fg`, `--agendfy-color-accent-fg`,
  `--agendfy-resize-handle-color/-hover-color`,
  `--agendfy-button-radius/-bg/-fg/-active-bg/-active-fg`,
  `--agendfy-popover-radius/-shadow`, `--agendfy-font-size-xs…xl`.
- Week grid lines are now classes (`.react-agendfy-grid-line--hour` /
  `--minor`) instead of inline styles.
- New exported types: `EventClassNamesArg`, `EventClassNamesGenerator`,
  `DayCellClassNamesArg`, `DayCellClassNamesGenerator`, `ClassNamesInput`.

Fix: on screens ≤ 640px the day view shrank its slots to 2rem by CSS while
events and the now line were still placed on a 40px grid; the slot height now
always matches `slotHeight`.
