# Migrating from v1 to v2

v2 is a modernization release: typed public API, fixed CSS namespace, scoped
theming, a real design-token system, bundled i18n, RTL, accessibility and an
optional AI layer. Most apps need only a handful of mechanical changes.

## Breaking changes

### 1. `Calendar` is a named export — there is no default export

The v1 documentation showed a default import (and a `CalendarEvent` type that
never existed in the published types). v2 exposes exactly one component
export, named `Calendar`, and the event type is `EventProps`.

```tsx
// v1 (as documented)
import Calendar, { CalendarEvent } from "@react-agendfy/core";

// v2
import { Calendar, EventProps } from "@react-agendfy/core";
```

### 2. CSS import path

The deep `dist/` path is no longer reachable — the package `exports` map
exposes the stylesheet at `./core.css`:

```ts
// v1
import "@react-agendfy/core/dist/index.css";

// v2
import "@react-agendfy/core/core.css";
```

### 3. `CalendarProps` is fully typed — no arbitrary props

v1 tolerated unknown props on `<Calendar>`. v2 type-checks against
`CalendarProps` (`events`, `resources`, `plugins`, `config`, `direction`,
`theme`, `filteredResources`, `emailAdapter`, `emailConfig`, and the
`onEventUpdate` / `onEventResize` / `onEventClick` / `onDayClick` /
`onSlotClick` / `onDateRangeSelect` callbacks). Anything else is a compile
error — move custom data onto events (extra event fields are preserved) or
into plugin `props`.

### 4. `Config.defaultView` union widened

v1 typed `defaultView` as `"month" | "week" | "day"` even though list/agenda
existed at runtime. v2 uses the `CalendarView` union:

```ts
// v2
type CalendarView = "month" | "week" | "day" | "list" | "agenda";
```

If you stored the view in state typed as the old union, widen it. `config` is
now `Partial<Config>` — you no longer need to spread every default key.

### 5. CSS class namespace: `react-agenfy-*` → `react-agendfy-*`

v1 class names carried a typo (`react-agenfy`, missing the second "d"). v2
renames every class to the correct `react-agendfy-*` namespace. **Any custom
CSS targeting the old selectors must be updated:**

```css
/* v1 */
.react-agenfy-baseevent { border-radius: 0; }

/* v2 */
.react-agendfy-baseevent { border-radius: 0; }
```

### 6. `fc-*` classes removed from core

v1's header buttons, export menu and filter dropdown used FullCalendar-style
`fc-*` class names (`fc-button`, `fc-button-primary`, `fc-export-menu`,
`fc-filter-container`, …). Core now uses the `react-agendfy-*` namespace for
these too (e.g. `fc-button` → `react-agendfy-button`,
`fc-button-primary` → `react-agendfy-button-primary`). Update selectors
accordingly.

### 7. Theming is scoped — `document.documentElement` is no longer mutated

v1 applied theme CSS variables and attributes to `document.documentElement`,
leaking styles into the host page and breaking multi-instance use. In v2:

- All styles are scoped under the `.agendfy` root class.
- `theme="dark"` / `theme="light"` set a `data-theme` attribute **on the
  calendar root element only**.
- A matching theme plugin's `cssVariables` are applied to the calendar root
  only, and cleaned up on theme change.
- OS dark mode (`prefers-color-scheme`) is respected by default; `theme`
  forces it either way.

If your app relied on the calendar setting `data-theme` (or CSS variables) on
`<html>`, own that at the app level now.

### 8. Design tokens renamed to the 3-layer `--agendfy-*` system

Tokens now live in `packages/core/src/styles/tokens.css`, scoped under
`.agendfy`: L1 primitives (`--agendfy-space-*`, `--agendfy-radius-*`,
palette), L2 semantic (`--agendfy-color-surface`, `--agendfy-color-text`,
`--agendfy-color-accent`, …) and L3 event-category tokens (`--ev-work`, …).

