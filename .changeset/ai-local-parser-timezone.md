---
"@react-agendfy/ai": patch
---

The offline parser (no adapter, or an adapter failure) now applies `timeZone`: "lunch tomorrow at 1pm" is 1pm in that zone, and "today"/"tomorrow" follow the zone's calendar day. Without `timeZone` it still reads times as UTC wall-clock.
