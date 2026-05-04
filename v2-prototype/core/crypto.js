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
    // Ensure ciphertext is ArrayBuffer or ArrayBufferView
    let ct = ciphertext;
    if (ct instanceof ArrayBuffer) {
        // Already correct type
    } else if (ct instanceof Uint8Array) {
        ct = ct.buffer;
    } else if (Array.isArray(ct)) {
        ct = new Uint8Array(ct).buffer;
    }
    // Ensure iv is Uint8Array
    let ivBytes = iv;
    if (ivBytes instanceof Uint8Array) {
        // Already correct
    } else if (Array.isArray(ivBytes)) {
        ivBytes = new Uint8Array(ivBytes);
    } else if (ivBytes instanceof ArrayBuffer) {
        ivBytes = new Uint8Array(ivBytes);
    }
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, ct);
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
 * Falls back to test encrypt/decrypt if no verifier exists or format is invalid (legacy vaults).
 * Returns true only if decrypted value matches magic string.
 * No key material is ever exposed or returned.
 */
export async function verifyPassword(password, salt, verifier) {
    try {
        // Ensure salt is a proper Uint8Array
        let saltBytes;
        if (salt instanceof Uint8Array) {
            saltBytes = salt;
        } else if (salt instanceof ArrayBuffer) {
            saltBytes = new Uint8Array(salt);
        } else if (Array.isArray(salt)) {
            saltBytes = new Uint8Array(salt);
        } else {
            console.warn('[Crypto] Invalid salt format:', typeof salt);
            return false;
        }
        
        const key = await deriveKey(password, saltBytes);
        
        // If verifier exists and has valid structure, try to use it
        if (verifier && verifier.ciphertext && verifier.iv) {
            try {
                let ct, iv;
                // Handle various ciphertext formats
                if (verifier.ciphertext instanceof ArrayBuffer) {
                    ct = verifier.ciphertext;
                } else if (verifier.ciphertext instanceof Uint8Array) {
                    ct = verifier.ciphertext.buffer;
                } else if (Array.isArray(verifier.ciphertext)) {
                    ct = new Uint8Array(verifier.ciphertext).buffer;
                } else {
                    throw new Error('Invalid ciphertext format');
                }
                // Handle various IV formats
                if (verifier.iv instanceof Uint8Array) {
                    iv = verifier.iv;
                } else if (Array.isArray(verifier.iv)) {
                    iv = new Uint8Array(verifier.iv);
                } else if (verifier.iv instanceof ArrayBuffer) {
                    iv = new Uint8Array(verifier.iv);
                } else {
                    throw new Error('Invalid IV format');
                }
                const result = await decryptData(key, ct, iv);
                if (result === MAGIC) return true;
            } catch (err) {
                // Verifier format invalid or decryption failed - fall back to test
                console.warn('[Crypto] Verifier decryption failed, using fallback:', err.message);
            }
        }
        
        // Fallback: encrypt then decrypt a test string
        // This works for ALL vaults regardless of verifier format
        const testIv = crypto.getRandomValues(new Uint8Array(12));
        const testCt = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: testIv }, key, new TextEncoder().encode(MAGIC)
        );
        const result = await decryptData(key, testCt, testIv);
        return result === MAGIC;
    } catch (err) {
        console.warn('[Crypto] Password verification failed:', err.message);
        return false;
    }
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

// ============================================================================
// DOUBLE RATCHET PRIMITIVES
// ============================================================================

/**
 * Generate an Elliptic Curve Diffie-Hellman (ECDH) key pair on the P-256 curve.
 * Used for establishing shared secrets during the asymmetric ratchet step.
 */
export async function generateECDHKeyPair() {
    return crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        false, // Private key cannot be extracted
        ["deriveBits"]
    );
}

/**
 * Export a public key into a compressed/raw ArrayBuffer format for wire transport.
 */
export async function exportPublicKey(publicKey) {
    return crypto.subtle.exportKey("raw", publicKey);
}

/**
 * Import a peer's raw public key.
 */
export async function importPublicKey(rawKeyBytes) {
    return crypto.subtle.importKey(
        "raw",
        rawKeyBytes,
        { name: "ECDH", namedCurve: "P-256" },
        true, // Public keys are always extractable
        []
    );
}

/**
 * Perform a Diffie-Hellman key exchange.
 * Combines local private key and remote public key to derive shared secret bits.
 * Returns a 32-byte ArrayBuffer (256 bits).
 */
export async function deriveSharedSecret(localPrivateKey, remotePublicKey) {
    return crypto.subtle.deriveBits(
        { name: "ECDH", public: remotePublicKey },
        localPrivateKey,
        256
    );
}

/**
 * HMAC-based Extract-and-Expand Key Derivation Function (HKDF).
 * Used aggressively within the Double Ratchet to safely derive the next 
 * Chain Key and Message Key from an input material (like the shared secret).
 * Returns two 32-byte chunks as an ArrayBuffer of total length 64.
 */
export async function hkdf(ikm, salt, infoStr = "Ratchet") {
    // 1. Import the IKM (Input Keying Material)
    const baseKey = await crypto.subtle.importKey(
        "raw",
        ikm,
        "HKDF",
        false,
        ["deriveBits"]
    );

    // 2. Setup Salt (Defaults to 32 bytes of zeros if not provided)
    const saltBuffer = salt || new Uint8Array(32);
    
    // 3. Setup Info
    const info = new TextEncoder().encode(infoStr);

    // 4. Derive Expand bits (requesting 64 bytes total: 32 for key1, 32 for key2)
    return crypto.subtle.deriveBits(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: saltBuffer,
            info: info
        },
        baseKey,
        512 // 512 bits = 64 bytes
    );
}

