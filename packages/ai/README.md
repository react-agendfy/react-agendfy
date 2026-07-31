# @react-agendfy/ai

Bring-your-own-LLM AI layer for [react-agendfy](../../README.md):
natural-language event parsing, smart scheduling, calendar insights, React
hooks and a "Quick Add" calendar header plugin.

The whole package depends on one seam — the `AIAdapter` interface. No feature
imports a vendor SDK; adapters are the only vendor-specific code, and every
feature degrades gracefully when no adapter is available.

## Design: deterministic core, LLM at the edges

This package is deliberately honest about what the LLM does and does not do:

- **`detectConflicts` and `findFreeSlots` never touch an LLM.** They are pure,
  deterministic functions.
- **`suggestSchedulingTimes`** uses the LLM *only* to translate a
  natural-language request ("find 30 minutes this week") into machine
  constraints (duration + time window). The actual slots always come from the
  deterministic `findFreeSlots`.
- **`summarizeCalendar`** computes every number (hours, counts, busiest day)
  deterministically via `computeCalendarStats`; the LLM only writes the prose,
  with the authoritative stats embedded in its prompt. With no adapter you get
  a deterministic template summary.
- **`parseNaturalEvent`** falls back to a deterministic local parser
  (English + Portuguese: "tomorrow 3pm", "terça às 15h", durations like
  "90min" / "2 hours") when no adapter is given or the adapter call fails. The
  local parser works fully offline and marks results with confidence `"low"`.

## Security: never ship API keys to the browser

**The production path is `httpAdapter` + a backend proxy you control.** Your
server holds the LLM API key and calls the provider; the browser only talks to
your endpoint.

`claudeAdapter({ dangerouslyAllowBrowser: true })` exposes your Anthropic API
key to anyone who opens DevTools. That mode exists for local development and
demos **only**. Use `claudeAdapter` without that flag on the server, or
`httpAdapter` in the browser.

## Installation

```bash
npm install @react-agendfy/ai
```

`@anthropic-ai/sdk` is an **optional** peer dependency — install it only if
you use `claudeAdapter`:

```bash
npm install @anthropic-ai/sdk
```

If you use the Quick Add plugin, also import its stylesheet:

```ts
import "@react-agendfy/ai/style.css";
```

## Adapters

```ts
import { httpAdapter, claudeAdapter, customAdapter } from "@react-agendfy/ai";

// Recommended for production: your backend holds the key.
// POSTs { system, prompt, schema, maxTokens } and expects { text?, json?, usage? }.
const adapter = httpAdapter({ endpoint: "/api/ai" });

// Server-side (or dev-only in the browser). Default model: "claude-opus-4-8".
const serverAdapter = claudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });

// Any async function — another vendor, a local model, a test stub.
const stubAdapter = customAdapter(async (req) => ({ text: "..." }));
```

All adapters throw a vendor-neutral `AIAdapterError` with a `kind`
(`'auth' | 'rate_limit' | 'invalid_request' | 'network' | 'unknown'`) so UI
code never needs a vendor SDK to handle failures.

## Natural-language event parsing

```ts
import { parseNaturalEvent, httpAdapter } from "@react-agendfy/ai";

const adapter = httpAdapter({ endpoint: "/api/ai" });

const result = await parseNaturalEvent("Lunch with Ana tomorrow at 1pm", {
  adapter,                     // omit to use the offline local parser
  timeZone: "Europe/Lisbon",
  locale: "en",
});

// result.event      → { title, start, end, allDay? }  (ISO strings, no id yet)
// result.confidence → 'high' | 'medium' | 'low'
// result.missing    → e.g. ['time'] when no time of day was given
// result.raw        → the original input
```

`parseNaturalEventLocal` is exported separately if you want the deterministic
parser explicitly.

## Conflicts and free slots (no LLM)

```ts
import { detectConflicts, findFreeSlots } from "@react-agendfy/ai";

const conflicts = detectConflicts(events);
// → [{ type: 'overlap' | 'resource-double-booking', eventIds, overlapStart, overlapEnd, resourceId? }]

const slots = findFreeSlots(events, {
  rangeStart: "2026-08-03T00:00:00Z",
  rangeEnd: "2026-08-07T23:59:59Z",
  durationMinutes: 30,
  businessHours: { start: "09:00", end: "17:00" },
  timeZone: "Europe/Lisbon",   // default "UTC"
  maxSlots: 10,                // default 50
});
// → [{ start, end, durationMinutes }]
```

