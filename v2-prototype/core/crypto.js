/**
 * Sovereign Core v2.0 - Crypto Engine (Buildless ESM)
 * Zero dependencies. Uses native Web Cryptography API.
 * PBKDF2: 600,000 iterations, AES-256-GCM
 */

const PBKDF2_ITERATIONS = 600000;
const CHALLENGE_MAGIC = "VAULT_OPEN_SESAME";

export async function deriveSovereignKey(password, salt) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

export async function encryptSovereignBlob(key, plaintext) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
    return { ciphertext, iv };
}

export async function decryptSovereignBlob(key, ciphertext, iv) {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
}

export async function verifyPassword(key) {
    try {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(CHALLENGE_MAGIC));
        const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, enc);
        return new TextDecoder().decode(dec) === CHALLENGE_MAGIC;
    } catch { return false; }
}

import { scrubMetadata } from './scrubber.js';

export async function createHollowVessel(key, type, payload, tags = [], priority = 'medium', color = 'none') {
    let sanitizedPayload = payload;
    if (payload instanceof Blob) sanitizedPayload = await scrubMetadata(payload);
    const vesselData = { type, payload: sanitizedPayload, tags, priority, color, isFlagged: false, timestamp: Date.now() };
    const serialized = (sanitizedPayload instanceof Blob) ? await sanitizedPayload.text() : JSON.stringify(vesselData);
    return await encryptSovereignBlob(key, serialized);
}

export async function verifyVesselIntegrity(key, ciphertext, iv) {
    try { await decryptSovereignBlob(key, ciphertext, iv); return true; } catch { return false; }
}
