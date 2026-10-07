# Contributing to Vault Tracker (ecosystem monorepo)

This is a pnpm workspace: the `vault-tracker` app lives in `apps/vault-tracker`,
shared code in `packages/vault-core`.

## PR-flow discipline (portfolio standard)

1. **All changes to `main` go through a pull request** — opened as a draft first.
   No direct pushes to `main`, ever.
2. The PR must be **green** before review: `pnpm -r build` and `pnpm -r test` pass.
3. The repo **owner merges**; contributors and automation never merge.
4. Every PR adds its entry under `## [Unreleased]` in the root `CHANGELOG.md` and
   **bumps semver** (patch = fix/chore, minor = feature, major = breaking change)
   in the affected package's `package.json`.
5. Merge commits reference the PR number (e.g. `(#123)`).
6. Releases are tagged `vX.Y.Z` after merge.

## Development

```bash
pnpm install        # install workspace dependencies (requires Node >= 20)
pnpm -r build       # build all packages
pnpm -r test        # run all tests
pnpm -r lint        # lint all packages
pnpm -r --filter vault-tracker dev   # run the app in dev mode
```

## Versioning

- Each app's `package.json` `version` is the source of truth for that app.
- Release tags must match the app's `package.json` (CI enforces this on `v*` / `apk-v*`
  tags — see `.github/workflows/android-release.yml`).

## License

This project is MIT licensed (`LICENSE`). Keep the MIT header
(`SPDX-License-Identifier: MIT`) on every source file you add.
