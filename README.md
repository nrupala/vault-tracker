# 🛡️ Vault Tracker v1.1.0

**Zero-Trust. Zero-Knowledge. 100% Private.**

Vault Tracker is a premium, decentralized productivity suite designed for users who refuse to compromise on privacy. Built with a "Security-First" philosophy, it transforms your browser into a high-performance encryption engine where your notes, tasks, and habits are sealed with military-grade AES-256-GCM.

### 🌐 The Vault Ecosystem
Experience the full suite or use focused mini-apps for specific workflows:
- **[Vault Tracker](https://nrupala.github.io/vault-tracker/)** (Parent App)
1. **[Vault Tasks](file:///home/nrupal/vault-tracker/apps/vault-tasks/README.md)**: Hierarchical checklists, deadlines, and project tracking. ([Professional Use Cases](file:///home/nrupal/vault-tracker/apps/vault-tasks/usecase.md))
2. **[Vault Notes](file:///home/nrupal/vault-tracker/apps/vault-notes/README.md)**: Rich-text knowledge base for sensitive intel and secrets. ([High-Security Use Cases](file:///home/nrupal/vault-tracker/apps/vault-notes/usecase.md))
3. **[Vault Habits](file:///home/nrupal/vault-tracker/apps/vault-habits/README.md)**: Private consistency tracking for the privacy-conscious. ([Peak Performance Use Cases](file:///home/nrupal/vault-tracker/apps/vault-habits/usecase.md))
4. **[Vault Ledger](file:///home/nrupal/vault-tracker/apps/vault-ledger/README.md)**: Zero-knowledge financial journal for "Needs vs Wants". ([Financial Intelligence Use Cases](file:///home/nrupal/vault-tracker/apps/vault-ledger/usecase.md))

---

## 🎙️ Hands-Free: Voice-to-Vault
Vault Tracker supports local, privacy-first voice commands. 
**Try saying**:
- *"Task Buy groceries"*
- *"Note The secret code is 1234"*
- *"Expense 20 for Lunch"*
- *"Habit Deep Meditation"*

## 🔄 Sovereign Sync
Back up your encrypted vault to your preferred cloud (WebDAV, S3, GDrive). Your data remains an **Unbreakable Blob**—indistinguishable from noise to the provider.

![Vault Tracker Icon](public/icon-512.png)

## ✨ New in v1.1.0
- **📱 Mobile Maturity**: High-fidelity PWA support with `viewport-fit=cover` for iOS/Android notch support and standalone native builds.
- **🔄 Universal Data Import**: Seamlessly import data from **JSON**, **Plain Text**, and **iCalendar (.ics)** formats directly into your encrypted vaults.
- **🔢 Version Tracking**: Official versioning now visible in-app (v1.1.0).

## 🔒 The Zero-Trust Model
Vault Tracker operates on a **Local-Only** data persistence model:
1. **No Backend**: Your data never touches a server.
2. **PBKDF2 Derivation**: Your master password is used to derive a local encryption key (100,000 iterations).
3. **AES-GCM Encryption**: All content is encrypted *before* it hits the storage layer.
4. **Decentralized Storage**: Data is saved in your browser's IndexedDB, accessible only through your master key.

## 🛡️ The Trust Manifest: Why Vault Tracker?

In an era of "Privacy Theater," Vault Tracker is built on **Absolute Privacy by Architecture**. We don't ask for your trust; we make it mathematically irrelevant.

### 💎 Our USP: Unbreakable Sovereignty
1. **Zero-Knowledge by Default**: We never see your password, your keys, or your data. Encryption happens on *your* CPU, using *your* entropy, before a single byte hits storage.
2. **The "Unbreakable Blob" Philosophy**: If you choose to sync your data to the cloud, Vault Tracker only uploads **AES-256-GCM encrypted blobs**. To the cloud provider (Google, Dropbox, etc.), your data is indistinguishable from random noise.
3. **No Account, No Tracking**: There are no "Sign-ups." Your identity is your Master Password. We don't use cookies, analytics, or trackers.
4. **Local Mastery**: Your primary database is **IndexedDB** in your own browser. You own the hardware, you own the database, you own the keys.

### 🔒 Why You Can Trust Us
- **Open Cryptography**: We use the industry-standard **Web Crypto API**. No "proprietary" algorithms—just battle-tested mathematics.
- **Self-Contained**: The app is a standalone productivity engine. It doesn't rely on a mystery backend that could be breached or shut down.
- **Permanent Access**: Even if this website went offline, your local PWA would continue to function and decrypt your data forever.

---

## 🛠️ Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS, Framer Motion (Animations)
- **Engine**: Web Crypto API, Dexie.js (IndexedDB)
- **Tooling**: Capacitor (Mobile), Vitest (Tests)

---
Copyright © 2026 Nrupal Akolkar. Licensed under MIT.

