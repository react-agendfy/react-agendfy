---
"@react-agendfy/gantt": minor
---

New package: a Gantt chart.

- `<Gantt tasks onTaskChange>` is the Gantt on its own, in project vocabulary. It has its own toolbar (navigation, period, week/month/quarter zoom), one `onTaskChange(task, moved)` per change (a rejected promise reverts all), `onTaskClick`, `workingDays`, `readOnly` and a `GanttApi` (undo/redo, navigation, zoom). Its types are all exported by the package, and `@react-agendfy/gantt/style.css` includes the core's styles: one import.
- `ganttPlugins` adds the `gantt` view and the scheduling to a `<Calendar>`, where tasks are events with task fields; `@react-agendfy/gantt/gantt.css` has only the Gantt's styles.
- Moving or resizing a task pushes its successors (FS/SS/FF/SF with lag) and resizes its summaries, in one change with one undo.
- The task table has collapsible summaries and progress rolled up from their children.
- The chart draws dependency arrows, the critical path, milestones and baselines, and has a draggable progress handle.
- Drag, resize and keyboard drag follow the calendar's rules.
- Rows and days are virtualized; texts are in six languages.
