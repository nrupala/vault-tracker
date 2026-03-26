import { describe, it, expect, beforeEach } from 'vitest';
import { encryptData, decryptData } from '@/lib/core';

// Stress Test: Simulating high-volume local encryption/decryption
describe('Vault Stress Test', () => {
    let key: CryptoKey;
    const password = 'master-password-123';
    const salt = new Uint8Array(16);

    beforeEach(async () => {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    });

    it('should handle 1000 items without significant lag', async () => {
        const start = performance.now();
        const itemCount = 1000;
        const results = [];

        for (let i = 0; i < itemCount; i++) {
            const payload = JSON.stringify({ title: `Item ${i}`, content: 'Secure content' });
            const encrypted = await encryptData(key, payload);
            results.push(encrypted);
        }
        
        const encryptionTime = performance.now() - start;
        console.log(`Encryption of ${itemCount} items took ${encryptionTime.toFixed(2)}ms`);
        expect(encryptionTime).toBeLessThan(5000); // Should be well under 5s

        const decryptStart = performance.now();
        for (const res of results) {
            await decryptData(key, res.ciphertext, res.nonce);
        }
        const decryptionTime = performance.now() - decryptStart;
        console.log(`Decryption of ${itemCount} items took ${decryptionTime.toFixed(2)}ms`);
        expect(decryptionTime).toBeLessThan(5000);
    });

    it('should fail gracefully on incorrect key', async () => {
        const payload = 'Secret message';
        const { ciphertext, nonce } = await encryptData(key, payload);

        // Derive a different key
        const wrongKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            await crypto.subtle.importKey('raw', new TextEncoder().encode('wrong-pass'), 'PBKDF2', false, ['deriveKey']),
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        await expect(decryptData(wrongKey, ciphertext, nonce)).rejects.toThrow();
    });
});
