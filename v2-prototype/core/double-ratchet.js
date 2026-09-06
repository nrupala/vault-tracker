/**
 * Sovereign Core v2.0 - Double Ratchet E2EE
 * Signal-style Double Ratchet built entirely on WebCrypto primitives.
 * Zero external dependencies. Node 20+ compatible (globalThis.crypto.subtle).
 *
 * Exports:
 *   generateDH()                      -> { publicKey: CryptoKey, privateKey: CryptoKey }
 *   encodePK(publicKey)               -> ArrayBuffer (raw P-256 point, wire format)
 *   decodePK(rawBytes)                -> CryptoKey
 *   class RatchetState                -> initAsAlice / initAsBob / ratchetEncrypt / ratchetDecrypt
 *
 * Wire contract (consumed by core/sync.js):
 *   ratchetEncrypt(plaintext)  -> { header: { dh: Uint8Array, n: Number, pn: Number }, ciphertext: Uint8Array, iv: Uint8Array }
 *   ratchetDecrypt(header, ciphertextBuffer, ivBuffer) -> Uint8Array (plaintext bytes)
 */

import { generateECDHKeyPair, importPublicKey, deriveSharedSecret, hkdf } from './crypto.js';

const ROOT_INFO = 'SovereignRatchetRK';

function ab2u8(buf) {
    if (buf instanceof Uint8Array) return buf;
    if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
    if (Array.isArray(buf)) return new Uint8Array(buf);
    return new Uint8Array(0);
}

function u8cat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}

async function hmacByte(keyBytes, byte) {
    const key = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new Uint8Array([byte]));
    return new Uint8Array(mac);
}

/** KDF_CK: advance a symmetric chain. Returns { nextCk, messageKey }. */
async function kdfCK(chainKey) {
    const messageKey = await hmacByte(chainKey, 0x02);
    const nextCk = await hmacByte(chainKey, 0x01);
    return { nextCk, messageKey };
}

/** KDF_RK: ratchet the root key over a DH output. Returns { rootKey, chainKey }. */
async function kdfRK(rootKey, dhOutput) {
    const out = await hkdf(new Uint8Array(dhOutput), rootKey, ROOT_INFO);
    const bytes = new Uint8Array(out);
    return { rootKey: bytes.slice(0, 32), chainKey: bytes.slice(32, 64) };
}

async function aesEncrypt(messageKey, plaintextBytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey(
        'raw', messageKey, { name: 'AES-GCM' }, false, ['encrypt']
    );
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes);
    return { ciphertext: new Uint8Array(ct), iv };
}

async function aesDecrypt(messageKey, ciphertextBytes, ivBytes) {
    const key = await crypto.subtle.importKey(
        'raw', messageKey, { name: 'AES-GCM' }, false, ['decrypt']
    );
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ciphertextBytes);
    return new Uint8Array(pt);
}

export async function generateDH() {
    return generateECDHKeyPair();
}

export async function encodePK(publicKey) {
    return crypto.subtle.exportKey('raw', publicKey);
}

