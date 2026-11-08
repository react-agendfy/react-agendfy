---
"@react-agendfy/core": minor
---

Business hours you can see, and rules for your own forms:

- The time outside business hours is now shaded (token `--agendfy-non-business-bg`) in the week, day and resource views, including a day with none at all (a weekend). In the resource views each resource's own hours apply. The light tint of the business hours themselves was nearly invisible.
- `api.validate(change)` checks an event created or edited in the host's own form against `eventOverlap`, `eventConstraint`, `eventAllow` and middleware plugins, without applying it.
