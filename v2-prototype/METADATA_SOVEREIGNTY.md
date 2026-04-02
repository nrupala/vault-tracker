# 🕵️ Metadata Sovereignty: Transparency & Control (v2.0)

In the Sovereign Core, data is not just encrypted; it is **Scrubbed**. The user has absolute visibility and control over what "Shadow Data" (Metadata) follows their primary content.

---

## 1. Transparency Mode
Every **Hollow Vessel** in the vault will have a "Metadata Inspector."
- **Import Audit**: When a photo or contact is imported, the app lists all detected metadata (Location, Device ID, Timestamps).
- **Shadow Record**: The app shows what is being recorded locally vs. what will be encrypted in the vessel.

## 2. The Granular Scrubber
A built-in utility engine for in-browser metadata manipulation:
- **Media (EXIF)**: Ability to strip GPS, Camera Serial, and Software version before saving to the vault or sharing.
- **Contacts (VCard)**: Ability to mask "Notes" or "Relationship" fields while keeping the "Phone" and "Name."
- **Passkeys**: Visibility into the AAGUID (Authenticator Attestation GUID) and creation timestamps.

## 3. "Hollow Sharing" (Metadata Stripping on Export)
When a user shares an item (via XMPP or file), the app creates a "Hollow Export":
1.  **Clone Vessel**: Create a temporary copy.
2.  **Scrub**: Remove user-selected metadata fields.
3.  **Re-Encrypt**: Encrypt with the recipient's public key (or a temporary share key).

---

**Implementation**: A buildless ESM module `core/scrubber.js` will handle the parsing and stripping logic for standard formats (JPEG, VCF, etc.).
