# @react-agendfy/plugin-timeline

## 3.0.0

### Major Changes

- 3623389: Rewrite on the core's public API. There are now three views (`timelineDay`, `timelineWeek`, `timelineMonth`) instead of `timeline`, and the default export is the array of all three; `createTimelinePlugins(options)` takes options. The views have:
  
  - a time axis with a two-row header;
  - the resource tree with collapsible groups, and an "Unassigned" row;
  - overlapping events stacked in lanes;
  - drag in time and between resources, resize, keyboard drag, external drops, the rules with the live preview, and undo;
  - each resource's `businessHours` shaded;
  - virtualized rows and slots;
  - texts in six languages.
  
  The stylesheet is now imported from `@react-agendfy/plugin-timeline/style.css`. Requires `@react-agendfy/core` 2.2 or later.

## 2.0.0

### Minor Changes

- f9a62af: v2 modernization release. See MIGRATION.md for the full v1 → v2 guide.

  **@react-agendfy/core (major — breaking):**

  - Fully typed public API: `CalendarProps`/`Config` no longer accept arbitrary
    keys; `Calendar` is a named export with a working `forwardRef`.
  - CSS class namespace unified to `react-agendfy-*` (old `react-agenfy-*` typo
    and `fc-*` classes removed) — custom CSS overrides must update selectors.
  - New 3-layer design-token system scoped under `.agendfy`
    (`--agendfy-*`; legacy `--color-*`/`--padding-*` names kept via a compat
    layer), OS-aware dark mode, `theme` now applied via a scoped `data-theme`
    attribute on the calendar root instead of mutating `document.documentElement`.
  - Built-in i18n catalog (en, pt, pt-BR, es, fr, ar) with user-config override;
    `lang: 'pt'` now resolves to European Portuguese (use `'pt-BR'` for
    Brazilian). Automatic RTL via `lang` or the new `direction` prop.
  - WCAG 2.1 AA accessibility: grid semantics, roving-tabindex arrow-key
    navigation, keyboard-operable events and drag & drop.
  - Correctness fixes: export crash, horizontal drag discarded as click,
    off-slot events not rendering, multi-day duration collapse on drag, resize
    off-by-one and timezone drift, inert data-source plugins.

  **@react-agendfy/ai (new):** provider-agnostic AI layer — natural-language
  event parsing (with an offline deterministic fallback), conflict detection and
  free-slot search (deterministic), LLM-assisted scheduling suggestions,
  calendar insights, React hooks, and a Quick Add header plugin. Ships an
  optional Claude adapter and an HTTP adapter for backend proxies.

  **Plugins (minor):** publish manifests fixed to ship built `dist` output,
  normalized peer dependencies, theme plugin now applies a complete dark token
  set to the calendar root.

### Patch Changes

- Updated dependencies [f5aa769]
- Updated dependencies [6fc7fc6]
- Updated dependencies [89c638a]
- Updated dependencies [c26c3e0]
- Updated dependencies [3c59b01]
- Updated dependencies [f9a62af]
  - @react-agendfy/core@2.0.0
