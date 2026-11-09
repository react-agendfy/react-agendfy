# @react-agendfy/core

## 2.3.0

### Minor Changes

- f260342: Month cells can show as many events as fit, like FullCalendar's `dayMaxEvents: true`:
  
  - `dayMaxEvents: "fit"` measures each cell and shows the events that fit, with the rest behind "+N". The month rows share the calendar's height when it has one (a parent with a fixed height), so a busy day no longer makes its week taller; with an automatic height each row keeps `--agendfy-month-cell-min-height`. `true` still means 3.
  - `moreLinkPosition: "bottom"` puts the "+N" link under the visible events instead of next to the day number (default `"header"`).
  - `displayEventEnd: false` gives `timeText` without the end time ("09:00"). Default true.

## 2.2.0

### Minor Changes

- 1629b01: Batch changes and undoable field edits, for the Gantt:
  
  - `MiddlewarePlugin.cascade(change, ctx)` returns other events that must move with a change (a Gantt pushing successor tasks). They are carried in `EventChange.related`, validated with the change (one refused refuses all), applied together, passed to `onEventUpdate` each, and undone with one undo. If the host refuses any of them, all of them go back. `ChangeContext.events()` gives every event.
  - `useCalendarView().updateEvent(event, fields)` changes other fields (a task's `progress`) as one undoable change. `EventChange.fields` lists them; undo/redo restore them too.
  - The drag `anchor` (grab point) now also applies to all-day drop zones, in whole days.
- cdd1027: Change pipeline (RFC 001, phase 1): every move/resize is validated, applied, passed to the callback and recorded.
  
  - Business rules: `eventOverlap`, `eventConstraint`, `eventAllow`, `selectAllow`, per-event `overlap`/`constraint`, and the `onChangeRejected` prop.
  - Undo/redo: `api.undo()`, `api.redo()`, `api.canUndo()`, `api.canRedo()`, Ctrl/⌘+Z shortcuts, `historyLimit`, `undoShortcuts`.
  - `middleware` plugins (`validate`, `onCommit`, `onRevert`).
  - `ViewPlugin.range` / `ViewPlugin.step`: custom views get their own visible range (recurrence expansion, data sources, `onDatesSet`, `getView()`, prev/next) and a `range` prop.
  - New exports: `validateChange`, `findOverlapConflicts`, `satisfiesConstraint` and the related types.
- c4ea300: Drag in from outside the calendar (RFC 001, phase 2, step 3): `AgendfyDndProvider`, `ExternalDraggable` and the `onEventReceive` prop. Received events go through the rules (with the live preview), are reverted when the callback's Promise rejects, and land on the slot (week/day) or day (month, all-day or at `startTime`) under the pointer.
- dd42423: The agenda view is now the list view over the next 7 days: one component, with the same `agenda` view name, classes and empty message. The list view shows a multi-day event that started before the period on its first day (it was missing), and is no longer virtualized. This drops the `react-window` dependency.
- 0fe86e5: Business hours you can see, and rules for your own forms:
  
  - The time outside business hours is now shaded (token `--agendfy-non-business-bg`) in the week, day and resource views, including a day with none at all (a weekend). In the resource views each resource's own hours apply. The light tint of the business hours themselves was nearly invisible.
  - `api.validate(change)` checks an event created or edited in the host's own form against `eventOverlap`, `eventConstraint`, `eventAllow` and middleware plugins, without applying it.
- ee23bdf: One resource model: `resourceIds` / `resourceId` on events, with names and icons resolved from the `resources` prop.
  
  - Event resource icons, tooltips and the resource filter used to read only `event.resources` objects, while the overlap rules, resource moves and the timeline read `resourceId`/`resourceIds`. Every reader now goes through `eventResourceIds(event)` (new export). Legacy `resources` objects still work.
  - Callbacks (`onEventUpdate`, `onEventResize`, `onEventReceive`, `onEventClick`) hand events back in the shape the host gave them, without the resource objects the calendar derives for display.
- df17cad: Resource views and the time axis (RFC 001, phase 3):
  
  - New views `resourceDay` and `resourceWeek`: one column per resource (and day), with an all-day row, the overlap layout, drag between resources (a multi-resource event swaps only the resource it is dragged from), resize, live validation and keyboard drag. They appear in the header when there are `resources`. New options `datesAboveResources` and `resourceColumnMinWidth`, and translated labels.
  - `Resource.businessHours`: a resource's own hours are shaded in its columns and enforced by `eventConstraint: "businessHours"`.
  - `onSlotClick(date, { resourceId })` in the resource views. The SDK adds `onSlotClick` and `businessHoursFor(date, resource)`.
  - Keyboard drag in views built on the SDK: the arrow keys move from drop zone to drop zone.
  - Public building blocks: `createTimeScale` (a wall-clock time axis with daily windows, hidden days and DST) and `useVirtualRange` (windowing with no dependencies).
- 9744ae1: Shared drag context and live drop validation (RFC 001, phase 2, steps 1–2).
  
  - One DndContext per calendar (`InteractionProvider`); views register their drag handlers instead of owning a context. Views rendered on their own keep working.
  - Live validation: over a drop that `eventOverlap`, `eventConstraint`, `eventAllow` or a middleware plugin would refuse, the drag preview gets `.react-agendfy-drag-preview--invalid` and `data-invalid-reason`. New token `--agendfy-drop-invalid-color`.
  - Keyboard drag fixed in every view. Arrows move by one slot, column or day, counted in units, so fast presses and scrolling no longer land a slot off. Week view events have a single tab stop (Enter opens, Space picks up). The week view drop also works without a pointer.
- 8b90c14: For timeline-style views:
  
  - `useEventDraggable(event, { anchor })` keeps the grab point on a pointer drop: long bars no longer jump, and day slots keep the time of day. The resource views use it.
  - `layoutLanes(events, span?)` stacks events in lanes.
  - Also exported: `complementRanges`, `getContrastText`, `clockToMinutes`, `getHiddenDays`.
- 1629b01: `headerViews` accepts groups: `{ label, views }` is one header button with a menu of its views (keyboard: arrows, Home/End, Escape). The button shows the group's active view. `HeaderViewGroup` and `HeaderViewItem` are exported.
- 3ec2622: Public SDK for custom views (RFC 001, phase 2, step 4):
  
  - `useCalendarView()`: the stable API for views and plugins. It covers state, texts (`t`), zone-aware formatting, day rules, navigation, `moveEvent`/`resizeEvent`/`validate` through the change pipeline, undo/redo, and the host's click handler, `eventContent` and `eventClassNames`.
  - `useEventDraggable(event)` and `useDropZone(id, { date, allDay?, resourceIds? })`: drag & drop in custom views with the built-in preview, live validation, click-vs-drag, moves between resources and external drops.
  - `ViewPlugin.label` (string or `{ key }`) and `ViewPlugin.messages` (per-language texts for `t`).
  - Undo/redo also restores legacy `resources` objects.

### Patch Changes

- 349f87c: Fixes found while building RFC 001 phase 2 (all predate it):
  
  - Events from data-source plugins (e.g. `plugin-google-calendar`) never reached the views. The plugin filter/search was an allow-list of ids taken at the last `events` sync. They now apply only while active, survive `events` updates (saving a drag no longer clears an active filter), and a filter that keeps every event is off.
  - The week view looked every event up again for each of its ~200 slots and built hundreds of thousands of zoned dates per render (about 2s per drop on a busy week in development). Events are now indexed by slot once per render, about 15× faster.
  - Week view events starting between slot lines (10:15 with 30-minute slots) were not shown. They now show in the slot below their start, offset to their real time, in both the week and the day view.
- ca04466: `lang: "pt"` keeps Monday as the first day of the week. date-fns 4.4 changed its `pt` locale to Sunday; without this, updating date-fns moved every European Portuguese calendar.

## 2.1.1

### Patch Changes

- 9535f78: Week/Day views: the current-time line now draws above timed events instead of underneath them.

## 2.1.0

### Minor Changes

- 4fadcc5: Easier styling and customization. All additions are optional and default to
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

- 4fadcc5: List and agenda views get a new event design: one row per event (time,
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