export async function decodePK(rawBytes) {
    const bytes = ab2u8(rawBytes);
    return importPublicKey(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

export class RatchetState {
    constructor() {
        this.DHs = null;        // own keypair { publicKey, privateKey }
        this.DHr = null;        // remote public CryptoKey
        this.DHrRaw = null;     // remote raw bytes (for skip-key bookkeeping)
        this.RK = null;         // root key Uint8Array(32)
        this.CKs = null;        // sending chain key
        this.CKr = null;        // receiving chain key
        this.Ns = 0;
        this.Nr = 0;
        this.PN = 0;
        this.MKSKIPPED = new Map(); // "dhRawHex:n" -> messageKey
    }

    _rawOf(publicKeyOrRaw) {
        // Accept CryptoKey or raw bytes; return { cryptoKeyOrKeyPair, rawBytes }
        if (publicKeyOrRaw instanceof CryptoKey) return publicKeyOrRaw;
        return null;
    }

    /**
     * Alice side: I know the peer's public key. Derive the initial root key from
     * the vault shared secret, then ratchet it over our first DH output.
     */
    async initAsAlice(vaultSecret, peerPublicKey) {
        const peer = peerPublicKey instanceof CryptoKey
            ? peerPublicKey
            : await decodePK(peerPublicKey);
        this.DHs = await generateDH();
        this.DHr = peer;
        this.DHrRaw = new Uint8Array(await encodePK(peer));
        const sk = vaultSecret instanceof Uint8Array ? vaultSecret : new Uint8Array(vaultSecret);
        const rk0 = new Uint8Array(await hkdf(sk, undefined, 'SovereignRoot')).slice(0, 32);
        const shared = await deriveSharedSecret(this.DHs.privateKey, this.DHr);
        const stepped = await kdfRK(rk0, shared);
        this.RK = stepped.rootKey;
        this.CKs = stepped.chainKey;
        this.CKr = null;
        this.Ns = 0; this.Nr = 0; this.PN = 0;
    }

    /**
     * Bob side: I hold my long-term ratchet keypair. The remote public key is
     * unknown until the first incoming header arrives; the receiving chain is
     * established inside ratchetDecrypt.
     */
    async initAsBob(vaultSecret, bobKeyPair) {
        this.DHs = bobKeyPair;
        this.DHr = null;
        this.DHrRaw = null;
        const sk = vaultSecret instanceof Uint8Array ? vaultSecret : new Uint8Array(vaultSecret);
        const rk0 = new Uint8Array(await hkdf(sk, undefined, 'SovereignRoot'));
        this.RK = rk0.slice(0, 32);
        this.CKs = null;
        this.CKr = null;
        this.Ns = 0; this.Nr = 0; this.PN = 0;
    }

    async ratchetEncrypt(plaintext) {
        if (!this.CKs) throw new Error('Ratchet: sending chain not initialized');
        const pt = typeof plaintext === 'string'
            ? new TextEncoder().encode(plaintext)
            : plaintext instanceof Uint8Array ? plaintext : new Uint8Array(plaintext);
        const { nextCk, messageKey } = await kdfCK(this.CKs);
        this.CKs = nextCk;
        const header = {
            dh: new Uint8Array(await encodePK(this.DHs.publicKey)),
            n: this.Ns,
            pn: this.PN
        };
        const { ciphertext, iv } = await aesEncrypt(messageKey, pt);
        this.Ns += 1;
        return { header, ciphertext, iv };
    }

    /**
     * Full DH ratchet step (per the Double Ratchet specification):
     *   PN = Nr; Nr = 0; Ns = 0
     *   DHr = header.dh
     *   RK, CKr = KDF_RK(RK, DH(DHs_OLD, DHr))   <- matches the sender's chain
     *   DHs = GENERATE_DH()
     *   RK, CKs = KDF_RK(RK, DH(DHs_NEW, DHr))
     * The receiving chain MUST be derived with the pre-existing DHs — deriving it
     * with a fresh keypair diverges from the remote sender's root ratchet.
     */
    async _dhStep(remoteRaw) {
        this.PN = this.Nr;
        this.Nr = 0;
        this.Ns = 0;
        this.DHrRaw = remoteRaw instanceof Uint8Array ? remoteRaw : new Uint8Array(remoteRaw);
        this.DHr = await decodePK(remoteRaw);
        const sharedRecv = await deriveSharedSecret(this.DHs.privateKey, this.DHr);
        const sRecv = await kdfRK(this.RK, sharedRecv);
        this.RK = sRecv.rootKey;
        this.CKr = sRecv.chainKey;
        const newPair = await generateDH();
        const sharedSend = await deriveSharedSecret(newPair.privateKey, this.DHr);
        const sSend = await kdfRK(this.RK, sharedSend);
        this.RK = sSend.rootKey;
        this.CKs = sSend.chainKey;
        this.DHs = newPair;
    }

    async _trySkipped(header, ciphertextBytes, ivBytes) {
        const hex = Array.from(header.dh).map(b => b.toString(16).padStart(2, '0')).join('');
        const key = `${hex}:${header.n}`;
        const mk = this.MKSKIPPED.get(key);
        if (!mk) return null;
        this.MKSKIPPED.delete(key);
        return aesDecrypt(mk, ciphertextBytes, ivBytes);
    }

    async _skipKeys(remoteRaw, until) {
        if (!this.CKr) return;
        const hex = Array.from(remoteRaw).map(b => b.toString(16).padStart(2, '0')).join('');
        while (this.Nr < until) {
            const { nextCk, messageKey } = await kdfCK(this.CKr);
            this.CKr = nextCk;
            this.MKSKIPPED.set(`${hex}:${this.Nr}`, messageKey);
            this.Nr += 1;
            if (this.MKSKIPPED.size > 256) {
                const oldest = this.MKSKIPPED.keys().next().value;
                this.MKSKIPPED.delete(oldest);
            }
        }
    }

    async ratchetDecrypt(header, ciphertext, iv) {
        const ctBytes = ab2u8(ciphertext);
        const ivBytes = ab2u8(iv);
        const dhBytes = ab2u8(header.dh);

        const skipped = await this._trySkipped(header, ctBytes, ivBytes);
        if (skipped) return skipped;

        // Establish/ratchet the receiver chain: first contact (CKr null) and any
        // remote DH key change both take the full DH ratchet step.
        const sameDh = this.DHrRaw && dhBytes.length === this.DHrRaw.length &&
            dhBytes.every((b, i) => b === this.DHrRaw[i]);
        if (!this.CKr || !sameDh) {
            if (this.DHrRaw && !sameDh) {
                await this._skipKeys(this.DHrRaw, header.pn);
            }
            await this._dhStep(dhBytes);
            await this._skipKeys(dhBytes, header.n);
        } else if (this.Nr < header.n) {
            await this._skipKeys(dhBytes, header.n);
        }

        if (!this.CKr) throw new Error('Ratchet: receiving chain not initialized');
        const { nextCk, messageKey } = await kdfCK(this.CKr);
        this.CKr = nextCk;
        this.Nr = Math.max(this.Nr, header.n) + 1;
        return aesDecrypt(messageKey, ctBytes, ivBytes);
    }
}