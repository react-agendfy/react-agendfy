# RFC 001 — Change pipeline, plugin SDK and time axis

- **Status:** accepted; phase 1 (core 2.2) implemented on `feat/core-change-pipeline`; phase 2 steps 1–3 on `feat/core-plugin-sdk`
- **Date:** 2026-11-08
- **Affects:** `@react-agendfy/core`, `@react-agendfy/plugin-timeline`, `@react-agendfy/fullcalendar-compat`, future `@react-agendfy/gantt`

## Motivation

The features that make a calendar "premium" (resource views, a real resource
timeline, a Gantt chart, business rules, undo/redo, AI that reacts to what the
user drags) all need the same foundations, and the core does not expose them
today:

1. **Custom views have no range of their own.** `getVisibleRange`,
   `getViewPeriod` and `getExpansionWindow` (`Utils/calendarRange.ts`) only
   know the built-in views. A 3-month timeline gets recurrences expanded for
   the current month ± 1 week, data sources fetch the wrong window,
   `onDatesSet` / `getView()` report the wrong range and prev/next steps by a
   week.
2. **Every view owns its `DndContext`** (month, week, day). Nothing can be
   dragged in from outside the calendar, and custom views cannot share the
   drag engine.
3. **All writes go through `applyWithRevert`** (optimistic update, revert on a
   rejected promise) with no extension point: no validation, no history, no
   hooks for plugins.
4. **`CalendarContext` is private** and custom views receive 10 loose props.
   They cannot reach i18n, formatting, `eventContent`, `eventClassNames`, the
   drag engine or the day rules — which is why `plugin-timeline` has no time
   axis, no drag and hard-coded strings.

## Design

Four layers, bottom-up. Everything below the plugins lives in the core and is
exported from the main entry (tree-shakeable).

```
┌───────────────────────────────────────────────────────────────┐
│ @react-agendfy/gantt     @react-agendfy/plugin-timeline (v3)  │  plugins
├───────────────────────────────────────────────────────────────┤
│ TimeScale · <TimeHeader> · layoutLanes · useVirtualRows       │  time axis
├───────────────────────────────────────────────────────────────┤
│ useCalendarView() · ViewPlugin v2 · useEventDrag/useDropZone  │  public SDK
├───────────────────────────────────────────────────────────────┤
│ Change pipeline: validate → apply → callback → history        │  engine
└───────────────────────────────────────────────────────────────┘
```

### Layer 1 — change pipeline (core 2.2)

Every mutation becomes an `EventChange` and goes through one function,
`commitChange(change)`:

```ts
type EventChange = {
  kind: "move" | "resize";
  event: EventProps;   // the event as the view produced it (new times)
  before: EventProps;  // the event before the change
  source: "user" | "history";  // "remote" arrives with collaboration
};

type ChangeVerdict = true | { ok: false; reason: string; message?: string };
```

1. **Validate** — built-in rules, then `middleware` plugins:
   - `eventAllow(change) => boolean`
   - `eventOverlap: boolean | (still, moving) => boolean` (per-event `overlap`
     wins); events on disjoint resources never overlap
   - `eventConstraint: "businessHours" | { start?, end? } | intervals[]`
     (per-event `constraint` wins)
   - `MiddlewarePlugin.validate(change, ctx)`

   A rejection calls `onChangeRejected({ change, reason, message })` and
   nothing is applied. Validation is synchronous so the same function can run
   on every pointer move once the drag engine is shared (layer 2) — that is
   what will paint the drag preview red.
2. **Apply** optimistically.
3. **Callback** (`onEventUpdate` / `onEventResize`); a rejected promise reverts.
4. **History** — accepted changes are pushed to an undo stack:
   `api.undo()`, `api.redo()`, `api.canUndo()`, `api.canRedo()`, and
   Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y inside the calendar. Undo commits the
   reverse change (`source: "history"`) through the same callback, so the
   host persists it like any other edit. History changes skip validation:
   they restore a state that was already accepted.
5. **Middleware hooks** — `onCommit(change)` / `onRevert(change)` let plugins
   observe accepted and reverted changes (sync, analytics, AI).

This one layer unlocks business rules, undo/redo, collaboration (a future
`source: "remote"` that is not recorded) and AI (listen for
`reason: "overlap"` rejections and propose free slots).

Also in 2.2: **`ViewPlugin.range` / `ViewPlugin.step`**, so custom views
report their own visible range (used for recurrence expansion, data-source
fetches, `onDatesSet`, `getView()` and prev/next), and `selectAllow`.

### Layer 2 — public SDK (core 2.3)

```ts
interface ViewPluginV2 {
  type: "view"; apiVersion: 2; viewName: string;
  label: string | { key: string };
  range(date: Date, ctx: RangeContext): { start: Date; end: Date }; // end exclusive
  step?: { unit: "day" | "week" | "month"; amount: number }
       | ((date: Date, dir: 1 | -1, ctx: RangeContext) => Date);
  messages?: Partial<Record<string, Record<string, string>>>;
  component: FC;
}

const {
  date, range, events, resources, timeZone, direction,
  t, formatDate, formatTime,
  commit, validate, select, navigate, undo, redo,
  renderEventContent, eventClassName,
  dayRules, businessHours,
} = useCalendarView();
```

