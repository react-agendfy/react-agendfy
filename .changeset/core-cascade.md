---
"@react-agendfy/core": minor
---

Batch changes and undoable field edits, for the Gantt:

- `MiddlewarePlugin.cascade(change, ctx)` returns other events that must move with a change (a Gantt pushing successor tasks). They are carried in `EventChange.related`, validated with the change (one refused refuses all), applied together, passed to `onEventUpdate` each, and undone with one undo. If the host refuses any of them, all of them go back. `ChangeContext.events()` gives every event.
- `useCalendarView().updateEvent(event, fields)` changes other fields (a task's `progress`) as one undoable change. `EventChange.fields` lists them; undo/redo restore them too.
- The drag `anchor` (grab point) now also applies to all-day drop zones, in whole days.
