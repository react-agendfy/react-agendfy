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

## Design tokens

All styling is scoped under the `.agendfy` root class (the library never
styles `:root` or `document.documentElement`). Tokens live in three layers in
`src/styles/tokens.css`:

- **L1 primitives** — `--agendfy-space-1…8`, `--agendfy-radius-sm/md/lg/xl/full`, `--agendfy-font-sans/mono`, palette primitives (`--agendfy-indigo-500`, `--agendfy-coral-500`, …).
- **L2 semantic** (override these to theme):

| Token | Purpose |
| --- | --- |
| `--agendfy-color-ground` | Page-level background behind the calendar. |
| `--agendfy-color-surface` / `-surface-2` / `-surface-hover` | Card/cell surfaces and hover state. |
| `--agendfy-color-border` / `-border-strong` | Grid and control borders. |
| `--agendfy-color-text` / `-text-muted` / `-text-faint` | Text hierarchy. |
| `--agendfy-color-accent` / `-accent-hover` / `-accent-soft` | Primary accent (buttons, active view, selection). |
| `--agendfy-color-now` | Current-time indicator / destructive accents. |
| `--agendfy-color-today-wash` | "Today" cell background. |
| `--agendfy-color-event-fg` | Text color on colored event chips. |
| `--agendfy-focus-ring` | Focus-visible ring. |
| `--agendfy-shadow-sm/md/lg` | Elevation. |
| `--agendfy-transition-duration/-timing` | Motion. |

- **L3 component/event** — event category colors `--ev-work`, `--ev-meeting`, `--ev-focus`, `--ev-personal`, `--ev-travel`, `--ev-free`.

Dark mode: OS `prefers-color-scheme: dark` applies automatically; the `theme`
prop forces it either way via a scoped `data-theme="dark" | "light"` attribute
on the calendar root. A compatibility layer maps the legacy v1 variable names
(`--color-*`, `--padding-*`, `--margin-*`, `--radius-*`, `--shadow-*`, …) onto
the new tokens, so v1 overrides keep working.

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
