# Sovereign Vault v2.0 — Sovereign Core (`sovereign-core` branch)

**Zero-trust. Zero-knowledge. Zero-dependency core. Buildless.**

This is the "Concrete" foundation of Vault Tracker (see `ARCHITECTURAL_TRUTH.md`):
no bundler, no framework, no `node_modules` in the runtime path. The entire app
is native ES Modules, Web Components, WebCrypto, and SQLite WASM over OPFS.
It renders on any modern browser and will keep rendering on future ones.

**Status: READY (v2.0 core).** Test suite 69/69; browser E2E verified
(auth, vault CRUD, encrypted persistence, vault isolation, peer chat over
OPFS-backed isolated chat DB, Double Ratchet E2EE, Companion HUD).

---

## What is actually in here

| Module | Purpose |
|---|---|
| `index.html` | Single entry point, `<sovereign-app>`, service-worker registration |
| `ui/SovereignApp.js` | The app (Shadow DOM web component): auth (challenge-verifier + vault DNA), tasks, notes, habits, ledger, journal, calendar (month/week/work-week/day/schedule), analytics with charts, journal, peer chat, settings (retention), export/import (JSON/CSV/TXT/ICS), themes |
| `ui/SovereignCompanionHUD.js` | Floating companion HUD; intent routing, security audit, sync status, E2EE peer messages |
| `ui/SovereignAppShell.js`, `SovereignVesselList.js`, `SovereignRouter.js` | Auxiliary buildless components (blob export/import, vessel list, tab routing) |
| `core/crypto.js` | AES-256-GCM, PBKDF2 (600K iterations), challenge-verifier, vessel sealing, ECDH P-256 + HKDF primitives |
| `core/db.js` | Fort Knox storage: OPFS primary, IndexedDB fallback, persistence request, vaults/vessels/settings |
| `core/double-ratchet.js` | Signal-style Double Ratchet E2EE (X3DH-less bootstrap on the vault shared secret): full DH ratchet steps, per-message keys, skipped-key out-of-order handling, replay rejection |
| `core/sync.js` | Sovereign Sync Bus: JSON ratchet envelopes over WebSocket, presence, mock transport for offline E2EE testing |
| `core/broker.js` | Sovereign Signal Broker: XMPP stanza codec (RFC 6120 framing, SASL PLAIN, bind, message/presence), loopback transport (BroadcastChannel), WebSocket transport, service bus (`register`/`call`/`emit`/`on`) |
| `core/chat-db.js` | Isolated chat database (contacts/conversations/messages/attachments), OPFS/IndexedDB/memory modes, ciphertext-at-rest only, E2E key generation |
| `core/companion.js`, `companion-engine.js`, `personality.js`, `intelligence.js` | Local companion mind: intent parsing, security audit, personalities, learning engine |
| `core/scrubber.js` | Metadata scrubbing for media (JPEG bounds-checked) |
| `core/voice.js` | Voice-to-vault capture |
| `core/sqlite3.js` + `.wasm` | Vendored SQLite WASM |
| `sw.js` | Offline-first service worker: full asset precache + stale-while-revalidate |
| `manifest.json` + icons | Installable PWA (192/512 px) |
| `test-suite.js` | 69-test suite: structure, UI surface, security, architecture, plus functional Double Ratchet / broker codec / chat-db tests |

## Security model (Hollow Vessel)

- Every entry is an independent encrypted vessel: its own IV + GCM tag; type,
  tags, priority, timestamps live **inside** the blob — providers see only an id
  and a timestamp.
- Vault unlock = PBKDF2 (600K) → AES key + challenge-verifier (decrypt a magic
  string; no password material stored).
- Sync payloads are Double Ratchet E2EE **before** entering any transport; the
  XMPP/WS broker only ever carries ciphertext.
- Chat database never stores plaintext message content (`lastMessage` preview is
  the constant `[encrypted]`).

## Run

Any static file server from this directory — there is no build step:

```
python -m http.server 8931
# open http://127.0.0.1:8931/
```

## Verify (test-to-pass)

```
node --input-type=module -e "import('./test-suite.js')"   # 69/69 (Node 20+)
node --test core/scrubber.test.js                          # 2/2
```

Browser verification performed 2026-09-06 (Chromium via automation):
boot with zero console errors; vault create → unlock → task/note/habit/ledger
CRUD → lock → unlock → data survives; second vault is isolated (no cross-vault
reads); peer chat stores ciphertext in the isolated chat DB and decrypts on
open; Companion HUD mounts and reports sync status; service worker precaches
the full asset graph.

## Deploy

- **PWA/ Pages:** serve this directory as the site root (static; any host).
- **Android APK / packaged PWA:** `bash package-pwa-apk.sh` (universal packager).
- **CI:** `.github/workflows/build-sovereign.yml` auto-builds on pushes to
  `sovereign-core`.

## Honest limitations

- Legacy vaults created before the verifier-serialization fix unlock via the
  test-encrypt fallback (one console notice; verification is still strong).
- Vessels created before vault-scoped ids are shared across vaults (each vault
  sees only what it can decrypt; they are silently skipped as unreadable noise).
- XMPP transport performs stream-open/SASL-PLAIN/bind/presence framing and is
  codec-tested; live-server interoperability depends on the chosen XMPP/WS
  endpoint (any Snikket/Ejabberd/Prosody with WebSocket enabled).
- `voice.js` uses the browser speech stack where available; graceful no-op
  otherwise.

## Branch discipline

This branch (`sovereign-core`) is the developmental fork for the v2 foundation.
It is **not merged into `main`**. It will move to its own repository after
acceptance.