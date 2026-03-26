# 📡 Sovereign Communication v2.0: The XMPP Signal Bus

To ensure absolute privacy and decentralization, Vault Tracker v2.0 uses **XMPP (Stanza-based Messaging)** for real-time interaction between gadgets and third-party apps.

---

## 1. Decentralized Signaling
Unlike Firebase or OneSignal, XMPP requires no central metadata tracking.
- **Protocol**: XMPP (RFC 6120).
- **Transport**: WebSockets (WS) or BOSH (HTTP Long-Polling).
- **Role**: A "Presence & Signal" bus. It tells your phone "The Vault has been updated on your Laptop" via an encrypted stanza.

## 2. Inbound Sovereign Inboxes (Webhooks)
Third-party apps (Mail, Ledger providers) can integrate without knowing your vault structure:
1.  **Public Key Push**: The user provides a Public Key and an XMPP JID (e.g., `user@sovereign.vault`).
2.  **Encrypted Stanza**: The third-party app sends an encrypted `<message>` stanza containing a Task or Note.
3.  **Local Sweep**: The Vault Tracker app receives the stanza, decrypts it locally, and merges it into the SQLite database.

## 3. The Signal Bus Advantage
- **Zero Metadata Leak**: The XMPP server only sees encrypted blobs moving between JIDs.
- **Gadget Native**: XMPP is lightweight enough to run on a Watch or a Phone background process.
- **Open Standard**: You can use *any* XMPP server (Snikket, Ejabberd, Prosody).

---

**Implementation**: v2.0 will use a lightweight, zero-dependency XMPP client module (Buildless).
