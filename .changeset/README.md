# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
The repo uses pnpm.

- `pnpm changeset` records a change.
- `pnpm changeset version` applies the pending changesets and bumps the versions.
- To publish:
  1. `pnpm -r publish --access public`. It publishes every package whose
     version isn't on npm yet, and rewrites `workspace:` ranges to real versions.
  2. `pnpm changeset tag`, then `git push --follow-tags`.

## Versioning policy — single source of truth

Every publishable workspace owns its own version field in its `package.json`, and
that field is the **single source of truth**. Changesets is the only tool allowed to
mutate those fields (via `pnpm changeset version`); do not hand-edit versions.

- `access: public` — all `@react-agendfy/*` packages publish publicly.
- `fixed` / `linked` are intentionally empty: packages version independently for now
  (`@react-agendfy/core` is ahead of the `1.0.0` plugins). Populate `linked` later if
  the plugins should track a shared version line.
- Private workspaces (the repo root and everything under `examples/*`) are skipped
  automatically and never published.
- Cross-package `workspace:` ranges are rewritten to real semver at publish time;
  published `peerDependencies` already use `^1.1.0` for `@react-agendfy/core`.
