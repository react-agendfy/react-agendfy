---
"@react-agendfy/core": minor
---

Shared drag context and live drop validation (RFC 001, phase 2, steps 1–2).

- One DndContext per calendar (`InteractionProvider`); views register their drag handlers instead of owning a context. Views rendered on their own keep working.
- Live validation: over a drop that `eventOverlap`, `eventConstraint`, `eventAllow` or a middleware plugin would refuse, the drag preview gets `.react-agendfy-drag-preview--invalid` and `data-invalid-reason`. New token `--agendfy-drop-invalid-color`.
- Keyboard drag fixed in every view. Arrows move by one slot, column or day, counted in units, so fast presses and scrolling no longer land a slot off. Week view events have a single tab stop (Enter opens, Space picks up). The week view drop also works without a pointer.
