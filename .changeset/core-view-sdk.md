---
"@react-agendfy/core": minor
---

Public SDK for custom views (RFC 001, phase 2, step 4):

- `useCalendarView()`: the stable API for views and plugins. It covers state, texts (`t`), zone-aware formatting, day rules, navigation, `moveEvent`/`resizeEvent`/`validate` through the change pipeline, undo/redo, and the host's click handler, `eventContent` and `eventClassNames`.
- `useEventDraggable(event)` and `useDropZone(id, { date, allDay?, resourceIds? })`: drag & drop in custom views with the built-in preview, live validation, click-vs-drag, moves between resources and external drops.
- `ViewPlugin.label` (string or `{ key }`) and `ViewPlugin.messages` (per-language texts for `t`).
- Undo/redo also restores legacy `resources` objects.
