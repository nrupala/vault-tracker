# 🏗️ Code Visualization & Analysis

## Component Hierarchy Map

The application follows a container-based modular structure.

```mermaid
graph TD
    App[App.tsx] --> Theme[ThemeProvider]
    App --> Vault[VaultProvider]
    Vault --> Main[MainApp]
    Main --> Shell[AppShell]
    Shell --> Notes[NotesApp]
    Shell --> Tasks[TasksApp]
    Shell --> Habits[HabitsApp]
    Shell --> Calendar[CalendarApp]
    Shell --> Analytics[AnalyticsApp]
    Shell --> About[AboutApp]
```

## Data Life Cycle (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as User
    participant V as VaultProvider
    participant D as Dexie (IndexedDB)
    participant C as Crypto Engine

    U->>V: Enter Master Password
    V->>C: deriveKey(password, salt)
    C-->>V: Return AES-256 CryptoKey
    V->>D: Load Encrypted Blobs
    D-->>V: Payloads + Nonces
    V->>C: decrypt(payload, nonce, key)
    C-->>V: Return Plaintext JSON
    V->>U: Render Unlocked Workspace
```

## Module Responsibilities

| Module | Responsibility |
| :--- | :--- |
| `useVault` | Manages Master Password, Key Derivation, and Vault Metadata. |
| `useItems` | Core CRUD operations. Handles encryption *before* writing to DB. |
| `AppShell` | Responsive layout wrapper with Sidebar/BottomNav logic. |
| `ContainerItem` | Generic UI wrapper for all vault items (Notes/Tasks/Habits). |
| `crypto.ts` | Stateless wrapper for the Web Crypto API. |
| `db.ts` | Dexie.js schema definition and database initialization. |

## Storage Standard Note (2026-10-18)

The diagram and module table above describe the current implementation. **Storage standard (decided 2026-10-18):** This app stores its data in SQLite with SQLCipher (since v1.2.0; migrated from IndexedDB (Dexie.js)) — the whole database file is encrypted with AES-256 under a device key held in the phone's Keystore, and every item payload is additionally sealed with AES-256-GCM under keys derived from your master password; no key ever leaves your device. Existing installs migrate their IndexedDB data automatically on first launch of v1.2.0 — a rescue snapshot is taken first and the copy is verified before the switch; the old data is left untouched as a fallback for this release. Zero-knowledge throughout: we never hold your keys or your data.
