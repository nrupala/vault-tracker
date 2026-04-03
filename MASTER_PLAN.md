# 🗺️ Sovereign Vault v2.0 — Master Enhancement Plan

> *"What makes technology matter is not features. Not speed. **Presence.**"*

---

## Current State (What Exists Today)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SOVEREIGN VAULT v2.0                          │
│                   Zero-Knowledge Encrypted Workspace                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔐 AUTHENTICATION          │  📋 TASKS                            │
│  • Challenge-Verifier       │  • Create, Edit, Delete              │
│  • Vault DNA (visual hash)  │  • Title, Content, Due Date          │
│  • Non-extractable keys     │  • Priority, Color, Tags, Flag       │
│  • PBKDF2 600K iterations   │  • Completion tracking               │
│  • AES-256-GCM encryption   │  • Stats: completion, critical, overdue│
│                             │                                      │
│  📝 NOTES                   │  🔄 HABITS                           │
│  • Title, Content, Tags     │  • Daily check-in with streak calc   │
│  • Flag, Color, Priority    │  • Priority, Color, Tags, Flag       │
│  • Full edit modal          │  • Streak tracking & display         │
│                             │                                      │
│  💰 LEDGER                  │  📅 CALENDAR                         │
│  • Debit/Credit entries     │  • Month, Week, Work Week views      │
│  • 11 categories            │  • Day, Schedule views               │
│  • Need/Want classification │  • Type filter (All/Task/Note/etc)   │
│  • Running balance          │  • Color-coded item badges           │
│  • Net balance, savings %   │  • Timeline view for Day             │
│                             │                                      │
│  📊 ANALYTICS               │  🤖 COMPANION                        │
│  • Task completion rate     │  • 5 Personalities (Zen/Focus/etc)   │
│  • Priority distribution    │  • Mood tracking with check-ins      │
│  • Behavioral balance       │  • Milestone celebration             │
│  • Ecosystem insights       │  • Empathetic responses              │
│  • Habit streak analytics   │  • Presence detection ("missed you") │
│                             │  • Daily reflection prompts          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ⚡ INTELLIGENCE ENGINE                                            │
│  • Learns from your patterns (tags, categories, descriptions)      │
│  • Smart autocomplete on all inputs                                │
│  • Amount suggestions: "You usually spend $15-25 on food"          │
│  • Anomaly detection: "Usually $15-25. This is $85."               │
│  • Quick-add chips for frequent entries                            │
│  • Time-based nudges: "You usually log expenses on Mondays"        │
│                                                                     │
│  🔒 MILITARY-GRADE SECURITY                                        │
│  • Non-extractable CryptoKeys (JS never sees key bits)             │
│  • Password zeroization (Uint8Array → PBKDF2 → fill(0))            │
│  • Key wrapping architecture ready (DEK/KEK separation)            │
│  • All data encrypted at rest, zero-knowledge by design            │
│  • IndexedDB persistence with SQLite WASM fallback                 │
│                                                                     │
│  🎨 5 THEMES × 5 PERSONALITIES = 25 UNIQUE FEELS                   │
│  Themes: Dark, Light, Sepia, Deep Blue, AMOLED                     │
│  Personalities: Zen 🧘, Focus 🎯, Playful 🎉, Professional 💼, Energy ⚡│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Journal System 📔
**Timeline:** 1-2 days | **Priority:** Immediate

### The Problem
People need a private space for unstructured thoughts. Notes are too formal. Tasks are too rigid. The journal is where life happens — messy, honest, unfiltered.

