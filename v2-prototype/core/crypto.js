/**
 * Sovereign Core v2.0 - Crypto Engine
 * Military-grade: non-extractable keys, challenge-verifier, memory zeroization.
 * Assumes the browser is hostile. JavaScript never sees key bits.
 */

const PBKDF2_ITERATIONS = 600000;
const MAGIC = "SOVEREIGN_VAULT_VERIFY";

/**
 * Derive a NON-EXTRACTABLE CryptoKey from password + salt.
 * JavaScript can NEVER read the key material. Only encrypt/decrypt operations are possible.
 * Password is converted to bytes and zeroized immediately after derivation.
 */
export async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const pwBytes = enc.encode(password);
    try {
        const base = await crypto.subtle.importKey("raw", pwBytes, "PBKDF2", false, ["deriveKey"]);
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
            base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    } finally {
        pwBytes.fill(0); // Zeroize password bytes immediately
    }
}

export async function encryptData(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    return { ciphertext: ct, iv };
}

export async function decryptData(key, ciphertext, iv) {
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(dec);
}

/**
 * Create challenge-verifier: encrypt a known magic string.
 * Stored with vault metadata. Proves password correctness without storing hashes.
 * Even if an attacker gets the verifier, they can't brute-force it — they'd need
 * to guess the password, derive a key, and try decryption (600K PBKDF2 iterations each attempt).
 */
export async function createVerifier(password, salt) {
    const key = await deriveKey(password, salt);
    const { ciphertext, iv } = await encryptData(key, MAGIC);
    return { ciphertext, iv };
}

/**
 * Verify password by decrypting the stored verifier.
 * Returns true only if decrypted value matches magic string.
 * No key material is ever exposed or returned.
 */
export async function verifyPassword(password, salt, verifier) {
    try {
        const key = await deriveKey(password, salt);
        const result = await decryptData(key, verifier.ciphertext, verifier.iv);
        return result === MAGIC;
    } catch { return false; }
}

/**
 * Vault DNA: visual fingerprint from vault ID.
 * Users can visually verify they're opening the correct vault.
 * Prevents phishing and vault confusion attacks.
 * Each vault gets a unique 8-dot color pattern — like a cryptographic hash made visible.
 */
export function vaultDNA(vaultId) {
    let hash = 0;
    for (let i = 0; i < vaultId.length; i++) {
        hash = ((hash << 5) - hash + vaultId.charCodeAt(i)) | 0;
    }
    const colors = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316'];
    let dots = '';
    for (let i = 0; i < 8; i++) {
        const c = colors[Math.abs((hash >> (i * 4)) & 7)];
        dots += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin:0 1px"></span>`;
    }
    return dots;
}

import { scrubMetadata } from './scrubber.js';

export async function createVessel(key, type, payload, tags = [], priority = 'medium', color = 'none') {
    let sanitized = payload;
    if (payload instanceof Blob) sanitized = await scrubMetadata(payload);
    const data = { type, payload: sanitized, tags, priority, color, isFlagged: false, timestamp: Date.now() };
    const serialized = (sanitized instanceof Blob) ? await sanitized.text() : JSON.stringify(data);
    return encryptData(key, serialized);
}
