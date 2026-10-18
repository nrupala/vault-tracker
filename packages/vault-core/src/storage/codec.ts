// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Binary / row codec for the SQLite storage engine (@vault/core).
 *
 * The @capacitor-community/sqlite bridge is string-based (JSON), so binary
 * fields (salts, nonces, AES-GCM ciphertexts) cross it as base64 strings in
 * BLOB-affinity columns — byte-identical on every platform. All conversions
 * live here; call sites only ever see the record types from ./types.
 * Mirrors the app copy's storage/codec.ts, trimmed to this package's model.
 */
import type { EncryptedItem, Vault } from './types';

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

/** Normalize a value read back from SQLite into bytes (base64 string, raw bytes, or number array). */
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

// ---------------------------------------------------------------------------
// Binary-aware JSON (used by the facade's Collection.modify change
// detection, where records with binary fields must compare by content).
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

function decBin(value: unknown, field: string): Uint8Array {
  const bytes = blobToBytes(value);
  if (!bytes) throw new Error(`Storage codec: missing binary field ${field}`);
  return bytes;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

export function vaultToRow(v: Vault): SqlRow {
  return {
    id: v.id,
    name: v.name,
    salt: encBin(v.salt),
    challengeCiphertext: encBin(v.challengeCiphertext),
    challengeNonce: encBin(v.challengeNonce),
    createdAt: v.createdAt,
  };
}

export function rowToVault(row: SqlRow): Vault {
  return {
    id: String(row.id),
    name: String(row.name),
    salt: decBin(row.salt, 'vault.salt'),
    challengeCiphertext: toArrayBuffer(decBin(row.challengeCiphertext, 'vault.challengeCiphertext')),
    challengeNonce: decBin(row.challengeNonce, 'vault.challengeNonce'),
    createdAt: Number(row.createdAt),
  };
}

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
  };
  if (row.color !== null && row.color !== undefined) {
    item.color = String(row.color) as EncryptedItem['color'];
  }
  return item;
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
