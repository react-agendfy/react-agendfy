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
| `listYear`, `multiMonth*`, `resourceTimeline*` | ⛔ | `listYear` falls back to `listMonth`. Use `agendfyPlugins` for custom views (there is a timeline plugin). |

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
| `slotDuration`, `slotLabelInterval` | ✅ | |
| `slotMinTime`, `slotMaxTime` | 🟡 | Week view: whole hours. |
| `slotLabelFormat`, `eventTimeFormat` | ✅ | Formatter objects (`{ hour, minute, meridiem, hour12 }`) or date-fns patterns. |
| `allDaySlot`, `nowIndicator`, `weekNumbers`, `weekNumberCalculation` | ✅ | `weekNumberCalculation` takes `"local"` or `"ISO"`; functions are not supported. |
| `dayMaxEvents` | ✅ | The "+N more" link opens a popover with the day's events. `dayMaxEventRows` is ignored. |
| `fixedWeekCount` | ✅ | |
| `editable`, `eventStartEditable`, `eventDurationEditable`, `selectable` | ✅ | Per-event `editable` is not supported. |
| `selectMirror` | ⛔ | The selection is always highlighted. |
| `height`, `contentHeight` | ✅ | `"auto"`, a number or any CSS length. `aspectRatio` is ignored. |
| `eventOverlap`, `selectOverlap`, `eventAllow`, `selectAllow` | ⛔ | Validate in `eventDrop`/`select` and call `info.revert()`. |
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
| `groupId`, `url`, `display`, `textColor`, `borderColor` | 🟡 | Exposed on `EventApi`, but not used for rendering. `display: "background"` is not supported. |
| `startTime`/`endTime`/`daysOfWeek` (simple recurrence) | ⛔ | Use `rrule`. |

## Callbacks

| Callback | | Notes |
|---|---|---|
| `eventClick` | ✅ | `el` and `jsEvent` are `null`. |
| `dateClick` | ✅ | Time slots (week/day) and days (month). `dayEl` and `jsEvent` are `null`. |
| `select` | ✅ | `end` is exclusive, as in FullCalendar. |
| `eventDrop` | ✅ | `event`, `oldEvent`, `delta`, `revert()`. `oldEvent` reflects earlier accepted moves. |
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
