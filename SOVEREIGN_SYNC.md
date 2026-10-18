# 🔄 The Universal Sovereign Sync Pattern

The vault utilizes a **Provider-Agnostic** synchronization architecture. We do not lock the user into a single cloud; rather, we provide a unified interface for "Encrypted Blob Interchange."

---

## 🏗️ The Adapter Architecture
The application treats every external storage option as a simple **Blob Sink**.

### 1. The Interface
Every provider (Google Drive, OneDrive, Local FileSystem API, WebDAV) implements a standard protocol:
- **`authorize()`**: Handles OAuth or API Key handshakes.
- **`write(blob)`**: Pushes the latest encrypted vault state.
- **`read()`**: Pulls the remote blob for local decryption and merge.
- **`inboundSweep()`**: Checks a specific 'Inbox' folder for third-party encrypted entries.

### 2. Supported Providers (Roadmap)
- **Local Browser FS**: Uses the `window.showSaveFilePicker` API to sync to a local folder on your computer.
- **Google Drive / OneDrive**: Uses native OAuth to store blobs in an "App Data" folder (invisible to other apps).
- **WebDAV / NextCloud**: Standard protocol for self-hosted enthusiasts.
- **AWS S3 / Cloudflare R2**: High-performance object storage for professional users.

---

## 🔐 The "Unbreakable Blob" Format
Data is never synced as plaintext. The structure of a "Sovereign Sync Blob" is:
1.  **Magic Header**: `VT_VAULT_v1`
2.  **Metadata (Unencrypted)**: Vault ID, Version Number, Timestamp.
3.  **Encrypted Payload**: AES-256-GCM encrypted JSON dump of the IndexedDB.
4.  **HMAC Signature**: Ensures the blob hasn't been tampered with by the provider.

---

## 🔗 "Sovereign Dropbox" for Inbound Data
For external apps, the vault generates a **"One-Way Public Key"**. 
- External apps encrypt their data with this key.
- They drop the payload into your provider's "Inbox" folder.
- The Vault "sweeps" this folder, decrypts the contents with your **Private Key**, and incorporates them into your ledger or tasks.

## Storage Standard Note (2026-10-18)

The sync payload described above is a dump of the app's current local store. **Storage standard (decided 2026-10-18):** the vault family stores its data in SQLite with SQLCipher (since v1.2.0; migrated from IndexedDB (Dexie.js)) — the whole database file is encrypted with AES-256 under a device key held in the phone's Keystore, and every item payload is additionally sealed with AES-256-GCM under keys derived from your master password; no key ever leaves your device. Existing installs migrate their IndexedDB data automatically on first launch of v1.2.0 — a rescue snapshot is taken first and the copy is verified before the switch; the old data is left untouched as a fallback for this release.
