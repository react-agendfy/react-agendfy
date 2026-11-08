---
"@react-agendfy/core": minor
---

One resource model: `resourceIds` / `resourceId` on events, with names and icons resolved from the `resources` prop.

- Event resource icons, tooltips and the resource filter used to read only `event.resources` objects, while the overlap rules, resource moves and the timeline read `resourceId`/`resourceIds`. Every reader now goes through `eventResourceIds(event)` (new export). Legacy `resources` objects still work.
- Callbacks (`onEventUpdate`, `onEventResize`, `onEventReceive`, `onEventClick`) hand events back in the shape the host gave them, without the resource objects the calendar derives for display.
