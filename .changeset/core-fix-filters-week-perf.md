---
"@react-agendfy/core": patch
---

Fixes found while building RFC 001 phase 2 (all predate it):

- Events from data-source plugins (e.g. `plugin-google-calendar`) never reached the views. The plugin filter/search was an allow-list of ids taken at the last `events` sync. They now apply only while active, survive `events` updates (saving a drag no longer clears an active filter), and a filter that keeps every event is off.
- The week view looked every event up again for each of its ~200 slots and built hundreds of thousands of zoned dates per render (about 2s per drop on a busy week in development). Events are now indexed by slot once per render, about 15× faster.
- Week view events starting between slot lines (10:15 with 30-minute slots) were not shown. They now show in the slot below their start, offset to their real time, in both the week and the day view.
