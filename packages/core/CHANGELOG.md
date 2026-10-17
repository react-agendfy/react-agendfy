# @react-agendfy/core

## 2.0.0

### Major Changes

- f9a62af: v2 modernization release. See MIGRATION.md for the full v1 → v2 guide.

  **@react-agendfy/core (major — breaking):**

  - Fully typed public API: `CalendarProps`/`Config` no longer accept arbitrary
    keys; `Calendar` is a named export with a working `forwardRef`.
  - CSS class namespace unified to `react-agendfy-*` (old `react-agenfy-*` typo
    and `fc-*` classes removed) — custom CSS overrides must update selectors.
  - New 3-layer design-token system scoped under `.agendfy`
    (`--agendfy-*`; legacy `--color-*`/`--padding-*` names kept via a compat
    layer), OS-aware dark mode, `theme` now applied via a scoped `data-theme`
    attribute on the calendar root instead of mutating `document.documentElement`.
  - Built-in i18n catalog (en, pt, pt-BR, es, fr, ar) with user-config override;
    `lang: 'pt'` now resolves to European Portuguese (use `'pt-BR'` for
    Brazilian). Automatic RTL via `lang` or the new `direction` prop.
  - WCAG 2.1 AA accessibility: grid semantics, roving-tabindex arrow-key
    navigation, keyboard-operable events and drag & drop.
  - Correctness fixes: export crash, horizontal drag discarded as click,
    off-slot events not rendering, multi-day duration collapse on drag, resize
    off-by-one and timezone drift, inert data-source plugins.

  **@react-agendfy/ai (new):** provider-agnostic AI layer — natural-language
  event parsing (with an offline deterministic fallback), conflict detection and
  free-slot search (deterministic), LLM-assisted scheduling suggestions,
  calendar insights, React hooks, and a Quick Add header plugin. Ships an
  optional Claude adapter and an HTTP adapter for backend proxies.

  **Plugins (minor):** publish manifests fixed to ship built `dist` output,
  normalized peer dependencies, theme plugin now applies a complete dark token
  set to the calendar root.

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

- 6fc7fc6: More FullCalendar-parity options. All are optional and the defaults render
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

- 89c638a: FullCalendar-parity features for migrating scheduling apps:

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

### Patch Changes

- c26c3e0: Week/day time grid: drag and overlap layout.

  - Overlapping events now share the width per DAY (cluster columns, as in
    FullCalendar and Google Calendar). Before, columns were decided per slot,
    so an event starting in a different slot was drawn on top of its
    neighbour at full width.
  - Dragging shows a DragOverlay preview above every slot that moves in whole
    slots and columns. The original stays in place as a ghost, and the drop
    lands exactly where the preview is. Before, the moving event slid
    underneath later slots and could jump on drop.
  - Event blocks get padding (custom `eventContent` included), a smaller
    radius, an inset 1px separator ring and `box-sizing: border-box`. The day
    view honours the layout width (it was forced to 100%).

- 3c59b01: Week/day drag: the drop now always lands where the preview shows, even when
  the grid scrolls during the drag. This covers the calendar's own scroll, a
  host scroll container, page scroll and dnd-kit auto-scroll.

  Before, the preview snapped the raw pointer movement while the drop was
  computed separately, so with scrolling they could differ by a slot (one hour
  with 60-minute slots). Snapping now works in grid coordinates, the drop
  reuses the preview's snapped value, and the preview is kept inside
  slotMin/slotMax and the rendered columns.
