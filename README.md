# 🛡️ Vault Tracker v1.0

**Zero-Trust. Zero-Knowledge. 100% Private.**

Vault Tracker is a premium, decentralized productivity suite designed for users who refuse to compromise on privacy. Built with a "Security-First" philosophy, it transforms your browser into a high-performance encryption engine where your notes, tasks, and habits are sealed with military-grade AES-256-GCM.

Go to GitHub for documents, deployment, and source code: https://github.com/nrupala/vault-tracker

To experience app on web-page and to install a localized PWA on iOS, Android or other supporting platforms visit: [nrupala.github.io/vault-tracker](https://nrupala.github.io/vault-tracker/)

![Vault Tracker Icon](public/icon-512.png)

## ✨ Features

- **📝 Infinite Outliner**: A Workflowy-style hierarchical note-taking experience with markdown support, vertical guides, and keyboard-driven indentation.
- **✅ Actionable Tasks**: Checklists with priority levels, flexible deadlines, and browser-level reminder notifications.
- **📈 Privacy Analytics**: Visualize your productivity trends with local-only heatmaps and habit streak tracking.
- **🎙️ Voice Intelligence**: Capture thoughts hands-free with Web Speech API integration and auto-titling logic.
- **📅 Unified Calendar**: A birds-eye view of your encrypted schedule, featuring activity density overlays.
- **🌈 Premium Theming**: 5 curated themes including pitch-black OLED mode, soothing Sepia, and high-contrast Cobalt.

## 🔒 The Zero-Trust Model

Vault Tracker operates on a **Local-Only** data persistence model:
1. **No Backend**: Your data never touches a server.
2. **PBKDF2 Derivation**: Your master password is used to derive a local encryption key (100,000 iterations).
3. **AES-GCM Encryption**: All content is encrypted *before* it hits the storage layer.
4. **Decentralized Storage**: Data is saved in your browser's IndexedDB, accessible only through your master key.

## 🚀 Mobile & PWA

Vault Tracker is cross-platform by design:
- **iOS**: Install as a "Smart PWA" for a standalone, offline-ready experience.
- **Android**: Fully compatible with native builds via Capacitor integration.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion (Animations)
- **Engine**: Web Crypto API, Dexie.js (IndexedDB)
- **Tooling**: Vitest (Stress Testing), Capacitor (Mobile)

---
Copyright © 2026 Nrupal Akolkar. Licensed under MIT.