### The Solution
```
┌─────────────────────────────────────────────────────────────────────┐
│                        📔 JOURNAL MODULE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DAILY PROMPTS (Gentle, not demanding)                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ "How are you feeling today?"                                │   │
│  │ "What went well today?"                                     │   │
│  │ "What's on your mind?"                                      │   │
│  │ "What are you grateful for?"                                │   │
│  │ "What would you like to let go of?"                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  FREE WRITING                                                       │
│  • Unstructured, no format, no rules                               │
│  • Timestamped entries with optional mood tag                      │
│  • Rich text support (bold, italic, lists)                         │
│  • Search across all journal entries                               │
│                                                                     │
│  MOOD + JOURNAL LINK                                                │
│  • 😊 😐 😔 😤 selector per entry                                  │
│  • Track mood trends over weeks/months                             │
│  • See correlations: "You write more on days you feel stressed"    │
│                                                                     │
│  EXPORT OPTIONS                                                     │
│  • 📤 Markdown (.md) — clean, portable                             │
│  • 📤 PDF (styled) — beautiful, printable                          │
│  • 📤 JSON (encrypted backup) — full fidelity                      │
│  • 📤 TXT (plain) — universal                                      │
│                                                                     │
│  STORAGE & PRIVACY                                                  │
│  • Encrypted vessels (type: "journal")                             │
│  • Isolated from notes — won't clutter note list                   │
│  • Only YOU can read these. Even companion can't.                  │
│  • Optional: companion can ask "Want to journal about it?"         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Technical Implementation
- **Storage:** Same encrypted vessel system (type: `journal`)
- **Schema:** `{ title, content, mood, date, tags, isFlagged }`
- **Isolation:** Separate render, separate list, separate export
- **Prompts:** Rotating daily prompts from a curated list
- **Export:** Markdown generation with date headers, mood indicators

---

## Phase 2: Peer Chat System 💬
**Timeline:** 3-5 days | **Priority:** Medium

### The Problem
People want to communicate securely with trusted peers, but existing apps either leak metadata (WhatsApp), require phone numbers (Signal), or are too complex (Matrix).

### The Solution
```
┌─────────────────────────────────────────────────────────────────────┐
│                  💬 PEER CHAT — ISOLATED LAYER                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ARCHITECTURE: COMPLETE ISOLATION                                   │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Vault DB    │    │  Chat DB     │    │  Sync Layer  │          │
│  │  (SQLite/    │    │  (Separate   │    │  (WebSocket  │          │
│  │   IndexedDB) │    │   IndexedDB) │    │   or P2P)    │          │
│  │              │    │              │    │              │          │
│  │ • Tasks      │    │ • Messages   │    │ • Presence   │          │
│  │ • Notes      │    │ • Files      │    │ • Roster     │          │
│  │ • Habits     │    │ • Images     │    │ • OMEMO E2EE │          │
│  │ • Ledger     │    │ • Audio      │    │ • Key Exch.  │          │
│  │ • Journal    │    │ • Videos     │    │              │          │
│  │ • Settings   │    │ • Any MIME   │    │              │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│       │                      │                      │              │
│       └──────────────────────┼──────────────────────┘              │
│                              │                                     │
│              ZERO CROSS-CONTAMINATION                              │
│         Chat cannot corrupt vault data                             │
│         Vault cannot leak to chat                                  │
│         Different databases, different encryption keys             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  FEATURES:                                                          │
│  • End-to-end encrypted (OMEMO / Double Ratchet protocol)           │
│  • All MIME types: text, images, audio, video, files, contacts      │
│  • Group chats with admin controls                                  │
│  • Offline message queue (sync when online)                         │
│  • No server stores plaintext — ever                                │
│  • Chat history in separate IndexedDB store                         │
│  • Export chat as encrypted bundle                                  │
│  • Like SimpleX: no phone number, no email, just cryptographic keys │
│  • Like Monal/Monocles: beautiful, fast, reliable                   │
│  • Self-destructing messages option                                 │
│  • Read receipts (optional, E2E encrypted)                          │
│                                                                     │
│  IDENTITY:                                                          │
│  • Each user gets a cryptographic identity (Ed25519 keypair)        │
│  • Share identity via QR code or text string                        │
│  • No central server required for identity                          │
│  • Optional: link to existing XMPP server                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Technical Implementation
- **Database:** Separate IndexedDB (`sovereign-chat-v1`)
- **Encryption:** OMEMO protocol (X3DH + Double Ratchet)
- **Transport:** WebSocket to XMPP server OR WebRTC P2P
- **File Sharing:** Encrypted blobs, stored in chat DB
- **Sync:** Message queue with delivery receipts
- **Isolation:** Zero shared state with vault DB

---

## Phase 3: Apple-Level Polish 🍎
**Timeline:** Ongoing | **Priority:** Continuous

### The Philosophy
Apple doesn't ship features. They ship *feelings*. The feeling that everything just works. That the device anticipates your needs. That it respects your time and attention.

