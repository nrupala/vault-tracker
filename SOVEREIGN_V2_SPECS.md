# 🏛️ Sovereign Core v2.0 (The Everlasting Foundation)

This document outlines the elimination of structural flaws from v1.x and the move to a "Buildless Concrete" architecture.

---

## 🏗️ Structural Flaws to Eliminate
1.  **Dependency Bloat**: v1.x has 1.6GB of `node_modules`. v2.0 aims for **zero third-party libraries** in the core data/crypto path.
2.  **Bundler Reliance**: Elimination of Vite/Rollup in production. The app will run on native **ES Modules (ESM)**.
3.  **Framework Lock-in**: Replacing React with **Native Web Components**.
4.  **Storage Fragmentation**: Moving from IndexedDB to **SQLite WASM** for relational robustness.

## 📡 The XMPP Signal Bus
To integrate with the outside world (mail, external tasks, gadgets) without metadata leaks, v2.0 uses **XMPP (Extensible Messaging and Presence Protocol)** as a decentralized message broker.
- **De-coupled Signaling**: XMPP will notify devices of new "Sovereign Blobs" without needing a central push server.
- **Bi-Directional Inbound**: Third-party apps can "chat" encrypted data into your vault using your public key via a dedicated XMPP node.

## 🛤️ Developmental Fork
- **Branch**: `sovereign-core`
- **Audit Policy**: No major commits to this branch without explicit user approval.
