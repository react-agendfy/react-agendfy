# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
Run `yarn changeset` to record a change, `yarn version` (→ `changeset version`) to
apply pending changesets and bump versions, and `yarn release` (→ `changeset publish`)
to publish.

> First-time setup (offline install pending): run `yarn add -D @changesets/cli`.
> The `changeset` / `version` / `release` scripts are already wired in the root
> `package.json`, but the CLI dependency still needs to be installed.

## Versioning policy — single source of truth

Every publishable workspace owns its own version field in its `package.json`, and
that field is the **single source of truth**. Changesets is the only tool allowed to
mutate those fields (via `yarn version`); do not hand-edit versions.

- `access: public` — all `@react-agendfy/*` packages publish publicly.
- `fixed` / `linked` are intentionally empty: packages version independently for now
  (`@react-agendfy/core` is ahead of the `1.0.0` plugins). Populate `linked` later if
  the plugins should track a shared version line.
- Private workspaces (the repo root and everything under `examples/*`) are skipped
  automatically and never published.
- Cross-package `workspace:` ranges are rewritten to real semver at publish time;
  published `peerDependencies` already use `^1.1.0` for `@react-agendfy/core`.
