# Codetopo Profile — Vault Tracker (nrupala/vault-tracker)

**What this is.** The agent-facing map of this repository, generated with
Codetopo 0.9.1 (local engine, `~/.cargo/bin/codetopo`) so an arriving agent
can see the machine — topology, trust boundaries, money surface — before it
submits or changes anything. Read this first; the graph snapshot beside it
(`snapshot.json`, `stats.json`) is the measured evidence.

- **Repo:** nrupala/vault-tracker
- **Commit profiled:** `a9dc97231bbf3dcae2bbaac9e09ef699fe31ee7d` (main)
- **Engine:** codetopo 0.9.1 · index run 2026-11-18
- **Graph:** 78 files walked · 0 failed · 1616 nodes · 3963 edges · audit chain valid (3 entries, head `d6d09058…1d778`)
- **Nodes by kind:** external 814 · method 269 · function 145 · variable 142 · file 78 · module 78 · interface 40 · class 26 · doc 21 · package 3
- **Edges by kind:** calls 1785 · contains 799 · reads 742 · defines 458 · imports 160 · writes 15 · implements 3 · inherits 1

## Coverage honesty

Codetopo extracts Rust, TypeScript/JavaScript and Python, plus Markdown as Doc nodes. This repo's application code is TypeScript/TSX (36 `.ts` + 16 `.tsx` files) and is extracted at full symbol level. The Markdown files (17 `.md` + 4 `.MD`) are indexed as Doc nodes only. NOT covered at symbol level — Capacitor platform scaffolding residuals: Java (3 files, `android/` `MainActivity.java` + tests), Swift (1 file, `ios/`), Ruby (the `ios/App/Podfile`, Ruby DSL with no `.rb` extension), Gradle build scripts (6), and XML/plist/storyboard resources — read those directly; they are stock Capacitor shells, not application logic.

## Topology

Monorepo `vault-ecosystem`: the parent app plus a shared core package.

- `apps/vault-tracker/src/` — React app shell. `App.tsx` / `components/AppShell.tsx` host the focused mini-apps as components: `NotesApp.tsx`, `TasksApp.tsx`, `HabitsApp.tsx`, `LedgerApp.tsx`, plus `CalendarApp.tsx`, `AnalyticsApp.tsx`, `RecoveryKeyModal.tsx` and `UpgradePrompt.tsx` (the Pro upgrade surface).
- `apps/vault-tracker/src/lib/core/` + `packages/vault-core/src/` (`@vault/core`) — the shared engine: `crypto.ts` (AES-256-GCM vault encryption), `db.ts` / `legacyDb.ts` (local persistence, Capacitor SQLite), `storage/` (`codec.ts`, `facade.ts`, `migration.ts` — the encrypted-blob storage seam behind Sovereign Sync backup), `license.ts` (Pro activation), `backup.ts`, `intelligence.ts`. Tests live in `src/tests/` (`crypto.test.ts`, `crypto.dek.test.ts`, `license.test.ts`).
- `apps/vault-tracker/android/` + `ios/` — Capacitor native shells; the web build is the product, the shells only host it.

## Trust boundaries

- **Local-only, zero-knowledge by design** (README, "The Zero-Trust Model"): vault contents are encrypted on-device with AES-256-GCM (`src/lib/core/crypto.ts`); the vault password / recovery key never leave the device — `RecoveryKeyModal.tsx` is the recovery path, there is no server-side reset.
- **No backend account system in this repo:** no auth server, session or token store was found in the application source. Sovereign Sync backups leave the device only as an already-encrypted blob to a user-chosen provider (WebDAV / S3 / GDrive per README and `SOVEREIGN_SYNC.md`); the provider is trusted with ciphertext only.
- **Blast radius:** `crypto.ts`, the `storage/` facade and `license.ts` are the hubs — the graph's 1,785 call edges concentrate through the core library; a change to the codec or key handling changes every vault read/write.

## Money surface

One deliberate Pro-upgrade path, no other payment surface:

- `apps/vault-tracker/src/components/UpgradePrompt.tsx` — the upgrade UI routes by build channel (documented in its header): `play` builds use Google Play Billing; direct/web builds open a **Stripe Payment Link** (a `STRIPE_CHECKOUT_…` checkout URL constant in that file — value not reproduced here).
- `apps/vault-tracker/src/lib/core/license.ts` — after payment, Stripe lands the buyer back with an activation code (checkout session reference) which `license.ts` validates locally to activate Pro; covered by `src/tests/license.test.ts`.
- No card handling, checkout server, webhook receiver or payment SDK exists in this repo — collection itself happens entirely on Stripe's / Play's hosted surfaces.

## How an agent should approach

1. Read `README.md`, then this profile, then the snapshot.
2. Use `codetopo` queries against the snapshot (descendants, blast-radius,
   symbol) before editing — especially around the hubs named above.
3. Do not add credentials, account identifiers or key material to any file
   here — names and paths only. Respect the trust boundaries above as
   design constraints, not suggestions.
4. Run the repo's own tests after any change; regenerate this profile
   (below) whenever the code changes.

## Regeneration

`docs/codetopo-profile/refresh.sh` (in this pack) re-downloads the repo
at a named ref, re-runs the index, and rewrites `snapshot.json`,
`stats.json` and the header block inputs of this profile. Regenerate at
every release / material change.

Release gate: NOT RUN — Guardian Mesh: NOT RUN (this profile pack is a
documentation artifact; it is not a release-gate or Guardian Mesh verdict).
