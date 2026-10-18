# @react-agendfy/core

The core calendar component for [react-agendfy](../../README.md): five built-in
views, drag-and-drop and resize (pointer + keyboard), recurring events,
timezone-aware rendering, i18n with RTL, WCAG 2.1 AA accessibility, a scoped
design-token theming system and a plugin architecture.

## Installation

```bash
npm install @react-agendfy/core
# or
yarn add @react-agendfy/core
```

Peer dependencies: `react` and `react-dom` (18 or 19).

## Quickstart

```tsx
import React, { useState } from "react";
import { Calendar, type EventProps } from "@react-agendfy/core";
import "@react-agendfy/core/core.css";

const initialEvents: EventProps[] = [
  {
    id: "1",
    title: "Team Meeting",
    start: "2026-08-03T10:00:00.000Z",
    end: "2026-08-03T11:00:00.000Z",
    color: "#4353ff",
  },
];

export default function App() {
  const [events, setEvents] = useState<EventProps[]>(initialEvents);

  return (
    <Calendar
      events={events}
      config={{ defaultView: "month", timeZone: "UTC", lang: "en" }}
      onEventUpdate={(updated) =>
        setEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        )
      }
      onEventClick={(event) => console.log("clicked", event.title)}
    />
  );
}
```

`Calendar` is a **named export** and forwards its ref to the calendar's root
`HTMLDivElement`. The package also exports the `ensureDate` and `downloadBlob`
utilities and all public types (`CalendarProps`, `EventProps`, `Config`,
`CalendarView`, `DateRangeSelection`, `CalendarHeaderProps`, `Resource`, the
plugin types, and more — see `src/index.tsx`).

## `Calendar` props (`CalendarProps`)

