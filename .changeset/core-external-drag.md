---
"@react-agendfy/core": minor
---

Drag in from outside the calendar (RFC 001, phase 2, step 3): `AgendfyDndProvider`, `ExternalDraggable` and the `onEventReceive` prop. Received events go through the rules (with the live preview), are reverted when the callback's Promise rejects, and land on the slot (week/day) or day (month, all-day or at `startTime`) under the pointer.
