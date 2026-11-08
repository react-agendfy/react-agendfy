---
"@react-agendfy/core": patch
---

`lang: "pt"` keeps Monday as the first day of the week. date-fns 4.4 changed its `pt` locale to Sunday; without this, updating date-fns moved every European Portuguese calendar.
