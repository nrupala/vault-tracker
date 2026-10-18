// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Binary / row codec for the SQLite storage engine.
 *
 * The @capacitor-community/sqlite bridge is string-based (JSON), so binary
 * fields (salts, nonces, AES-GCM ciphertexts) cross it as base64 strings.
 * Binary columns are declared with BLOB affinity and hold that base64 text —
 * the encoding is therefore byte-identical on every platform (Android
 * SQLCipher file, jeep-sqlite/sql.js on web). ALL conversions live here:
 * call sites and hooks only ever see the record types from ./types.
 */
import type { EncryptedItem, Vault, VaultSettings } from './types';

/** A value as stored in / returned from a SQLite row. */
export type SqlRow = Record<string, string | number | null>;

type BytesLike = Uint8Array | ArrayBuffer | ArrayBufferView;

/** Copy any binary value into a fresh Uint8Array. */
export function toBytes(value: BytesLike): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/** Copy any binary value into a fresh ArrayBuffer (for ArrayBuffer-typed fields). */
export function toArrayBuffer(value: BytesLike): ArrayBuffer {
  const bytes = toBytes(value);
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Normalize a value read back from SQLite (or a snapshot) into bytes.
 * Accepts base64 strings (the bridge format), Uint8Array / ArrayBuffer
 * (sql.js returns real bytes for true BLOBs), and plain number arrays.
 */
export function blobToBytes(value: unknown): Uint8Array | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return base64ToBytes(value);
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return toBytes(value as BytesLike);
  }
  if (Array.isArray(value)) return new Uint8Array(value as number[]);
  return undefined;
}

function encBin(value: BytesLike): string {
  return bytesToBase64(toBytes(value));
}

function encBinOpt(value: BytesLike | undefined): string | null {
  return value === undefined ? null : encBin(value);
}

function decBin(value: unknown, field: string): Uint8Array {
  const bytes = blobToBytes(value);
  if (!bytes) throw new Error(`Storage codec: missing binary field ${field}`);
  return bytes;
}

function decBinOpt(value: unknown): Uint8Array | undefined {
  return blobToBytes(value);
}

// ---------------------------------------------------------------------------
// Binary-aware JSON (used for the item history array and rescue snapshots,
// where binary fields are nested inside plain objects).
// ---------------------------------------------------------------------------

const BIN_MARKER = '__vt_bin';

export function encodeBinaryJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v instanceof Uint8Array || v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
      return { [BIN_MARKER]: encBin(v as BytesLike) };
    }
    return v;
  });
}

export function decodeBinaryJson(text: string): unknown {
  return JSON.parse(text, (_key, v: unknown) => {
    if (
      v !== null &&
      typeof v === 'object' &&
      Object.keys(v as object).length === 1 &&
      typeof (v as Record<string, unknown>)[BIN_MARKER] === 'string'
    ) {
      return base64ToBytes((v as Record<string, string>)[BIN_MARKER]);
    }
    return v;
  });
}

// ---------------------------------------------------------------------------
// Row mapping: Vault
// ---------------------------------------------------------------------------

export function vaultToRow(v: Vault): SqlRow {
  return {
    id: v.id,
    name: v.name,
    salt: encBin(v.salt),
    challengeCiphertext: encBin(v.challengeCiphertext),
    challengeNonce: encBin(v.challengeNonce),
    createdAt: v.createdAt,
    keyVersion: v.keyVersion ?? null,
    dekWrappedByPassword: encBinOpt(v.dekWrappedByPassword),
    dekPasswordNonce: encBinOpt(v.dekPasswordNonce),
    dekWrappedByRecovery: encBinOpt(v.dekWrappedByRecovery),
    dekRecoveryNonce: encBinOpt(v.dekRecoveryNonce),
    recoverySalt: encBinOpt(v.recoverySalt),
  };
}

export function rowToVault(row: SqlRow): Vault {
  const vault: Vault = {
    id: String(row.id),
    name: String(row.name),
    salt: decBin(row.salt, 'vault.salt'),
    challengeCiphertext: toArrayBuffer(decBin(row.challengeCiphertext, 'vault.challengeCiphertext')),
    challengeNonce: decBin(row.challengeNonce, 'vault.challengeNonce'),
    createdAt: Number(row.createdAt),
  };
  if (row.keyVersion !== null && row.keyVersion !== undefined) vault.keyVersion = Number(row.keyVersion);
  const dwp = decBinOpt(row.dekWrappedByPassword);
  if (dwp) vault.dekWrappedByPassword = toArrayBuffer(dwp);
  const dpn = decBinOpt(row.dekPasswordNonce);
  if (dpn) vault.dekPasswordNonce = dpn;
  const dwr = decBinOpt(row.dekWrappedByRecovery);
  if (dwr) vault.dekWrappedByRecovery = toArrayBuffer(dwr);
  const drn = decBinOpt(row.dekRecoveryNonce);
  if (drn) vault.dekRecoveryNonce = drn;
  const rs = decBinOpt(row.recoverySalt);
  if (rs) vault.recoverySalt = rs;
  return vault;
}

// ---------------------------------------------------------------------------
// Row mapping: EncryptedItem
// ---------------------------------------------------------------------------

