# @react-agendfy/gantt

A Gantt chart for React: a task table on the left, bars on a time axis on the right.

- **Auto-scheduling.** Moving or resizing a task pushes its successors (and grows its summaries) in one change with one undo. If your save fails, all of them go back.
- **Dependencies:** finish-to-start, start-to-start, finish-to-finish and start-to-finish, with a lag. They are drawn as arrows.
- **The critical path** is highlighted.
- **Task types:**
  - tasks, with a progress fill you can drag;
  - milestones (diamonds);
  - summaries that span their children, with collapsible rows and progress rolled up from the children.
- **Baselines:** the planned dates are drawn under the bar.
- **Interaction:** drag (the grabbed day stays under the pointer), resize from the right edge, keyboard drag, undo/redo (Ctrl/⌘+Z), and rules with a live red preview.
- **Zoom:** week, month or quarter.
- **Virtualization:** only the rows and days in view are rendered.
- **Languages:** texts in English, Portuguese (pt, pt-BR), Spanish, French and Arabic.

There are two ways to use it:

| You want | Use | You work with |
| --- | --- | --- |
| A Gantt chart | [`<Gantt>`](#the-gantt-on-its-own-gantt) | tasks |
| A calendar that also shows projects | [`ganttPlugins` in a `<Calendar>`](#in-a-calendar-ganttplugins) | events with task fields |

Both run on [`@react-agendfy/core`](../core/README.md)'s engine (drag, rules, undo, time zones). The Gantt is built only on the core's public API.

## Install

```bash
npm install @react-agendfy/gantt @react-agendfy/core
```

## The Gantt on its own: `<Gantt>`

```tsx
import { Gantt, type Task } from "@react-agendfy/gantt";
import "@react-agendfy/gantt/style.css"; // the core's styles are included

const tasks: Task[] = [
  { id: "launch", title: "Website launch", type: "summary", start: "2026-03-02", end: "2026-03-28" },
  { id: "design", title: "Design", parentId: "launch", start: "2026-03-02", end: "2026-03-07", progress: 60 },
  { id: "build", title: "Build", parentId: "launch", start: "2026-03-09", end: "2026-03-21", dependencies: ["design"] },
  {
    id: "live", title: "Go live", type: "milestone", parentId: "launch", start: "2026-03-23", end: "2026-03-23",
    dependencies: [{ id: "build", type: "FS", lag: 24 * 60 }], // one day after Build ends
  },
];

function Project() {
  const [items, setItems] = useState(tasks);
  return (
    <Gantt
      tasks={items}
      defaultZoom="month"
      onTaskChange={(task, moved) => {
        // The task, and the tasks it pushed: save them together.
        const changed = new Map([task, ...moved].map((t) => [t.id, t]));
        setItems((prev) => prev.map((t) => changed.get(t.id) ?? t));
        return api.saveTasks([task, ...moved]); // a rejected promise reverts all of them
      }}
      onTaskClick={(task) => openTask(task.id)}
    />
  );
}
```

It has its own toolbar: previous / today / next, the period, and the zoom. Everything you need is imported from `@react-agendfy/gantt`. `@react-agendfy/core` must be installed, but you don't import from it.

| Prop | Description |
| --- | --- |
| `tasks` | The tasks (see [Task fields](#task-fields)). |
| `onTaskChange(task, moved)` | A task was moved, resized or its progress changed. `moved` holds the tasks it pushed. You get one call per change, and undo/redo produce calls too. Return a rejected promise to revert all of them. |
| `onTaskClick(task)` | A bar was clicked (or Enter on a focused bar). |
| `onDateClick(date)` | An empty day was clicked. |
| `onChangeRejected(info)` | A change was refused: `{ task, moved, reason, message? }` (a `GanttChangeRejectedInfo`). |
| `zoom`, `onZoomChange` | Controlled zoom: `"week"`, `"month"` or `"quarter"`. |
| `defaultZoom` | Uncontrolled zoom. Default `"month"`. |
| `date` | The date shown first. Default today. |
| `readOnly` | No drag, resize or progress changes. |
| `workingDays` | Working days, `0` = Sunday … `6` = Saturday. The others are shaded. Default `[1, 2, 3, 4, 5]`. |
| `timeZone`, `lang`, `direction`, `theme`, `className` | Time zone (IANA), language, `"ltr"`, `"rtl"` or `"auto"`, theme name, extra class. |
| `columns`, `dayWidth`, `rowHeight`, `criticalPath` | See [Options](#options). |
| `apiRef` | A `GanttApi`: `undo()`, `redo()`, `canUndo()`, `canRedo()`, `today()`, `prev()`, `next()`, `gotoDate(date)`, `getDate()`, `getZoom()`, `setZoom(zoom)`. |

Tasks are whole days: `end` is the day after the last one, so a one-day task on 2 March has `start: "2026-03-02"` and `end: "2026-03-03"`. A milestone has `start` equal to `end`. Set `allDay: false` on a task to schedule it by the hour.

## In a calendar: `ganttPlugins`

For apps that are a calendar first, a task is an event with task fields. The calendar's rules, undo, data sources and resources apply to tasks, and the same tasks can show in the other views:

```tsx
import { Calendar } from "@react-agendfy/core";
import ganttPlugins from "@react-agendfy/gantt";
import "@react-agendfy/core/core.css";
import "@react-agendfy/gantt/gantt.css"; // only the Gantt's styles: the core's are already imported

<Calendar
  events={[...events, ...tasks.map((t) => ({ ...t, allDay: true }))]}
  plugins={ganttPlugins}        // the gantt view + the scheduling
  config={{ headerViews: ["month", "week", "day", "gantt"] }}
  onEventUpdate={save}          // called for the task and for each task it pushed
/>;
```

The `gantt` view shows only the events that are tasks (see `isTask`). Other events are never pushed. Clicking an empty day calls `onSlotClick(date)`, and clicking a bar calls `onEventClick(task)`.

### Scheduling

`ganttScheduling` (included in `ganttPlugins`) is a middleware plugin. When a task moves or changes length:

- a summary carries its descendants with it;
- each successor that would now start too early moves later, keeping its length (successors are never pulled earlier);
- summaries grow or shrink to span their children.

It works in every view, not just the Gantt. With a dependency cycle, nothing is pushed. The calendar's rules also check the pushed tasks: if one breaks a rule, the whole move is refused. Undo restores all of them.

## Task fields

| Field | Description |
| --- | --- |
| `id`, `title`, `start`, `end` | As for events. |
| `type` | `"task"` (default), `"milestone"` (a point in time: `start` = `end`) or `"summary"` (spans its children). |
| `progress` | Done, 0–100. You can change it by dragging the handle at the bottom of a bar. |
| `parentId` | The summary this task belongs to. |
| `dependencies` | Predecessors: ids (finish-to-start) or `{ id, type?: "FS" \| "SS" \| "FF" \| "SF", lag?: minutes }`. |
| `baselineStart`, `baselineEnd` | The planned dates, drawn under the bar. |
| `color` | The bar's color. |

The scheduling functions are exported for your own code: `cascadeChange(tasks, changed)`, `criticalPath(tasks)`, `rollupProgress(tasks)`, `buildGraph(tasks)`.

## Options

Props of `<Gantt>`, or options of `createGanttPlugins(options)` (or `createGanttView` and `createGanttScheduling` separately):

| Option | Default | Description |
| --- | --- | --- |
| `zoom` | `"month"` | `createGanttPlugins` only: the days shown, `"week"`, `"month"` or `"quarter"`. |
| `dayWidth` | `120` (week), `40` (month), `14` (quarter) | Width of a day, px. |
| `columns` | all | Table columns, in order: `"task"`, `"start"`, `"end"`, `"duration"`, `"progress"`. |
| `rowHeight` | `36` | Height of a row, px. |
| `criticalPath` | `true` | Highlight the critical path. |
| `taskFilter` | `isTask` | `createGanttPlugins` only: which events are tasks. |

Stylesheets:

- `@react-agendfy/gantt/style.css`: the core's styles and the Gantt's, for `<Gantt>`. It starts with `@import "@react-agendfy/core/core.css"`, which your bundler (Vite, webpack, Next.js…) resolves to the installed core.
- `@react-agendfy/gantt/gantt.css`: only the Gantt's, for a `<Calendar>` that already imports `core.css`.

Style the Gantt with the core's tokens, plus these:

- `--agendfy-gantt-max-height`: the height of the scroll area, default `70vh`;
- `--agendfy-gantt-critical`;
- `--agendfy-gantt-link`;
- `--agendfy-gantt-summary`.

The stable class names start with `agendfy-gantt-`.
