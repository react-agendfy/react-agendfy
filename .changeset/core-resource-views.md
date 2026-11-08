---
"@react-agendfy/core": minor
---

Resource views and the time axis (RFC 001, phase 3):

- New views `resourceDay` and `resourceWeek`: one column per resource (and day), with an all-day row, the overlap layout, drag between resources (a multi-resource event swaps only the resource it is dragged from), resize, live validation and keyboard drag. They appear in the header when there are `resources`. New options `datesAboveResources` and `resourceColumnMinWidth`, and translated labels.
- `Resource.businessHours`: a resource's own hours are shaded in its columns and enforced by `eventConstraint: "businessHours"`.
- `onSlotClick(date, { resourceId })` in the resource views. The SDK adds `onSlotClick` and `businessHoursFor(date, resource)`.
- Keyboard drag in views built on the SDK: the arrow keys move from drop zone to drop zone.
- Public building blocks: `createTimeScale` (a wall-clock time axis with daily windows, hidden days and DST) and `useVirtualRange` (windowing with no dependencies).
