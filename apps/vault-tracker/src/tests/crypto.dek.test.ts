import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  generateSalt,
  encryptData,
  decryptData,
  generateDEK,
  importDEK,
  wrapDEK,
  unwrapDEK,
  generateRecoveryKey,
  normalizeRecoveryKey,
} from '@/lib/core';

describe('DEK key architecture (v2 recovery model)', () => {
  it('wraps and unwraps the DEK under a password-derived KEK', async () => {
    const salt = generateSalt();
    const kek = await deriveKey('correct horse battery', salt);
    const dek = generateDEK();
    expect(dek.length).toBe(32);
    const { ciphertext, nonce } = await wrapDEK(kek, dek);
    const unwrapped = await unwrapDEK(kek, ciphertext, nonce);
    expect(Array.from(unwrapped)).toEqual(Array.from(dek));
  });

  it('generates a formatted recovery key that normalizes to 32 base32 chars', () => {
    const rk = generateRecoveryKey();
    expect(rk).toContain('-');
    expect(/^[A-Z2-7-]+$/.test(rk)).toBe(true);
    expect(normalizeRecoveryKey(rk).length).toBe(32);
    expect(normalizeRecoveryKey(rk.toLowerCase())).toBe(normalizeRecoveryKey(rk));
  });

  it('wraps and unwraps the DEK under a recovery-key-derived KEK', async () => {
    const dek = generateDEK();
    const rk = generateRecoveryKey();
    const rsalt = generateSalt();
    const rkek = await deriveKey(normalizeRecoveryKey(rk), rsalt);
    const { ciphertext, nonce } = await wrapDEK(rkek, dek);
    expect(Array.from(await unwrapDEK(rkek, ciphertext, nonce))).toEqual(Array.from(dek));
  });

  it('encrypts and decrypts an item payload under the imported DEK', async () => {
    const dekKey = await importDEK(generateDEK());
    const { ciphertext, nonce } = await encryptData(dekKey, JSON.stringify({ hello: 'world' }));
    expect(JSON.parse(await decryptData(dekKey, ciphertext, nonce)).hello).toBe('world');
  });

  it('rejects unwrap with the wrong password (GCM auth tag)', async () => {
    const salt = generateSalt();
    const dek = generateDEK();
    const { ciphertext, nonce } = await wrapDEK(await deriveKey('right', salt), dek);
    await expect(unwrapDEK(await deriveKey('wrong', salt), ciphertext, nonce)).rejects.toThrow();
  });

  it('rejects unwrap with the wrong recovery key', async () => {
    const dek = generateDEK();
    const rsalt = generateSalt();
    const { ciphertext, nonce } = await wrapDEK(
      await deriveKey(normalizeRecoveryKey(generateRecoveryKey()), rsalt),
      dek
    );
    const bad = await deriveKey(normalizeRecoveryKey(generateRecoveryKey()), rsalt);
    await expect(unwrapDEK(bad, ciphertext, nonce)).rejects.toThrow();
  });

  it('migration re-encrypt: item under the old password key decrypts identically under the DEK', async () => {
    const oldKek = await deriveKey('oldpw', generateSalt());
    const dekKey = await importDEK(generateDEK());
    const original = JSON.stringify({ note: 'legacy', n: 42 });
    const legacy = await encryptData(oldKek, original);
    const plain = await decryptData(oldKek, legacy.ciphertext, legacy.nonce);
    const migrated = await encryptData(dekKey, plain);
    expect(await decryptData(dekKey, migrated.ciphertext, migrated.nonce)).toBe(original);
  });
});
