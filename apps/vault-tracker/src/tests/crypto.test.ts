import { describe, it, expect } from 'vitest';
import { deriveKey, encryptData, decryptData } from '@/lib/core';

describe('Crypto module (Zero-Trust Logic)', () => {
  const password = 'extremely-secure-password';
  const salt = new TextEncoder().encode('constant-salt-for-test');

  it('should derive a stable key from password and salt', async () => {
    const key1 = await deriveKey(password, salt);
    const key2 = await deriveKey(password, salt);
    
    expect(key1).toBeInstanceOf(CryptoKey);
    expect(key2).toBeInstanceOf(CryptoKey);
  });

  it('should encrypt and decrypt data correctly', async () => {
    const key = await deriveKey(password, salt);
    const originalText = 'Hello, Vault Tracker! This is a secret message.';
    
    const { ciphertext, nonce } = await encryptData(key, originalText);
    expect(ciphertext).not.toBe(originalText);
    
    const decryptedText = await decryptData(key, ciphertext, nonce);
    expect(decryptedText).toBe(originalText);
  });

  it('should fail to decrypt with the wrong key', async () => {
    const key1 = await deriveKey(password, salt);
    const key2 = await deriveKey('wrong-password', salt);
    const originalText = 'Secret';
    
    const { ciphertext, nonce } = await encryptData(key1, originalText);
    
    await expect(decryptData(key2, ciphertext, nonce)).rejects.toThrow();
  });
});
