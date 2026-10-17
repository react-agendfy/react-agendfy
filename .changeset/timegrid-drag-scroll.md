---
"@react-agendfy/core": patch
---

Week/day drag: the drop now always lands where the preview shows, even when
the grid scrolls during the drag. This covers the calendar's own scroll, a
host scroll container, page scroll and dnd-kit auto-scroll.

Before, the preview snapped the raw pointer movement while the drop was
computed separately, so with scrolling they could differ by a slot (one hour
with 60-minute slots). Snapping now works in grid coordinates, the drop
reuses the preview's snapped value, and the preview is kept inside
slotMin/slotMax and the rendered columns.
