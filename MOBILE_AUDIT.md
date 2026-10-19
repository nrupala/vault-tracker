# 📱 Vault Tracker: Mobile Audit

**Corrected 2026-10-19.** The previous version of this file (titled "v1.1.8")
described a five-app monorepo fleet with per-app IDs (`com.vault.tasks`,
`com.vault.notes`, …) and declared the fleet "100% ready for multi-platform
distribution". That record no longer matches this repository and its verdict
was not accurate: the sibling apps live in their own repositories, and this
repo ships exactly one app. This file now records only what is true of
**this** app, verified against the code.

## Vault Tracker — current state

| Item | Value | Source of truth |
|------|-------|-----------------|
| App | Vault Tracker (`apps/vault-tracker`) | — |
| Version | Injected from `package.json` at build time; native `versionName` gate-checked against it (`scripts/check-version.mjs`, runs in CI) | `apps/vault-tracker/package.json` |
| Application ID | `com.nrupal.vaulttracker` (Capacitor `appId`, Gradle `namespace`/`applicationId` — aligned) | `capacitor.config.ts`, `android/app/build.gradle` |
| Storage | SQLite — SQLCipher-encrypted database file on Android (device key in Android Keystore), jeep-sqlite on web; item payloads AES-256-GCM under master-password-derived keys | `src/lib/core/storage/` |
| Offline | Full offline operation; VitePWA precaching service worker; no analytics, ads, or tracker SDKs | `vite.config.ts`, `package.json` |
| Android backup | `allowBackup="false"` | `android/app/src/main/AndroidManifest.xml` |

## Known open items (not hidden)

- **Target API**: Google Play requires target API 36 for new uploads; the
  SDK bump is a separate, tracked change — this file does not claim it done.
- **Play listing**: Play submission additionally requires an AAB build and
  the Console app-content pack (privacy policy URL, data-safety answers,
  content rating). Tracked outside this file.

**Verdict**: Vault Tracker is a single offline Android/web app with a frozen
identity and a gate-checked version story. It is **not** described as
store-ready here until the target-API and AAB items above are closed and
verified on a device.
