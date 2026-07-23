/**
 * Zero-Trust Crypto Utility
 * 
 * Uses the native browser Web Crypto API to ensure no dependencies are required
 * and data never leaves the client unencrypted.
 */

// We use PBKDF2 to derive an AES-GCM key from a Master Password.
const ITERATIONS = 600000; 
const HASH = 'SHA-256';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Derives a cryptographic key from a password and salt.
 * Used for both creating a new vault and unlocking an existing one.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  
  // 1. Import password as base key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // 2. Derive the actual AES-GCM key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: HASH,
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // Keys cannot be extracted back to JS
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random salt for new vaults.
 */
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Encrypts a plaintext string (JSON payload) using the given key.
 * Returns the ciphertext containing the auth tag, and the initialization vector (nonce).
 */
export async function encryptData(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: ArrayBuffer; nonce: Uint8Array }> {
  const enc = new TextEncoder();
  const encoded = enc.encode(plaintext);
  
  // AES-GCM requires a unique Initialization Vector (IV/Nonce) for every encryption
  const nonce = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: nonce,
    },
    key,
    encoded
  );

  return { ciphertext, nonce };
}

/**
 * Decrypts a ciphertext using the given key and nonce.
 * Throws if the key is wrong or data was tampered with (thanks to GCM Auth Tag).
 */
export async function decryptData(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  nonce: Uint8Array
): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: nonce as BufferSource,
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

/**
 * Validates a password by attempting to derive a key and verify a known challenge payload.
 * When a vault is created, we encrypt a specific 'magic string' using the derived key.
 * On subsequent logins, if decrypting that string succeeds, the password is correct.
 */
export async function verifyPassword(
  password: string,
  salt: Uint8Array,
  challengeNonce: Uint8Array,
  challengeCiphertext: ArrayBuffer
): Promise<CryptoKey> {
  const key = await deriveKey(password, salt);
  try {
    const magicString = await decryptData(key, challengeCiphertext, challengeNonce);
    if (magicString === 'VAULT_OPEN_SESAME') {
      return key;
    }
    throw new Error('Invalid magic string');
  } catch (e) {
    throw new Error('Invalid master password');
  }
}

/**
 * Helper to create the verification payload when setting up a new vault.
 */
export async function generateVerificationPayload(key: CryptoKey): Promise<{
  challengeCiphertext: ArrayBuffer;
  challengeNonce: Uint8Array;
}> {
  const magicString = 'VAULT_OPEN_SESAME';
  const { ciphertext, nonce } = await encryptData(key, magicString);
  return {
    challengeCiphertext: ciphertext,
    challengeNonce: nonce,
  };
}

// ---------------------------------------------------------------------------
// DEK (Data-Encryption-Key) model — v2 key architecture.
//
// Items are encrypted under a random DEK. The DEK is wrapped (encrypted) by a
// KEK derived from the master password, and INDEPENDENTLY by a KEK derived from
// a one-time recovery key. This lets the user recover data with the recovery key
// without the password, and rotate the password by simply re-wrapping the DEK
// (no item re-encryption). deriveKey() produces the KEKs; the DEK is imported as
// a non-extractable AES-GCM key for item encrypt/decrypt — so useItems keeps its
// existing CryptoKey interface unchanged (the key it receives is now the DEK).
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Generate a fresh random 256-bit data-encryption key (raw bytes). */
export function generateDEK(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(32));
}

/** Import raw DEK bytes as a non-extractable AES-GCM key used to encrypt items. */
export function importDEK(raw: Uint8Array): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: ALGORITHM },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
}

/** Wrap (encrypt) the DEK under a KEK derived from a password or recovery key. */
export async function wrapDEK(
  kek: CryptoKey,
  dek: Uint8Array
): Promise<{ ciphertext: ArrayBuffer; nonce: Uint8Array }> {
  return encryptData(kek, bytesToBase64(dek));
}

/** Unwrap (decrypt) the DEK. Throws (GCM auth failure) if the KEK is wrong. */
export async function unwrapDEK(
  kek: CryptoKey,
  ciphertext: ArrayBuffer,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const b64 = await decryptData(kek, ciphertext, nonce);
  return base64ToBytes(b64);
}

// Recovery key: 20 random bytes (160-bit) rendered as base32, grouped for
// legibility (e.g. "K7Q2M-9F3XT-..."). Shown ONCE at vault creation/upgrade.
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Generate a human-transcribable one-time recovery key. */
export function generateRecoveryKey(): string {
  const raw = window.crypto.getRandomValues(new Uint8Array(20));
  const b32 = base32Encode(raw); // 32 chars
  return (b32.match(/.{1,5}/g) || []).join('-');
}

/** Normalize a user-entered recovery key (strip spaces/dashes, uppercase). */
export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}