```
┌─────────────────────────────────────────────────────────────────────┐
│              🍎 APPLE-LEVEL EXPERIENCE LAYERS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 1: SPEED                                                     │
│  ├─ Instant load (<100ms to interactive)                            │
│  ├─ Zero loading spinners — optimistic UI updates                   │
│  ├─ Keyboard shortcuts (Ctrl+K search, Ctrl+N new, Ctrl+F find)     │
│  ├─ Smooth 60fps transitions between all views                      │
│  └─ Debounced inputs, batched renders, minimal reflows              │
│                                                                     │
│  LAYER 2: DELIGHT                                                   │
│  ├─ Satisfying check animation with subtle bounce                   │
│  ├─ Confetti on milestone streaks (10 tasks, 7-day habit, etc)      │
│  ├─ Haptic-like visual feedback on every button press               │
│  ├─ Micro-animations that feel alive, not distracting               │
│  └─ Sound design (optional): subtle clicks, whooshes, chimes        │
│                                                                     │
│  LAYER 3: SMART                                                     │
│  ├─ Remembers last tab, last vault, last theme, last personality    │
│  ├─ Auto-suggests tags from usage patterns                          │
│  ├─ "You usually spend $15-25 on food" — amount suggestions         │
│  ├─ Anomaly detection: "This is unusual for this category"          │
│  ├─ Smart defaults: pre-fill category based on description          │
│  └─ Predictive: "You usually log lunch expenses around 1pm"         │
│                                                                     │
│  LAYER 4: PRESENCE                                                  │
│  ├─ "I missed you. It's been 5 days." — genuine warmth              │
│  ├─ Morning greeting with daily overview                            │
│  ├─ Evening reflection prompt                                       │
│  ├─ Weekly summary: "You crushed 85% of tasks this week!"           │
│  └─ Monthly life review: "Here's how you grew this month"           │
│                                                                     │
│  LAYER 5: BEAUTY                                                    │
│  ├─ 5 themes × 5 personalities = 25 unique feels                    │
│  ├─ Consistent spacing, typography, rhythm across all modules       │
│  ├─ No visual clutter — every pixel has purpose                     │
│  ├─ Dark mode that's actually dark (true black AMOLED)              │
│  └─ Accessibility: proper contrast, screen reader support           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Life Guide Philosophy 🧭
**Timeline:** Long-term vision | **Priority:** Strategic

### The Vision
This isn't just an app. It's a mirror for your growth. A witness to your life. A companion that helps you understand yourself better.

```
┌─────────────────────────────────────────────────────────────────────┐
│              🧭 THE APP AS A LIFE COMPASS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  THE CORE QUESTIONS:                                                │
│                                                                     │
│  "What matters to you?"                                             │
│       │                                                             │
│       ├─ Tasks → "What are you building?"                           │
│       ├─ Habits → "Who are you becoming?"                           │
│       ├─ Ledger → "How do you value your resources?"                │
│       ├─ Journal → "How do you feel about it all?"                  │
│       └─ Notes → "What have you learned?"                           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MONTHLY REFLECTION (Auto-generated, encrypted, private):           │
│                                                                     │
│  "This month you:                                                   │
│   • Completed 47 tasks (85% completion rate)                        │
│   • Maintained a 12-day meditation streak                           │
│   • Spent $1,200 — 15% less than last month                        │
│   • Wrote 8 journal entries                                         │
│   • Learned about JavaScript, cooking, and patience                 │
│                                                                     │
│   You're growing. Keep going."                                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  YEAR IN REVIEW:                                                    │
│  • Total tasks completed                                            │
│  • Longest habit streak                                             │
│  • Total income vs expenses                                         │
│  • Most productive month                                            │
│  • Mood trends over the year                                        │
│  • Journal word count                                               │
│  • "You showed up X days this year"                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GOAL TRACKING (Cross-module):                                      │
│  • Set a goal: "Save $5,000" → tracks ledger                        │
│  • Set a goal: "Read 12 books" → tracks habits + notes              │
│  • Set a goal: "Run a marathon" → tracks habits + journal           │
│  • Progress rings that fill up satisfyingly                         │
│  • Milestone celebrations                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Execution Roadmap

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRIORITY MATRIX                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRIORITY 1 (NOW — This Week)                                       │
│  ├─ ✅ Fix ledger button labels (Export CSV / Import CSV)           │
│  ├─ ⬜ Journal module (type: "journal" vessels)                     │
│  ├─ ⬜ Daily journal prompts                                        │
│  ├─ ⬜ Journal export (MD, PDF, JSON, TXT)                          │
│  └─ ⬜ Mood + journal link                                          │
│                                                                     │
│  PRIORITY 2 (NEXT WEEK)                                             │
│  ├─ ⬜ Separate chat database (IndexedDB, isolated)                 │
│  ├─ ⬜ Chat UI (messages, file sharing, groups)                     │
│  ├─ ⬜ E2E encryption for chat (OMEMO or Signal protocol)           │
│  ├─ ⬜ Presence/roster management                                   │
│  └─ ⬜ Offline message queue                                        │
│                                                                     │
│  PRIORITY 3 (POLISH — Ongoing)                                      │
│  ├─ ⬜ Keyboard shortcuts (Ctrl+K, Ctrl+N, Ctrl+F)                  │
│  ├─ ⬜ Micro-animations (check bounce, confetti)                    │
│  ├─ ⬜ Smart autocomplete on ALL inputs                             │
│  ├─ ⬜ Morning/evening companion prompts                            │
│  ├─ ⬜ Weekly summary generation                                    │
│  └─ ⬜ Sound design (optional, toggleable)                          │
│                                                                     │
│  PRIORITY 4 (VISION — Long-term)                                    │
│  ├─ ⬜ Monthly life reflection                                      │
│  ├─ ⬜ Goal tracking across modules                                 │
│  ├─ ⬜ "What matters to you?" onboarding flow                       │
│  ├─ ⬜ Cross-module insights                                        │
│  └─ ⬜ Year in review                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Fort Knox Storage 🔐
**Timeline:** 3-5 days | **Priority:** Critical

