# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Version-truth gate (`apps/vault-tracker/scripts/check-version.mjs`, wired into the Android release workflow): fails the build unless `package.json` version == Gradle `versionName` == the version string in the built web assets, and fails on any hardcoded version literal in `src/`.
- Unit tests for the storage migration (copy + verification) and the Dexie-shaped storage facade (`src/tests/storage-migration.test.ts`); fixed `vitest.config.ts` so the `@` import alias resolves in tests — the suite previously failed at collection on every file.

### Changed
- In-app version displays (About page, app shell, unlock screen) now render `__APP_VERSION__`, injected at build time from `apps/vault-tracker/package.json` — the single source of truth. Previously the About page was a hardcoded `v1.1.0` literal that stayed wrong through the 1.1.9, 1.1.10, and 1.2.0 releases.
- Deleted the stale compiled `vite.config.js` / `vite.config.d.ts` artifacts from `apps/vault-tracker`: Vite was loading the `.js` copy, silently shadowing `vite.config.ts`. The TypeScript config is now the only config.
- `MOBILE_AUDIT.md` corrected: it described a five-app fleet with `com.vault.*` IDs and a "100% ready" verdict that did not match this repo; it now records this app's verified state and its open Play items only.
- README titles updated to v1.2.0 and the stale "New in v1.1.0" sections replaced with version-free feature highlights.
- `CONTRIBUTING.md`: PR-flow discipline — draft PR, tests green, owner merges; no direct pushes to `main`; every PR adds a CHANGELOG entry under `[Unreleased]` and bumps semver.
- `NOTICE.md`: project attribution (Owned by Nrupal Akolkar).
- Apache-2.0 license headers (`SPDX-License-Identifier: Apache-2.0`) on all app and package source files, matching the repo `LICENSE`.

### Changed
- **Storage engine swap (v1.2.0)**: the app now stores its data in SQLite — on Android an SQLCipher-encrypted database file whose passphrase is a per-device secret held in the Android Keystore (never derived from a vault password), on web jeep-sqlite (sql.js WASM over IndexedDB) — replacing Dexie/IndexedDB as the live store. Existing installs migrate automatically on first launch: a rescue snapshot is taken through the existing VaultRescueDB mechanism first, vaults/items/settings are copied in one transaction, and the copy is verified (row counts, per-vault item counts, byte-identical vault challenge material and item payloads by SHA-256 digest) before the app switches stores. On any failure the app keeps running on the untouched IndexedDB data and shows a visible warning. The old IndexedDB data is deliberately left in place as a fallback for this release (cleanup is a later change); on web there is no database-file encryption (the plugin offers none) — item payloads remain AES-256-GCM encrypted under keys derived from the user's master password on every platform, as before.
- Android launcher icon: the stock Capacitor placeholder replaced with the Vault Tracker shield artwork.
- Bumped `apps/vault-tracker/package.json` version 1.1.8 → 1.1.9 (patch) for this certification chore PR.
- Android identity frozen on `com.nrupal.vaulttracker`: `capacitor.config.ts` `appId` aligned with the Gradle `namespace` / `applicationId`.
- Licensing moved to the two-edition model in `LICENSING.md`: the open edition (this repository, as published for F-Droid) is under the Apache License 2.0 with the full text in `LICENSE`; commercial editions may include proprietary components under `TERMS.md`, with patent rights in those components expressly reserved. Stale MIT claims removed from `NOTICE.md`, the READMEs, `Sources.MD`, and `CONTRIBUTING.md`.
- `android:allowBackup` set to `false`; removed the unused google-services conditional block from the Android build (no `google-services.json` exists in this project).
- Committed Android `versionName` is now 1.1.9 and `versionCode` 10109 (was the placeholder 1 / "1.0"); CI pins pnpm 10.34.7 instead of `latest`.
