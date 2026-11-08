---
"@react-agendfy/core": minor
---

The agenda view is now the list view over the next 7 days: one component, with the same `agenda` view name, classes and empty message. The list view shows a multi-day event that started before the period on its first day (it was missing), and is no longer virtualized. This drops the `react-window` dependency.
