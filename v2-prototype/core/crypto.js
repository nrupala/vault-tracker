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

import { scrubMetadata } from './scrubber.js';

/**
 * Creates an "Atomic Vessel" - an independent, self-contained container
 * where even the metadata is hidden globally.
 */
export async function createHollowVessel(key, type, payload, tags = []) {
    let sanitizedPayload = payload;

    // If payload is a file-like object, scrub it
    if (payload instanceof Blob) {
        console.log(`Vault: Scrubbing [${type}] before sealing...`);
        sanitizedPayload = await scrubMetadata(payload);
    }

    const vesselData = {
        type,
        payload: sanitizedPayload,
        tags,
        timestamp: Date.now()
    };
    
    // In v2.1, we'll implement chunked encryption for large Blobs
    const serialized = (sanitizedPayload instanceof Blob) 
        ? await sanitizedPayload.text() 
        : JSON.stringify(vesselData);

    return await encryptSovereignBlob(key, serialized);
}

export async function verifyVesselIntegrity(key, ciphertext, iv) {
    try {
        await decryptSovereignBlob(key, ciphertext, iv);
        return true;
    } catch (e) {
        console.error("Vessel Integrity Violation:", e);
        return false;
    }
}