export function itemToRow(item: EncryptedItem): SqlRow {
  return {
    id: item.id,
    vaultId: item.vaultId,
    type: item.type,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    priority: item.priority,
    isFlagged: item.isFlagged ? 1 : 0,
    color: item.color ?? null,
    tags: JSON.stringify(item.tags ?? []),
    encryptedPayload: encBin(item.encryptedPayload),
    nonce: encBin(item.nonce),
    v: item.v ?? 1,
    history: item.history ? encodeBinaryJson(item.history) : null,
  };
}

export function rowToItem(row: SqlRow): EncryptedItem {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(String(row.tags ?? '[]'));
    if (Array.isArray(parsed)) tags = parsed as string[];
  } catch {
    tags = [];
  }
  const item: EncryptedItem = {
    id: String(row.id),
    vaultId: String(row.vaultId),
    type: String(row.type) as EncryptedItem['type'],
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    priority: String(row.priority) as EncryptedItem['priority'],
    isFlagged: Number(row.isFlagged) === 1,
    tags,
    encryptedPayload: toArrayBuffer(decBin(row.encryptedPayload, 'item.encryptedPayload')),
    nonce: decBin(row.nonce, 'item.nonce'),
    v: row.v === null || row.v === undefined ? 1 : Number(row.v),
  };
  if (row.color !== null && row.color !== undefined) {
    item.color = String(row.color) as EncryptedItem['color'];
  }
  if (row.history !== null && row.history !== undefined) {
    const history = decodeBinaryJson(String(row.history)) as EncryptedItem['history'];
    if (Array.isArray(history)) {
      // History payloads are ArrayBuffer-typed; the JSON codec yields bytes.
      item.history = history.map((h) => ({
        v: h.v,
        payload: toArrayBuffer(h.payload as unknown as BytesLike),
        nonce: h.nonce,
        updatedAt: h.updatedAt,
      }));
    }
  }
  return item;
}

// ---------------------------------------------------------------------------
// Row mapping: VaultSettings
// ---------------------------------------------------------------------------

export function settingsToRow(s: VaultSettings): SqlRow {
  return {
    id: s.id,
    historyLimit: s.historyLimit,
    retentionDays: s.retentionDays,
    autoArchiveCompleted: s.autoArchiveCompleted ? 1 : 0,
    archiveAfterDays: s.archiveAfterDays,
  };
}

export function rowToSettings(row: SqlRow): VaultSettings {
  return {
    id: String(row.id),
    historyLimit: Number(row.historyLimit),
    retentionDays: Number(row.retentionDays),
    autoArchiveCompleted: Number(row.autoArchiveCompleted) === 1,
    archiveAfterDays: Number(row.archiveAfterDays),
  };
}

// ---------------------------------------------------------------------------
// Record normalization: rescue snapshots decoded from JSON carry Uint8Array
// for every binary field. These helpers restore the declared field types
// (ArrayBuffer where the record type says ArrayBuffer) so restored records
// are indistinguishable from records read from a live store.
// ---------------------------------------------------------------------------

export function normalizeVault(vault: Vault): Vault {
  const out: Vault = {
    ...vault,
    salt: toBytes(vault.salt),
    challengeCiphertext: toArrayBuffer(vault.challengeCiphertext),
    challengeNonce: toBytes(vault.challengeNonce),
  };
  if (vault.dekWrappedByPassword) out.dekWrappedByPassword = toArrayBuffer(vault.dekWrappedByPassword);
  if (vault.dekPasswordNonce) out.dekPasswordNonce = toBytes(vault.dekPasswordNonce);
  if (vault.dekWrappedByRecovery) out.dekWrappedByRecovery = toArrayBuffer(vault.dekWrappedByRecovery);
  if (vault.dekRecoveryNonce) out.dekRecoveryNonce = toBytes(vault.dekRecoveryNonce);
  if (vault.recoverySalt) out.recoverySalt = toBytes(vault.recoverySalt);
  return out;
}

export function normalizeItem(item: EncryptedItem): EncryptedItem {
  const out: EncryptedItem = {
    ...item,
    encryptedPayload: toArrayBuffer(item.encryptedPayload),
    nonce: toBytes(item.nonce),
  };
  if (item.history) {
    out.history = item.history.map((h) => ({
      v: h.v,
      payload: toArrayBuffer(h.payload),
      nonce: toBytes(h.nonce),
      updatedAt: h.updatedAt,
    }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verification digests (migration): SHA-256 over length-prefixed binary
// fields, so "byte-identical" is proven without ever attempting a password.
// ---------------------------------------------------------------------------

async function sha256Hex(parts: Uint8Array[]): Promise<string> {
  let total = 0;
  for (const p of parts) total += 4 + p.length;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  let offset = 0;
  for (const p of parts) {
    view.setUint32(offset, p.length);
    offset += 4;
    buf.set(p, offset);
    offset += p.length;
  }
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Digest of a vault's password-verification material (salt + challenge). */
export async function vaultChallengeDigest(vault: Vault): Promise<string> {
  return sha256Hex([
    toBytes(vault.salt),
    toBytes(vault.challengeCiphertext),
    toBytes(vault.challengeNonce),
  ]);
}

/** Digest over a set of items: id + payload + nonce per item, sorted by id. */
export async function itemsDigest(items: EncryptedItem[]): Promise<string> {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();
  for (const item of sorted) {
    parts.push(encoder.encode(item.id));
    parts.push(toBytes(item.encryptedPayload));
    parts.push(toBytes(item.nonce));
  }
  return sha256Hex(parts);
}