`CalendarContext` stays private; `useCalendarView` is the stable surface.
v1 view plugins keep receiving today's props.

Interaction: the `DndContext` moves to a single `InteractionProvider` at the
calendar root. Views register drop zones that map a pointer to a time (and
resources):

```ts
const drag = useEventDrag(event);                   // pointer + keyboard
useDropZone(ref, { resolve: (pt) => ({ start, resourceIds }) | null });
<ExternalDraggable data={item}>…</ExternalDraggable> // → kind: "receive"
```

`createGridDragSnap` becomes axis-generic (`axis: "x" | "y"`).

**Step 3 done:** `AgendfyDndProvider` (the `InteractionProvider`, which
passes through when nested), `ExternalDraggable` and `onEventReceive`; the
change kind `"receive"` (added on accept, removed on a rejected Promise,
not in history). External items resolve by the pointer
(`externalByPointer`): their rectangle is a list row, not an event.

**Status (core 2.3, steps 1–2 done):** the shared `InteractionProvider`
and live validation are in. Lessons that shaped the implementation:

- dnd-kit reports a new droppable in `onDragOver`; `onDragMove` still carries
  the previous one. Views validate on both.
- Keyboard drags are counted in units (one arrow = one slot/column/day,
  `gridSnap.step`), not pixels: the keyboard sensor scrolls the container
  instead of moving past its middle, and its pixel coordinates then lost or
  doubled steps depending on key speed.
- The week view event wrapper is the only focus target (Enter opens, Space
  picks up); the inner `BaseEvent` takes `focusable={false}`.

**Risk:** this touches drag. `WeekView.drag.test`, the scroll-aware snap and
the delta-based click detection (DayView: `delta.y` only, by design) must stay
green.

### Layer 3 — time axis (core 2.4)

Week/day are a vertical time axis; timeline and Gantt are the same axis laid
out horizontally:

```ts
interface TimeScale {
  start: Date; end: Date; orientation: "x" | "y";
  toPx(d: Date): number; toDate(px: number): Date; snap(d: Date): Date;
  ticks(level: "major" | "minor"): { date: Date; px: number; label: string }[];
  totalPx: number;
}
createTimeScale({ range, zoom: "hour"|"day"|"week"|"month"|"quarter"|"year",
                  timeZone, slotMin, slotMax, hiddenDays, unitPx });
```

- **Non-linear**: hiding nights (`slotMin`/`slotMax`) and weekends maps time
  in segments. DST tests must be exhaustive.
- Components: `<TimeHeader>` (two tick rows), `<TimeGridLines>`, `<NowLine>`,
  `<BusinessHoursShading>`.
- `layoutLanes(events, scale)` → `{ offset, length, lane }` (horizontal
  counterpart of `computeDayLayout`).
- `useVirtualRows({ rows, estimateHeight, overscan })` + `flattenTree` for
  collapsible resource groups. Proposed dependency: `@tanstack/react-virtual`
  (headless, ~5 KB) because row heights vary with lane stacking. **Open.**
- Vertical resource view (week/day with one column per resource) ships in the
  core on top of the same drop zones (`resolve` returns `resourceIds`).

### Layer 4 — plugins

- **plugin-timeline 3.0** — rewrite on the time axis: horizontal scale, rows
  = resources, virtualization, drag between resources through `commit`.
- **@react-agendfy/gantt 0.x** — separate package (different data model,
  different audience, keeps the core lean). Adds `Task extends EventProps`
  (`progress`, `parentId`, `type: task|milestone|summary`, `baseline`),
  `links` (FS/SS/FF/SF), an SVG dependency layer, a scheduling engine
  (forward/backward pass, critical path — pure and unit-testable) and a
  column grid. Ships as a `ViewPlugin` and as a standalone `<Gantt>`.

## Phasing

| Release | Scope | Risk |
|---|---|---|
| core 2.2 | Change pipeline, `eventAllow`/`eventOverlap`/`eventConstraint`/`selectAllow`, middleware plugins, undo/redo, `ViewPlugin.range`/`step` | Low — internal refactor |
| core 2.3 | `useCalendarView`, ViewPlugin v2, root `InteractionProvider`, external drag-in, red drag preview | Medium — drag |
| core 2.4 | `TimeScale`, virtualization, vertical resource view | Medium |
| timeline 3.0 | Rewrite on the time axis | Isolated |
| gantt 0.x | New package | Isolated |

## Compatibility

- No breaking change in the core until a v3. v1 view plugins keep working.
- `fullcalendar-compat` follows the [compat boundary](../../CONTRIBUTING.md#compat-boundary-react-agendfyfullcalendar-compat):
  no phase changes the core to suit it. `eventAllow`, `eventOverlap`,
  `eventConstraint`, `selectAllow` and `selectOverlap` are mapped (phase 1).
  `eventReceive` and `resourceTimeline` follow when their core features land.
  Undo/redo and middleware plugins stay native-only.
- `fullcalendar-compat/src/__typecheck__/calendarPro.tsx` must keep compiling
  in every phase.
