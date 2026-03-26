/**
 * Sovereign Core v2.0 - Crypto Engine (Buildless ESM)
 * Zero dependencies. Uses native Web Cryptography API.
 */

export async function deriveSovereignKey(password, salt) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        "raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

export async function encryptSovereignBlob(key, plaintext) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, encoder.encode(plaintext)
    );

    return { ciphertext, iv };
}

export async function decryptSovereignBlob(key, ciphertext, iv) {
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

/**
 * Creates an "Atomic Vessel" - an independent, self-contained container
 * where even the metadata is hidden globally.
 */
export async function createHollowVessel(key, type, payload, tags = []) {
    const vesselData = {
        type,
        payload,
        tags,
        timestamp: Date.now()
    };
    
    return await encryptSovereignBlob(key, JSON.stringify(vesselData));
}
