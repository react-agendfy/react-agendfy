# react-agendfy

A modern, accessible, plugin-driven calendar and scheduling library for React.

`react-agendfy` renders month, week, day, list and agenda views with drag-and-drop
event management, recurrence, first-class timezone handling, built-in
internationalization (including RTL), WCAG 2.1 AA accessibility, a themeable
design-token system with dark mode, and an optional bring-your-own-LLM AI layer
for natural-language scheduling.

## Features

- **5 built-in views** — month, week, day, list and agenda, plus custom views via plugins.
- **Drag & drop and resize** — pointer *and* keyboard operable (dnd-kit sensors), with correct multi-day and cross-day behavior.
- **Recurring events** — RRULE strings (via [rrule](https://github.com/jkbrzt/rrule)) on the `recurrence` event field.
- **Timezones** — wall-clock-correct rendering in any IANA timezone via `@date-fns/tz`.
- **i18n** — bundled catalogs for `en`, `pt` (European Portuguese), `pt-BR`, `es`, `fr`, `ar`; every string overridable per-key through `config`.
- **RTL** — automatic for RTL languages (`ar`, `he`, `fa`, `ur`), or forced with the `direction` prop.
- **Accessibility** — WCAG 2.1 AA: grid semantics, roving-tabindex arrow-key navigation, keyboard-operable events, visible focus rings, reduced-motion support.
- **Theming** — a 3-layer CSS design-token system scoped under `.agendfy`, OS-aware dark mode, and a `theme` prop to force light/dark per instance.
- **Plugin architecture** — views, header controls, filters, search, data sources, export formats, event rendering, interactions and themes.
- **AI layer (optional)** — provider-agnostic natural-language event parsing, smart scheduling and calendar insights in [`@react-agendfy/ai`](packages/ai/README.md).

## Packages

| Package | Description |
| --- | --- |
| [`@react-agendfy/core`](packages/core/README.md) | The calendar component, hooks, types and plugin contracts. |
| [`@react-agendfy/ai`](packages/ai/README.md) | Bring-your-own-LLM AI layer: NL event parsing, smart scheduling, insights, hooks, Quick Add plugin. |
| `@react-agendfy/plugin-filter` | Header resource-filter dropdown. |
| `@react-agendfy/plugin-timeline` | Timeline custom view (`viewName: "timeline"`). |
| `@react-agendfy/plugin-theme` | Dark theme plugin (`themeName: "dark"`, scoped CSS variables). |
| `@react-agendfy/plugin-export-pdf` | PDF export plugin (`formatName: "pdf"`, jsPDF-based). |
| `@react-agendfy/plugin-export-reports` | CSV, JSON and ICS export plugins (exported as an array). |
| `@react-agendfy/plugin-google-calendar` | Data-source plugin that fetches events from the Google Calendar API. |

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
  {
    id: "2",
    title: "Design Review",
    start: "2026-08-04T14:00:00.000Z",
    end: "2026-08-04T15:30:00.000Z",
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

Notes:

- `Calendar` is a **named export** (there is no default export). It forwards a
  ref to the calendar's root `HTMLDivElement`.
- The stylesheet ships at the `@react-agendfy/core/core.css` export path.
- `config` is a `Partial<Config>` — pass only what you want to change;
  everything else falls back to the built-in defaults (see
  [Config defaults](packages/core/README.md#config-defaults)).
- Event `start`/`end` accept ISO 8601 strings or `Date` objects.

## Theming

All styles are scoped under the `.agendfy` root class and driven by a 3-layer
CSS custom-property system (`--agendfy-*`): primitives (spacing, radii,
palette), semantic tokens (surface, text, accent, borders) and component/event
tokens. Override any token on the calendar root to restyle it:

```css
.agendfy {
  --agendfy-color-accent: #0e9f9f;
  --agendfy-radius-md: 4px;
}
```

Dark mode:

- **OS-aware by default** — the calendar follows `prefers-color-scheme` automatically.
- **Forced per instance** — `<Calendar theme="dark" />` or `theme="light"` sets a
  scoped `data-theme` attribute on the calendar root. The library never touches
  `document.documentElement` or leaks styles into the host app.
- **Theme plugins** — a `ThemePlugin` whose `themeName` matches the `theme` prop
  has its `cssVariables` applied to the calendar root only.

See the [token reference](packages/core/README.md#design-tokens) for the full list.

## Accessibility

The calendar targets WCAG 2.1 AA:

- Month/week grids use proper grid semantics with a roving tabindex — arrow
  keys move between cells, `Enter`/`Space` activate.
- Events are keyboard-focusable and operable; drag and drop works through the
  keyboard (dnd-kit `KeyboardSensor`) as well as the pointer.
- Navigation buttons carry accessible labels (localized via i18n keys
  `back`, `next`, `go_to_today`).
- Visible focus rings via `--agendfy-focus-ring`; `prefers-reduced-motion`
  disables animations.

## Internationalization and RTL

Set `config.lang` to a BCP-47 tag. Bundled catalogs: `en`, `pt` (European
Portuguese), `pt-BR`, `es`, `fr`, `ar` — lookup is case- and
separator-insensitive (`pt-BR`, `pt_BR` and `ptBR` all resolve to the Brazilian
catalog), with fallback to the base language and then English.

```tsx
<Calendar events={events} config={{ lang: "pt-BR" }} />
```

Any message key set directly on `config` overrides the catalog:

```tsx
<Calendar events={events} config={{ lang: "es", today: "Hoy mismo" }} />
```

Text direction is automatic: `ar`, `he`, `fa` and `ur` render right-to-left.
Force it with the `direction` prop (`"ltr" | "rtl" | "auto"`, default `"auto"`).
The full key list is in the [i18n reference](packages/core/README.md#i18n-message-keys).

## AI layer

[`@react-agendfy/ai`](packages/ai/README.md) adds natural-language features on
top of any LLM you bring — or none at all:

```tsx
import { createQuickAddPlugin } from "@react-agendfy/ai";

const quickAdd = createQuickAddPlugin({
  onEventCreate: (event) => setEvents((prev) => [...prev, event]),
});

<Calendar events={events} plugins={[quickAdd]} />;
```

With no adapter configured, a deterministic local parser handles input offline
(English and Portuguese). Point it at your backend LLM proxy for full-quality
parsing, conflict detection, free-slot search and calendar summaries. See the
[AI package README](packages/ai/README.md) — including why API keys must never
ship to the browser.

## Plugin system

Everything beyond the core views is a plugin. A plugin is a plain object passed
to the `plugins` prop with a `key`, a `type` and type-specific fields:

| Type | Purpose |
| --- | --- |
| `view` | Register a custom view (appears in the view switcher). |
| `filter` / `search` | Header controls (left/right placement) that filter or search events. |
| `data-source` | Fetch events from an external source for the visible range. |
| `export` | Add an export format to the header's export menu. |
| `event-rendering` | Custom event renderers. |
| `interaction` | View-specific interaction layers (e.g. drag and drop). |
| `theme` | Named themes applying scoped CSS variables. |

```tsx
import resourceFilterPlugin from "@react-agendfy/plugin-filter";
import darkThemePlugin from "@react-agendfy/plugin-theme";
import exportPlugins from "@react-agendfy/plugin-export-reports";

<Calendar
  events={events}
  resources={resources}
  plugins={[resourceFilterPlugin, darkThemePlugin, ...exportPlugins]}
/>;
```

See the [plugin authoring guide](packages/core/README.md#writing-a-plugin) for
the full contracts.

## Migrating from v1

v2 is a modernization release with a small number of breaking changes (named
export, CSS namespace fix, scoped theming, new token names, locale mapping).
See [MIGRATION.md](MIGRATION.md) for before/after code and the list of behavior
fixes.

## Repository layout

```
packages/core        @react-agendfy/core
packages/ai          @react-agendfy/ai
packages/plugins/*   Official plugins
examples/basic       Working example app (Vite)
```

## Contributing

Issues and pull requests are welcome at
[github.com/react-agendfy/react-agendfy](https://github.com/react-agendfy/react-agendfy).
Run `yarn install`, then `yarn test` / `yarn lint` inside the package you are
changing. The example app in `examples/basic` is the fastest way to try changes
end to end.

## License

MIT © Márcio Zebedeu