## Smart scheduling (LLM translates, algorithm decides)

```ts
import { suggestSchedulingTimes, httpAdapter } from "@react-agendfy/ai";

const suggestion = await suggestSchedulingTimes(
  "find 30 minutes for a 1:1 this week, mornings preferred",
  events,
  {
    adapter: httpAdapter({ endpoint: "/api/ai" }),
    timeZone: "Europe/Lisbon",
    businessHours: { start: "09:00", end: "17:00" },
  }
);

// suggestion.slots       → deterministic output of findFreeSlots
// suggestion.constraints → { durationMinutes, earliest, latest, preferences }
// suggestion.source      → 'llm' when the adapter interpreted the request,
//                          'fallback' (next 7 days, 60 min) otherwise
```

## Insights

```ts
import {
  computeCalendarStats,
  summarizeCalendar,
  categorizeEvents,
} from "@react-agendfy/ai";

// Pure stats — no LLM.
const stats = computeCalendarStats(events, { timeZone: "UTC" });
// → { eventCount, totalMeetingHours, busiestDay?, perDayHours }

// Deterministic numbers + optional LLM prose.
const insights = await summarizeCalendar(events, {
  adapter,               // omit for a deterministic template summary
  period: "this week",
  locale: "en",
});
// → { summary, busiestDay?, totalMeetingHours?, eventCount? }

// Schema-constrained id → category mapping (requires an adapter).
const mapping = await categorizeEvents(events, {
  adapter,
  categories: ["work", "personal", "focus"],
});
// → { [eventId]: "work" | "personal" | "focus" }
```

## React hooks

All hooks share the same shape (`{ run, loading, error, result, reset }`),
abort in-flight requests when a new one starts, and abort on unmount. Errors
surface through `error` — they are never thrown into React.

```tsx
import {
  useAIEventParser,
  useSmartScheduling,
  useCalendarInsights,
} from "@react-agendfy/ai";

function Toolbar({ adapter, events }) {
  const { parse, loading, result } = useAIEventParser(adapter, {
    timeZone: "Europe/Lisbon",
  });
  const { suggest, detectConflicts, findFreeSlots } = useSmartScheduling(adapter);
  const { summarize, result: insights } = useCalendarInsights(adapter, {
    period: "this week",
  });

  // await parse("standup tomorrow 9am");
  // await suggest("30 minutes this week", events);
  // await summarize(events);
}
```

All hooks work with `adapter` undefined — you get the deterministic behavior
described above.

## Quick Add header plugin

`createQuickAddPlugin` returns a core header plugin
(`{ key: 'ai-quick-add', type: 'search', location: 'right', … }`). The user
types a sentence, previews the parsed event (title, time range, confidence,
missing fields) and confirms; the plugin generates the id and calls
`onEventCreate`. Wiring, as used in `examples/basic/src/App.tsx`:

```tsx
import React, { useState } from "react";
import { Calendar, type EventProps } from "@react-agendfy/core";
import { createQuickAddPlugin, httpAdapter } from "@react-agendfy/ai";
import "@react-agendfy/core/core.css";
import "@react-agendfy/ai/style.css";

export default function App() {
  const [events, setEvents] = useState<EventProps[]>([]);

  const quickAdd = createQuickAddPlugin({
    // With no adapter the offline local parser is used (no API key needed).
    // For LLM-quality parsing point it at your own backend proxy:
    adapter: httpAdapter({ endpoint: "/api/ai" }),
    onEventCreate: (event) => setEvents((prev) => [...prev, event]),
    timeZone: "Europe/Lisbon",
    locale: "en",
  });

  return <Calendar events={events} plugins={[quickAdd]} />;
}
```

## Backend proxy contract (for `httpAdapter`)

Your endpoint receives a JSON POST and returns a JSON body:

```
Request:  { system?: string, prompt: string, schema?: object, maxTokens?: number }
Response: { text?: string, json?: unknown, usage?: { inputTokens, outputTokens } }
```

When `schema` is present, return the model's schema-constrained output in
`json`. A minimal implementation calls your LLM provider server-side (e.g. via
`claudeAdapter` or the provider SDK) and forwards the result.

## License

MIT © Márcio Zebedeu
