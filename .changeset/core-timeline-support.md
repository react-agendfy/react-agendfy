---
"@react-agendfy/core": minor
---

For timeline-style views:

- `useEventDraggable(event, { anchor })` keeps the grab point on a pointer drop: long bars no longer jump, and day slots keep the time of day. The resource views use it.
- `layoutLanes(events, span?)` stacks events in lanes.
- Also exported: `complementRanges`, `getContrastText`, `clockToMinutes`, `getHiddenDays`.
