# @react-agendfy/plugin-timeline

Resource timeline views for [`@react-agendfy/core`](../../core/README.md): resources down the side, time across.

- **Three views:** `timelineDay`, `timelineWeek` and `timelineMonth`. They are FullCalendar's `resourceTimelineDay/Week/Month`, and `fullcalendar-compat` maps them.
- **Rows:**
  - the resource tree, with groups you can collapse;
  - an "Unassigned" row for events without resources;
  - overlapping events stacked in lanes.
- **Interaction:**
  - drag in time and between resources (dragging one copy of an event with several resources swaps only that resource);
  - resize from the right edge;
  - keyboard drag;
  - items dropped from an `ExternalDraggable`.

  All of it goes through the calendar's rules (with the live red preview) and undo.
- **Each resource's `businessHours`:** the time outside them is shaded.
- **Virtualization:** only the rows and slots in view are rendered.
- **Languages:** texts in English, Portuguese (pt, pt-BR), Spanish, French and Arabic.

It is built only on the core's public API: `useCalendarView`, `createTimeScale`, `useVirtualRange`, `useEventDraggable` / `useDropZone`, `layoutLanes`.

## Install

```bash
npm install @react-agendfy/plugin-timeline
```

Requires `@react-agendfy/core` 2.2 or later.

## Use

```tsx
import { Calendar } from "@react-agendfy/core";
import timelinePlugins from "@react-agendfy/plugin-timeline";
import "@react-agendfy/core/core.css";
import "@react-agendfy/plugin-timeline/style.css";

<Calendar
  events={events}            // resourceId / resourceIds on each event
  resources={resources}      // children make collapsible groups
  plugins={timelinePlugins}  // timelineDay, timelineWeek, timelineMonth
  config={{ defaultView: "timelineWeek" }}
/>;
```

Use only some of the views with the named exports `timelineDay`, `timelineWeek` and `timelineMonth`. Pass options with `createTimelinePlugins(options)`:

| Option | Default | Description |
| --- | --- | --- |
| `slotMinutes` | `config.slotDuration` (day), `60` (week), a day (month) | Minutes per slot. |
| `slotWidth` | `48` (day), `40` (week), `40` (month) | Width of a slot, px. |
| `resourceAreaWidth` | `200` | Width of the resource column, px. |
| `laneHeight` | `34` | Height of one lane of events, px. |
| `showUnassigned` | `true` | Show a row for events without resources, when there are any. |

The day and week views show `config.slotMin`–`slotMax` of each day, and the week and month views skip `hiddenDays`. Clicking a slot calls `onSlotClick(date, { resourceId })`.

Style the views with the core's tokens, plus `--agendfy-timeline-max-height` (the height of the scroll area, default `70vh`). The stable class names start with `agendfy-timeline-`.

## From 2.x

Version 3 is a rewrite:

- The single `timeline` view became `timelineDay`, `timelineWeek` and `timelineMonth`. The default export is now the array of the three views.
- The stylesheet is a separate import: `@react-agendfy/plugin-timeline/style.css`.
- Events are placed by `resourceId` / `resourceIds`, and resource names come from `resources`.
