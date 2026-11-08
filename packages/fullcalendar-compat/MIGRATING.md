# Migrating from FullCalendar (v6, React)

This is an honest map of the FullCalendar API to
`@react-agendfy/fullcalendar-compat`:

- ✅ **Supported:** same name and same behaviour.
- 🟡 **Partial:** the difference is described.
- ⛔ **Ignored:** accepted so your code still compiles, but it has no
  effect.

FullCalendar's defaults are kept. That means `editable`, `selectable`,
`nowIndicator` and `dayMaxEvents` start off, and `fixedWeekCount` starts
on, even where react-agendfy itself defaults differently.

## Views

| FullCalendar | | Notes |
|---|---|---|
| `dayGridMonth` | ✅ | |
| `timeGridWeek`, `timeGridDay` | ✅ | |
| `listDay`, `listWeek`, `listMonth` | ✅ | |
| `dayGridWeek`, `dayGridDay` | 🟡 | Rendered as the time-grid week/day. |
| `resourceTimeGridDay`, `resourceTimeGridWeek` | ✅ | One column per resource (and day), with the `resources` option. Only the columns in view are rendered, so hundreds of resources stay fast. `datesAboveResources` is supported. |
| `resourceTimelineDay`, `resourceTimelineWeek`, `resourceTimelineMonth` | ✅ | With `@react-agendfy/plugin-timeline`: `agendfyPlugins={timelinePlugins}` (and its `style.css`). Resources down the side, time across, collapsible groups, drag between resources, resize, keyboard. |
| `listYear`, `multiMonth*` | ⛔ | `listYear` falls back to `listMonth`. Use `agendfyPlugins` for custom views. |

## Options

| Option | | Notes |
|---|---|---|
| `initialView`, `initialDate` | ✅ | |
| `headerToolbar` | 🟡 | The view buttons listed and their order are respected, and `false` hides the toolbar. The layout of `left`/`center`/`right` and custom buttons is ignored: prev/next/today/title are always on the left. |
| `locale` | ✅ | Built-in texts for `en`, `pt`, `pt-br`, `es`, `fr`, `ar`. Dates use every date-fns locale. `locales` is ignored. |
| `timeZone` | ✅ | `"local"` (default), `"UTC"` or any IANA name. |
| `firstDay`, `weekends`, `hiddenDays` | ✅ | |
| `validRange` | ✅ | Objects only; the function form is not supported. |
| `businessHours` | ✅ | `true`, an object or an array. |
| `slotDuration`, `slotLabelInterval` | ✅ | Default 30 minutes, as in FullCalendar. |
| `resources` | 🟡 | The array form: `id`, `title`, `children`, `businessHours` (shaded in the resource columns, and enforced by `eventConstraint: "businessHours"`); other keys go to `extendedProps`. Function and URL sources are not supported. Events use `resourceId` / `resourceIds`. |
| `slotMinTime`, `slotMaxTime` | 🟡 | Week view: whole hours. |
| `slotLabelFormat`, `eventTimeFormat` | ✅ | Formatter objects (`{ hour, minute, meridiem, hour12 }`) or date-fns patterns. |
| `allDaySlot`, `nowIndicator`, `weekNumbers`, `weekNumberCalculation` | ✅ | `weekNumberCalculation` takes `"local"` or `"ISO"`; functions are not supported. |
| `dayMaxEvents` | ✅ | The "+N more" link opens a popover with the day's events. `dayMaxEventRows` is ignored. |
| `fixedWeekCount` | ✅ | |
| `editable`, `eventStartEditable`, `eventDurationEditable`, `selectable` | ✅ | Per-event `editable` is not supported. |
| `selectMirror` | ⛔ | The selection is always highlighted. |
| `height`, `contentHeight` | ✅ | `"auto"`, a number or any CSS length. `aspectRatio` is ignored. |
| `eventOverlap` | 🟡 | `false` or a function `(stillEvent, movingEvent)` that gets `EventApi`s. A refused drop never fires `eventDrop`. Difference: when both events carry resources (`resourceId`/`resourceIds`), events on different resources never overlap, even outside resource views. |
| `eventConstraint` | ✅ | `"businessHours"` (uses `businessHours`; no constraint when `businessHours` is off), a groupId, a `{ start, end }` range, or business-hours-like objects (`{ startTime, endTime, daysOfWeek }` or a list). |
| `eventAllow` | 🟡 | Gets `(dropInfo, draggedEvent)`. `dropInfo` has `start`, `end`, `startStr`, `endStr` and `allDay`, but no `resource`. |
| `selectAllow` | ✅ | Gets `{ start, end, startStr, endStr, allDay }`, with the same exclusive all-day end as `select`. |
| `selectOverlap` | ✅ | `false`, or a function that gets each `EventApi` under the selection. |
| `eventClassNames`, `dayCellClassNames` | ✅ | A string, a list, or a function. Event arg: `event`, `view`, `isPast`, `isFuture`. Day arg: `date`, `view`, `isToday`, `isPast`, `isFuture`, `isOther`, `isDisabled`. |
| `navLinks`, `stickyHeaderDates`, `expandRows`, `eventDisplay`, `droppable`, `dayCellDidMount`, `eventDidMount`, `customButtons`, `views` | ⛔ | Accepted, no effect. |