**A compatibility layer keeps the legacy v1 names working** — the old
`--color-*`, `--padding-*`, `--margin-*`, `--radius-*`, `--shadow-*`,
`--font-size-*` variables are mapped onto the new tokens inside `.agendfy`
(verified in `tokens.css`). Existing overrides keep functioning, but they are
deprecated; migrate to the `--agendfy-*` names:

```css
/* v1 (still works via the compat layer) */
.agendfy { --color-bg-white: #fafafa; }

/* v2 (preferred) */
.agendfy { --agendfy-color-surface: #fafafa; }
```

### 9. i18n is now built in — and `pt` means European Portuguese

v2 bundles full message catalogs (`en`, `pt`, `pt-BR`, `es`, `fr`, `ar`)
selected by `config.lang`; explicit keys on `config` still override, so v1
per-key configs keep working.

**Locale mapping change:** in v1, `lang: "pt"` resolved to the Brazilian
Portuguese date-fns locale. In v2, `pt` correctly maps to European Portuguese;
Brazilian users must be explicit:

```tsx
// v1
<Calendar config={{ lang: "pt" }} />          // silently got pt-BR

// v2
<Calendar config={{ lang: "pt-BR" }} />       // Brazilian Portuguese
<Calendar config={{ lang: "pt" }} />          // European Portuguese
```

(`pt-BR`, `pt_BR` and `ptBR` are all accepted.)

### 10. New: `direction` prop and RTL

Text direction is derived from the language automatically (`ar`, `he`, `fa`,
`ur` → RTL) and can be forced with the new `direction` prop
(`"ltr" | "rtl" | "auto"`, default `"auto"`). No action needed unless you
hacked RTL in externally.

### 11. `ref` now reaches the DOM

In v1, `<Calendar ref={...} />` never attached — the ref was forwarded into a
plain function component and dropped. In v2 the chain forwards all the way to
the calendar's root `<div>`, so `calendarRef.current` is an `HTMLDivElement`.
If you had workarounds (wrapper divs just to get a DOM node), you can remove
them.

## Behavior fixes (why things act differently)

These were bugs in v1; v2 fixes them. Listed so you can tell intentional
changes from regressions:

- **Export no longer crashes.** v1's export path called undefined helpers and
  threw; v2 routes through `downloadBlob` and shows a toast/warning when no
  export plugin matches the requested format.
- **Horizontal drag works in month view.** Dragging an event to another day in
  the same row was misclassified as a click (only the vertical axis was
  checked); both axes are now considered.
- **Events off the slot grid no longer vanish.** Week-view slot membership is
  computed by containment instead of exact timestamp string equality, so
  events starting off a slot boundary (e.g. 10:07 with 15-minute slots)
  render.
- **Multi-day duration preserved on month drag.** Dragging a multi-day event
  keeps its exact duration in milliseconds (v1 rounded to whole days).
- **Resize is symmetric and off-by-one free.** Week-view resize no longer
  gains/loses a slot; timezone is passed through `ensureDate`, recurrence
  expansion gets a correct `dtstart`, and a TZDate wall-clock drift was fixed.
- **Data-source plugins actually work.** v1 fetched events from `data-source`
  plugins and discarded them; v2 merges them into the event pipeline (your own
  events win on id collisions), with `loading` and `data_source_error`
  messages surfaced.

## Quick checklist

1. Switch to `import { Calendar } from "@react-agendfy/core"`.
2. Switch the stylesheet to `@react-agendfy/core/core.css`.
3. Fix any custom CSS: `react-agenfy-*` → `react-agendfy-*`, `fc-*` → `react-agendfy-*`.
4. If you force a theme app-wide, pass `theme` to each calendar (or set tokens on `.agendfy`); stop relying on `<html data-theme>`.
5. If you serve Brazilian Portuguese, set `lang: "pt-BR"`.
6. Re-typecheck: remove unknown props from `<Calendar>`, update `defaultView` typings.
7. Optionally migrate CSS variable overrides to the `--agendfy-*` tokens.
