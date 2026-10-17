---
"@react-agendfy/core": patch
---

Week/day time grid: drag and overlap layout.

- Overlapping events now share the width per DAY (cluster columns, as in
  FullCalendar and Google Calendar). Before, columns were decided per slot,
  so an event starting in a different slot was drawn on top of its
  neighbour at full width.
- Dragging shows a DragOverlay preview above every slot that moves in whole
  slots and columns. The original stays in place as a ghost, and the drop
  lands exactly where the preview is. Before, the moving event slid
  underneath later slots and could jump on drop.
- Event blocks get padding (custom `eventContent` included), a smaller
  radius, an inset 1px separator ring and `box-sizing: border-box`. The day
  view honours the layout width (it was forced to 100%).
