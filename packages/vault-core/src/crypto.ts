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
