---
"@react-agendfy/core": minor
---

Change pipeline (RFC 001, phase 1): every move/resize is validated, applied, passed to the callback and recorded.

- Business rules: `eventOverlap`, `eventConstraint`, `eventAllow`, `selectAllow`, per-event `overlap`/`constraint`, and the `onChangeRejected` prop.
- Undo/redo: `api.undo()`, `api.redo()`, `api.canUndo()`, `api.canRedo()`, Ctrl/⌘+Z shortcuts, `historyLimit`, `undoShortcuts`.
- `middleware` plugins (`validate`, `onCommit`, `onRevert`).
- `ViewPlugin.range` / `ViewPlugin.step`: custom views get their own visible range (recurrence expansion, data sources, `onDatesSet`, `getView()`, prev/next) and a `range` prop.
- New exports: `validateChange`, `findOverlapConflicts`, `satisfiesConstraint` and the related types.
