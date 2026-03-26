# 🏺 The Hollow Vessel Architecture (v2.0)

To achieve the user's vision of total sovereignty, Vault Tracker v2.0 adopts the **Hollow Vessel** strategy. To an outsider—be it a cloud provider, an XMPP broker, or a hacker—your data is not a database; it is a collection of fragmented, meaningless, and self-contained "hollow containers."

---

## 1. Atomic Encryption (The Vessel)
In v1.x, we encrypt the `payload`. In v2.0, we treat **every entry** as an independent container.
- **Zero Metadata Leak**: Properties like `type`, `priority`, `tags`, and even `updatedAt` are moved **inside** the encrypted blob.
- **The Outside View**: All the provider sees is a `uuid` and a `timestamp`. They cannot distinguish a 10MB Note from a 1KB Task.

## 2. Independent Self-Sustainment
Each "Hollow Vessel" contains:
- Its own unique **Initialization Vector (IV)**.
- A **MAC (Message Authentication Code)** to prevent tampering.
- A **Header Byte** (Encrypted) that tells the *app* how to parse the payload (Task, Note, Habit, etc.).

## 3. The "Hollow" Network (E2EE Signal Bus)
When using XMPP or HTTPS to sync, the protocol is just a "Hollow Channel."
- **HTTPS/TLS**: Protects the tunnel.
- **Sovereign Encryption**: Protects the vessel *before* it enters the tunnel.
- **Zero Knowledge**: Even if the XMPP server is malicious, it only sees "UUID 'X' moved from User A to User B." It has no idea what is being moved or why.

## 4. Feasibility Check
This is not only feasible; it is the **Gold Standard** of privacy. It requires slightly more CPU for individual encryption/decryption tasks, but modern gadgets (even watches) handle AES-GCM at hardware speeds.

---

**Slogan Verification**: *Sync with Your Keys. Rule Your Hollow Vessels.*
