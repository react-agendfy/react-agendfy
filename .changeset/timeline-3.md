---
"@react-agendfy/plugin-timeline": major
---

Rewrite on the core's public API. There are now three views (`timelineDay`, `timelineWeek`, `timelineMonth`) instead of `timeline`, and the default export is the array of all three; `createTimelinePlugins(options)` takes options. The views have:

- a time axis with a two-row header;
- the resource tree with collapsible groups, and an "Unassigned" row;
- overlapping events stacked in lanes;
- drag in time and between resources, resize, keyboard drag, external drops, the rules with the live preview, and undo;
- each resource's `businessHours` shaded;
- virtualized rows and slots;
- texts in six languages.

The stylesheet is now imported from `@react-agendfy/plugin-timeline/style.css`. Requires `@react-agendfy/core` 2.4 or later.