### The Problem
Our current storage (IndexedDB) is visible in browser DevTools. Anyone with access to the device can inspect, export, or tamper with the database. We need military-grade storage isolation.

### Google's Recommendation vs Our Current State
```
┌─────────────────────────────────────────────────────────────────────┐
│                    STORAGE SECURITY ANALYSIS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  WHAT WE HAVE NOW:                                                  │
│  • Storage: IndexedDB (primary) + SQLite WASM/OPFS fallback         │
│  • Encryption: AES-256-GCM, PBKDF2 600K iterations                  │
│  • Keys: Non-extractable CryptoKeys (JS can NEVER read bits)        │
│  • Auth: Challenge-verifier (password)                              │
│  • Persistence: ❌ No navigator.storage.persist()                   │
│  • Biometrics: ❌ Not implemented                                   │
│                                                                     │
│  WHAT GOOGLE RECOMMENDS:                                            │
│  • Storage: OPFS exclusively (hidden, sandboxed, fast)              │
│  • Encryption: AES-256-GCM, PBKDF2 100K iterations                  │
│  • Keys: Extractable (stored in memory)                             │
│  • Auth: WebAuthn (biometrics/passkeys)                             │
│  • Persistence: navigator.storage.persist()                         │
│                                                                     │
│  WHERE WE'RE ALREADY BETTER:                                        │
│  ✅ PBKDF2: 600K vs Google's 100K (6x more resistant to brute-force)│
│  ✅ Non-extractable keys: JS can NEVER read key bits                │
│  ✅ Challenge-verifier: Encrypts canary string, no hashes to crack  │
│  ✅ Vault DNA: Visual fingerprint prevents phishing                 │
│                                                                     │
│  WHERE WE'RE WEAKER:                                                │
│  ⚠️ Storage visibility: IndexedDB visible in DevTools               │
│  ⚠️ No persistent storage flag: browser may auto-delete on low disk │
│  ⚠️ No biometric unlock: password-only is weaker than WebAuthn      │
│  ⚠️ OPFS is fallback, not primary                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### The Solution: Hybrid Fort Knox
```
┌─────────────────────────────────────────────────────────────────────┐
│                    🔐 FORT KNOX STORAGE STACK                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 1: OPFS PRIMARY (1 day)                                      │
│  ├─ Flip OPFS to PRIMARY storage, IndexedDB to fallback             │
│  ├─ Add navigator.storage.persist() on every vault open             │
│  ├─ Store salt in OPFS (not IndexedDB)                              │
│  └─ Same encryption layer (600K PBKDF2, AES-256-GCM)               │
│                                                                     │
│  PHASE 2: WEB AUTHN BIOMETRICS (2-3 days)                           │
│  ├─ Add optional TouchID/FaceID/Windows Hello unlock                │
│  ├─ Hybrid auth: Biometric → unwrap DEK → instant access            │
│  ├─ Password still works as fallback                                │
│  └─ Hardware-backed key storage (Secure Enclave/TPM)                │
│                                                                     │
│  PHASE 3: SYNC ACCESS HANDLE (1-2 days)                             │
│  ├─ Use OPFS SyncAccessHandle for near-native disk speeds           │
│  ├─ Synchronous reads/writes (no async overhead)                    │
│  └─ Perfect for large encrypted blobs                               │
│                                                                     │
│  RESULT:                                                            │
│  • Storage: OPFS (hidden, sandboxed) + IndexedDB fallback           │
│  • Encryption: AES-256-GCM, 600K iterations (our strength)          │
│  • Keys: Non-extractable (our strength)                             │
│  • Auth: Password + WebAuthn (best of both)                         │
│  • Persistence: navigator.storage.persist() ✅                      │
│  • Backup: Encrypted export still works ✅                          │
│  • DevTool visibility: Hidden (OPFS) ✅                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Guiding Principles

1. **Zero-Knowledge Everything** — No data leaves the device unencrypted. Ever.
2. **Isolation by Design** — Chat cannot corrupt vault. Vault cannot leak to chat.
3. **Speed is a Feature** — <100ms to interactive. Zero loading spinners.
4. **Delight in Details** — Every interaction should feel satisfying.
5. **Presence Over Features** — The app should feel like it cares.
6. **Privacy is Non-Negotiable** — Even the companion can't read your journal.
7. **Apple-Level Polish** — Consistent, beautiful, accessible, fast.
8. **Life Guide, Not Task Manager** — Help users understand themselves, not just track things.
9. **Fort Knox Storage** — OPFS primary, WebAuthn optional, persistent by default.

---

*Last Updated: April 3, 2026*
*Status: Phase 1 In Progress*