| Prop | Type | Description |
| --- | --- | --- |
| `events` | `EventProps[]` | The events to render (required; `??`-defaulted to `[]`). |
| `resources` | `Resource[]` | Resources events can be assigned to (rooms, people, equipment). |
| `plugins` | `CalendarPlugin[]` | Plugin objects — see [Writing a plugin](#writing-a-plugin). |
| `config` | `Partial<Config>` | Configuration; unspecified keys fall back to the [defaults](#config-defaults). |
| `direction` | `"ltr" \| "rtl" \| "auto"` | Text direction of the calendar root. `"auto"` (default) derives from the resolved language (`ar`/`he`/`fa`/`ur` → rtl). |
| `theme` | `string` | `"dark"` / `"light"` force the built-in theme (scoped `data-theme` on the root); any other value is matched against theme plugins' `themeName`. |
| `filteredResources` | `string[]` | Initially selected resource-filter ids. |
| `emailAdapter` | `EmailAdapter` | Adapter used by event reminders to send email alerts. |
| `emailConfig` | `NotificationServiceConfig["emailConfig"]` | Email settings (e.g. `defaultRecipient`). |
| `onEventUpdate` | `(event: EventProps) => void` | Fired after an event is moved (drag and drop). |
| `onEventResize` | `(event: EventProps) => void` | Fired after an event is resized. |
| `onEventClick` | `(event: EventProps) => void` | Fired when an event is clicked/activated. |
| `onDayClick` | `(day: Date) => void` | Fired when a day cell is clicked (month view). |
| `onSlotClick` | `(slotTime: Date) => void` | Fired when a time slot is clicked (week/day views). |
| `onDateRangeSelect` | `(selection: EventProps \| DateRangeSelection) => void` | Fired when the user drags across a range of days/slots. |
| `currentDate` | `Date` | Declared on the type but **not currently consumed** — the calendar always starts at "now" in `config.timeZone`. |
| `onDateChange` | `(date: Date) => void` | Declared on the type but **not currently consumed**. |
| `eventContent` | `(arg: EventContentArg) => ReactNode` | Custom event body in every view — see [Customizing the look](#customizing-the-look). |
| `eventClassNames` | `(arg: { event, view }) => string \| string[]` | Extra classes on every event element. |
| `dayCellClassNames` | `(arg: { date, view, isToday, isDisabled, isOtherMonth? }) => string \| string[]` | Extra classes on month cells and week/day columns. |
| `className` | `string` | Extra class(es) on the `.agendfy` root. |

## Config defaults

`config` is merged in this order: built-in defaults → bundled i18n catalog for
`config.lang` → your explicit keys (your keys always win).

| Key | Default | Description |
| --- | --- | --- |
| `timeZone` | `"America/Sao_Paulo"` | IANA timezone used for all date math and display. |
| `defaultView` | `"week"` | Initial view: `"month" \| "week" \| "day" \| "list" \| "agenda"`. |
| `slotDuration` | `15` | Minutes per time slot (week/day views). |
| `slotLabelFormat` | `"HH:mm"` | date-fns format for slot labels. |
| `slotMin` | `"00:00"` | First visible time of day. |
| `slotMax` | `"23:59"` | Last visible time of day. |
| `slotHeight` | `40` | Height in px of one slot in the week/day grids (see [Customizing the look](#customizing-the-look)). |
| `lang` | `"en"` | Language tag; selects the bundled message catalog. |
| `businessHours` | enabled, Mon–Fri `09:00`–`17:00` | `{ enabled, intervals: [{ daysOfWeek, startTime, endTime }] }` — highlighted in week/day views. |
| `alerts` | `{ enabled: false, thresholdMinutes: 15 }` | Event reminders (toast/browser notification/email). |
| `export` | `true` | Show the export menu (formats come from export plugins). |
| `today`, `monthView`, `weekView`, `dayView`, `listView`, `agenda`, `all_day`, `clear_filter`, `filter_resources`, `calendar_export` | English labels | UI strings; normally supplied by the i18n catalog — set them only to override. |

All other `Config` keys are optional i18n message keys — see
[i18n message keys](#i18n-message-keys).

## Event object (`EventProps`)

```ts
interface EventProps {
  id: string;
  title: string;
  start: Date | string;      // ISO 8601 string or Date
  end: Date | string;
  allDay?: boolean;
  color?: string;            // any CSS color
  resourceId?: string | number;
  resourceIds?: (string | number)[];
  recurrence?: string;       // RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE"
  [key: string]: any;        // extra fields are preserved
}
```

Recurring events expand from the `recurrence` RRULE string (parsed with
[rrule](https://github.com/jkbrzt/rrule)); the rule is anchored to the event's
own `start`.

## Resource object (`Resource`)

```ts
interface Resource {
  id: string | number;
  name?: string;             // display label
  title?: string;
  type?: string;             // e.g. "room" | "person" | "equipment"
  children?: Resource[];
  [key: string]: any;
}
```

Assign a resource with `resourceId` (or several with `resourceIds`) on the
event. The `filteredResources` prop and the resource-filter plugin narrow the
visible events by resource.

## Views

| View | Description |
| --- | --- |
| `month` | Month grid with multi-day spanning events, overflow badge (`+N hidden events`), drag to move, range selection. |
| `week` | 7-day time grid with slots (`slotDuration`), drag/resize, business-hours highlight, current-time line. |
| `day` | Single-day time grid, same interactions as week. |
| `list` | Chronological list of events for the period. |
| `agenda` | Upcoming events grouped by day. |

Custom views are added with a `view` plugin and appear in the header's view
switcher automatically.

## Writing a plugin

A plugin is a plain object (see `src/types/plugins.ts`). Every plugin has a
`key` and a `type`; the remaining fields depend on the type:

| Type | Required fields | Injected/used how |
| --- | --- | --- |
| `view` | `viewName`, `component` | Rendered as a view; receives `events`, `currentDate`, `config`, callbacks, `resources`. |
| `filter` / `search` | `component`, `location` (`"left"`/`"right"`) | Rendered in the header; receives `events`, `config`, `resources`, `filteredResources`, `onFilterChange`, `onSearch`, `onResourceFilterChange`, plus your `props`. |
| `data-source` | `fetchEvents(start, end, config)` | Called for the visible range; returned events are merged with yours (your events win on id collisions). |
| `export` | `formatName`, `label`, `exportFunction`, `mimeType`, `fileExtension` | Adds an entry to the export menu; the returned `Blob`/string is downloaded. |
| `event-rendering` | `component` | Custom event renderer. |
| `interaction` | `viewName`, `component` | Interaction layer for a specific view. |
| `theme` | `themeName`, `cssVariables` | When `theme` prop matches `themeName`, `cssVariables` are applied to the calendar root (scoped). |

Header-control example (the shape used by `@react-agendfy/plugin-filter`):

```tsx
import React, { FC } from "react";
import { Calendar, type CalendarPlugin, type EventProps } from "@react-agendfy/core";

const OnlyMineFilter: FC<{
  events?: EventProps[];
  onFilterChange?: (filtered: EventProps[]) => void;
}> = ({ events = [], onFilterChange }) => (
  <button
    type="button"
    onClick={() => onFilterChange?.(events.filter((e) => e.mine === true))}
  >
    Only mine
  </button>
);

const onlyMinePlugin: CalendarPlugin = {
  key: "only-mine",
  type: "filter",
  location: "left",
  component: OnlyMineFilter,
};

<Calendar events={events} plugins={[onlyMinePlugin]} />;
```

Export-plugin example:

```tsx
import type { CalendarPlugin } from "@react-agendfy/core";

const txtExportPlugin: CalendarPlugin = {
  key: "txt-export",
  type: "export",
  formatName: "txt",
  label: "Export to TXT",
  mimeType: "text/plain",
  fileExtension: "txt",
  exportFunction: async (events) =>
    events.map((e) => `${e.title}: ${e.start} - ${e.end}`).join("\n"),
};
```

Plugins may also declare optional `activate()` / `deactivate()` lifecycle
hooks and a `description`.

## Customizing the look

Everything visual is driven by CSS custom properties scoped to the `.agendfy`
root (the library never styles `:root` or the host document), plus a few
props for things CSS alone cannot reach. Every token defaults to the built-in
look, so you only override what you want to change.

### Overriding tokens

Override on the root, either globally or through `className`:

```css
/* every calendar */
.agendfy { --agendfy-color-accent: #e11d48; }

/* one calendar: <Calendar className="team-cal" … /> */
.agendfy.team-cal { --agendfy-event-radius: 999px; }
```

Declare overrides on the `.agendfy` element itself (as above): the derived
tokens below are resolved there, so overriding e.g. `--agendfy-color-accent`
also updates `--agendfy-button-active-bg`.

Tokens live in `src/styles/tokens.css`, in three layers:

- **L1 primitives** — `--agendfy-space-1…8`, `--agendfy-radius-sm/md/lg/xl/full`, `--agendfy-font-sans/mono`, `--agendfy-font-size-xs/sm/base/lg/xl` (0.75 → 1.25rem), palette primitives (`--agendfy-indigo-500`, `--agendfy-coral-500`, …).
- **L2 semantic colors** (light defaults; dark values are swapped automatically):

| Token | Purpose |
| --- | --- |
| `--agendfy-color-ground` | Page-level background behind the calendar. |
| `--agendfy-color-surface` / `-surface-2` / `-surface-hover` | Card/cell surfaces and hover state. |
| `--agendfy-color-border` / `-border-strong` | Grid and control borders. |
| `--agendfy-color-text` / `-text-muted` / `-text-faint` | Text hierarchy. |
| `--agendfy-color-accent` / `-accent-hover` / `-accent-soft` | Primary accent (buttons, active view, today number). |
| `--agendfy-color-now` | Current-time line / destructive accents. |
| `--agendfy-color-today-wash` | "Today" cell/column background. |
| `--agendfy-color-event-fg` | Text on colored event blocks. |
| `--agendfy-focus-ring` | Focus-visible ring. |
| `--agendfy-shadow-sm/md/lg` | Elevation. |
| `--agendfy-transition-duration/-timing` | Motion. |

- **L3 component tokens** (theme-agnostic; most derive from L2):

| Token | Default | Controls |
| --- | --- | --- |
| `--agendfy-slot-height` | `40px` | Time-grid slot height. **Written by the views from `config.slotHeight`** — set the config, not this variable. |
| `--agendfy-time-gutter-width` | `4rem` | Width of the week view's time-label / all-day-label column. |
| `--agendfy-column-header-height` | `3rem` | Week view day header height. |
| `--agendfy-grid-line-hour` | `1px solid var(--agendfy-color-border)` | Hour lines in week columns (any `border` shorthand). |
| `--agendfy-grid-line-minor` | `1px dashed var(--agendfy-color-border-strong)` | 15-minute lines in week columns. |
| `--agendfy-now-line-width` | `2px` | Current-time line thickness (color: `--agendfy-color-now`). |
| `--agendfy-business-hours-bg` / `-opacity` | `var(--agendfy-color-accent-soft)` / `0.45` | Business-hours tint. |
| `--agendfy-color-selection` | `var(--agendfy-color-accent-soft)` | Range selection and drop-target background. |
| `--agendfy-disabled-stripe` / `--agendfy-disabled-opacity` | `var(--agendfy-color-surface-2)` / `0.55` | Days outside `validRange` (striped). |
| `--agendfy-month-cell-min-height` | `120px` | Month cell height (`-compact`: `80px` at ≤ 640px). |
| `--agendfy-event-radius` | `var(--agendfy-radius-sm)` (6px) | Corner radius of every event block/chip. |
| `--agendfy-event-font-size` / `-font-weight` / `-shadow` | `xs` / `600` / `shadow-sm` | Month event chips. |
| `--agendfy-color-event-default` / `-default-fg` | `#3490dc` / `#ffffff` | Month chip without `event.color`. |
| `--agendfy-resize-handle-color` / `-hover-color` | `rgba(0,0,0,.25)` / `rgba(0,0,0,.4)` | Month resize grip. |
| `--agendfy-color-accent-fg` | `#ffffff` | Text on the accent ("Today" pill in list/agenda). |
| `--agendfy-button-radius` / `-bg` / `-fg` | `radius-md` / `surface-2` / `text-muted` | Header button groups. |
| `--agendfy-button-active-bg` / `-active-fg` | `var(--agendfy-color-accent)` / `var(--agendfy-color-event-fg)` | Active view button. |
| `--agendfy-popover-radius` / `-shadow` | `radius-md` / `shadow-lg` | "+N more" popover, filter and export menus. |
| `--ev-work`, `--ev-meeting`, `--ev-focus`, `--ev-personal`, `--ev-travel`, `--ev-free` | palette | Event category colors you can use in your own CSS. |

Dark mode: OS `prefers-color-scheme: dark` applies automatically; the `theme`
prop forces it either way via a scoped `data-theme="dark" | "light"` attribute
on the root. A compatibility layer maps the legacy v1 names (`--color-*`,
`--padding-*`, `--radius-*`, `--font-size-*`, `--baseevent-*`, …) onto these
tokens, so v1 overrides keep working (`--dayview-timeslot-height` is no longer
read — use `slotHeight`).

### Grid density: `slotHeight`

`config.slotHeight` (px, default `40`) is the single source of truth for the
week/day grid: event positions and heights, the current-time line, hour/15-min
lines, resize steps and drag snapping all follow it, and it is mirrored to
`--agendfy-slot-height` for the CSS rows.

```tsx
<Calendar config={{ slotDuration: 30, slotHeight: 24 }} />  // compact
<Calendar config={{ slotDuration: 15, slotHeight: 56 }} />  // roomy
```

### Class-name hooks and stable selectors

```tsx
<Calendar
  className="team-cal"
  eventClassNames={({ event, view }) => [`cat-${event.category}`, event.done && "is-done"]}
  dayCellClassNames={({ date, isToday, isDisabled }) => (date.getDay() === 5 ? "friday" : "")}
/>
```

- `eventClassNames({ event, view })` → `string | string[]` (falsy entries ignored), applied to every event element: week/day blocks, week all-day chips, month chips, list/agenda rows and the drag preview. `view` is the active view name.
- `dayCellClassNames({ date, view, isToday, isDisabled, isOtherMonth })` → applied to month cells (`.react-agendfy-calendar-day`), week columns (`.react-agendfy-daycolumn-container`) and the day view container.
- A callback that throws is logged and ignored (the calendar keeps rendering).

Data attributes for CSS/test targeting:

| Element | Attributes |
| --- | --- |
| Root `.agendfy` | `data-view` (active view), `data-theme` (when forced) |
| Event elements | `data-event-id` (your id; recurring occurrences use `<id>-<start ISO>`), list/agenda rows also `data-all-day` |
| Month cells, week columns, day view | `data-date="yyyy-MM-dd"`, `data-today`, `data-disabled`, month cells also `data-other-month` |
| List/agenda day headings | `data-today` |

Main element classes: `.react-agendfy-baseevent` (week/day event),
`.react-agendfy-event-item` (month chip), `.react-agendfy-weekview-all-day-event`,
`.react-agendfy-event-row` (list/agenda row), `.react-agendfy-day-heading`,
`.react-agendfy-now-line`, `.react-agendfy-business-hours`,
`.react-agendfy-grid-line--hour` / `--minor`, `.react-agendfy-header-toolbar`,
`.react-agendfy-button-active`.

### Custom event content: `eventContent`

Replaces the inner body of an event in every view (the frame — position,
color, drag and resize — stays). Return `null` to keep the default body.

```tsx
<Calendar
  eventContent={({ event, timeText, view }) => (
    <div className="my-event">
      <b>{event.title}</b>
      {view !== "month" && <small>{timeText}</small>}
    </div>
  )}
/>
```

### Recipes

**Brand color**

```css
.agendfy.brand {
  --agendfy-color-accent: #e11d48;
  --agendfy-color-accent-hover: #be123c;
  --agendfy-color-accent-soft: #ffe4e6;
  --agendfy-color-today-wash: #fff1f2;
  --agendfy-font-sans: "Inter", system-ui, sans-serif;
}
```

**Compact grid**

```tsx
<Calendar className="compact" config={{ slotDuration: 30, slotHeight: 22 }} />
```

```css
.agendfy.compact {
  --agendfy-time-gutter-width: 3rem;
  --agendfy-grid-line-minor: 0 none;   /* hide 15-minute lines */
  --agendfy-month-cell-min-height: 84px;
}
```

**Styling events by a field** (e.g. `event.category`)

```tsx
<Calendar eventClassNames={({ event }) => event.category && `cat-${event.category}`} />
```

```css
/* Week/day blocks and month chips get their color inline from event.color;
   use !important (or omit event.color) to let CSS decide. */
.agendfy .cat-urgent { box-shadow: inset 3px 0 0 var(--agendfy-color-now); font-weight: 700; }
.agendfy .cat-urgent .react-agendfy-event-row-dot { background-color: var(--agendfy-color-now); }
.agendfy .cat-cancelled { opacity: 0.5; text-decoration: line-through; }
```

## i18n message keys

Bundled catalogs: `en`, `pt` (European Portuguese), `pt-BR`, `es`, `fr`, `ar`.
Set `config.lang`; any key set directly on `config` overrides the catalog.
Templates use `{placeholder}` tokens.

| Key | English default |
| --- | --- |
| `today` | Today |
| `monthView` / `weekView` / `dayView` / `listView` / `agenda` | Month / Week / Day / List / Agenda |
| `all_day` | All Day |
| `clear_filter` | Clear Filters |
| `filter_resources` | Filter Resources |
| `calendar_export` | Export |
| `loading` | Loading events |
| `export_error` | Failed to export |
| `back` / `next` / `go_to_today` | Back / Next / Go to today |
| `unsupported_view` | Unsupported view |
| `no_events` | There are no events for this period. |
| `agenda_no_events` | There are no events for the next {days} days. |
| `untitled_event` | Event |
| `tooltip_start` / `tooltip_end` | Start / End |
| `invalid_slot_duration` | Invalid slot duration ({duration}). … |
| `hidden_events` | +{count} hidden events |
| `notification_title` | Upcoming event |
| `alert_title` | Event Alert |
| `event_starts_at` | {title} starts at {time} |
| `email_alert_subject` | Alert: {title} |
| `email_alert_body` | The event "{title}" will start at {time}. … |
| `data_source_error` | Error fetching events from {source}: {message} |

Text direction resolves automatically from the language (`ar`, `he`, `fa`,
`ur` → RTL) and can be forced with the `direction` prop.

## Accessibility

- Month/week grids expose grid semantics with a **roving tabindex**: arrow keys
  move the focused cell, `Enter`/`Space` activate.
- Events are keyboard-focusable and operable; drag and drop is available
  through the keyboard (dnd-kit `KeyboardSensor`) as well as the pointer.
- Header navigation buttons have localized accessible labels (`back`, `next`,
  `go_to_today`).
- Focus-visible styling uses `--agendfy-focus-ring`; `prefers-reduced-motion`
  disables transitions and animations.

## Notifications

Enable reminders with `config.alerts = { enabled: true, thresholdMinutes: 15 }`.
Reminders surface as toasts and browser notifications; provide an
`emailAdapter` (implementing
`sendEmail(subject: string, body: string, recipient?: string): Promise<void>`)
plus `emailConfig` (`{ defaultRecipient }`) to also send email alerts. Reminder strings are localized (`alert_title`,
`event_starts_at`, `email_alert_subject`, `email_alert_body`).

## License

MIT © Márcio Zebedeu