## Events

| Feature | | Notes |
|---|---|---|
| `events` as an array, a function `(fetchInfo, success, failure)` or a URL | ✅ | Functions may also return a Promise. URLs get `?start&end&timeZone` like a JSON feed. |
| `eventSources` (array, function, URL or `{ events, color }`) | ✅ | |
| `id`, `title`, `start`, `end`, `allDay`, `color`/`backgroundColor` | ✅ | `"YYYY-MM-DD"` means all-day. A missing `end` defaults to +1h, or +1 day for all-day events. |
| `extendedProps`, plus unknown keys moved into it | ✅ | |
| `rrule` (string or object), `exdate`, `duration` | ✅ | Built in. Occurrences keep the series `id`. |
| `overlap`, `constraint` | ✅ | Override `eventOverlap` / `eventConstraint` for one event. Same forms as the options. |
| `groupId`, `url`, `display`, `textColor`, `borderColor` | 🟡 | Exposed on `EventApi`, but not used for rendering. `display: "background"` is not supported. |
| `startTime`/`endTime`/`daysOfWeek` (simple recurrence) | ⛔ | Use `rrule`. |

## Callbacks

| Callback | | Notes |
|---|---|---|
| `eventClick` | ✅ | `el` and `jsEvent` are `null`. |
| `dateClick` | ✅ | Time slots (week/day) and days (month). In the resource views `resource` is the column's `ResourceApi` (`id`, `title`, `extendedProps`). `dayEl` and `jsEvent` are `null`. |
| `select` | ✅ | `end` is exclusive, as in FullCalendar. |
| `eventDrop` | ✅ | `event`, `oldEvent`, `delta`, `revert()`, and in the resource views `newResource` / `oldResource` when the resource changed. Dragging one copy of an event with several resources swaps only that resource. `oldEvent` reflects earlier accepted moves. |
| `eventResize` | ✅ | `startDelta`, `endDelta`, `revert()`. Resizing works in the week and month views. |
| `datesSet` | ✅ | Called on mount and on every navigation or view change. `end` is exclusive. |
| `eventContent` | ✅ | Return JSX or `{ html }`. `{ domNodes }` is not supported. |
| `loading` | ✅ | Remote sources only. |
| `eventAdd`/`eventChange`/`eventRemove`, `eventMouseEnter`/`Leave`, `eventReceive`/`drop` | ⛔ | |

## `EventApi` (read-only)

`id`, `groupId`, `title`, `start`, `end`, `startStr`, `endStr`, `allDay`,
`url`, `display`, `backgroundColor`, `borderColor`, `textColor`,
`extendedProps`, `_def.{publicId,title,extendedProps}`,
`_instance.range` and `toPlainObject()`.

`startStr` is ISO in the calendar time zone, with its offset (or `Z` for
UTC), or `YYYY-MM-DD` for all-day events.

Mutating methods (`setProp`, `setStart`, `remove`, …) are not available.
Update your `events` instead.

## `getApi()`

| Method | |
|---|---|
| `next()`, `prev()`, `today()`, `gotoDate()`, `getDate()` | ✅ |
| `changeView(name, date?)`, `view` (`type`, `activeStart`, `activeEnd`, `title`) | ✅ |
| `getEvents()`, `getEventById()` | ✅ |
| `refetchEvents()` | ✅ |
| `updateSize()`, `destroy()`, `unselect()` | ✅ (no-ops) |
| `select()` | 🟡 accepted, no effect |
| `addEvent`, `removeAllEvents`, `setOption` | ⛔ |

## Styling

FullCalendar's `.fc-*` CSS does not apply. react-agendfy is themed with CSS
variables (`--agendfy-color-*`, `--agendfy-radius-*`, …) on the calendar
root, and has built-in light and dark themes. Pass
`themeSystem="dark"` or `themeSystem="light"` to force one.
