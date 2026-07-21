/**
 * Encrypted backup — portable, password-protected export/restore.
 *
 * Fixes the plaintext-export hole: instead of dumping decrypted JSON/CSV, this
 * writes an AES-256-GCM file encrypted under a key derived (PBKDF2, 600k) from a
 * backup passphrase the user chooses. The file is self-describing — it carries its
 * own salt, KDF params and nonce — so it can be restored on a fresh install with
 * only the passphrase. No server, no account, zero-knowledge.
 */
import { deriveKey, encryptData, decryptData, generateSalt } from './crypto';

export const BACKUP_FORMAT = 'vault-tracker-encrypted-backup' as const;
export const BACKUP_VERSION = 1;
const KDF_ITERATIONS = 600000;

export interface EncryptedBackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number };
  cipher: 'AES-256-GCM';
  salt: string; // base64
  nonce: string; // base64
  ciphertext: string; // base64
  meta: { vaultName?: string; itemCount: number; exportedAt: string };
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Serialize the given decrypted items into encrypted-backup JSON text. */
export async function createEncryptedBackup(
  items: unknown,
  backupPassword: string,
  meta: { vaultName?: string } = {}
): Promise<string> {
  if (!backupPassword || backupPassword.length < 8) {
    throw new Error('Backup passphrase must be at least 8 characters.');
  }
  const salt = generateSalt();
  const key = await deriveKey(backupPassword, salt);
  const { ciphertext, nonce } = await encryptData(key, JSON.stringify(items));
  const count = Array.isArray(items) ? items.length : 0;
  const file: EncryptedBackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS },
    cipher: 'AES-256-GCM',
    salt: toBase64(salt),
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
    meta: { vaultName: meta.vaultName, itemCount: count, exportedAt: new Date().toISOString() },
  };
  return JSON.stringify(file, null, 2);
}

/** Quick sniff so the importer can route a file to the encrypted-restore path. */
export function isEncryptedBackup(text: string): boolean {
  try {
    const o = JSON.parse(text);
    return !!o && o.format === BACKUP_FORMAT && typeof o.ciphertext === 'string';
  } catch {
    return false;
  }
}

/**
 * Decrypt encrypted-backup JSON text; returns the items array.
 * Throws a clear error on wrong passphrase or corruption (GCM auth-tag failure).
 */
export async function restoreEncryptedBackup(fileText: string, backupPassword: string): Promise<any[]> {
  let file: any;
  try {
    file = JSON.parse(fileText);
  } catch {
    throw new Error('Not a valid backup file.');
  }
  if (!file || file.format !== BACKUP_FORMAT) throw new Error('Unrecognized backup format.');

  const nonce = fromBase64(file.nonce);
  const ciphertext = fromBase64(file.ciphertext);
  const key = await deriveKey(backupPassword, fromBase64(file.salt));

  let plaintext: string;
  try {
    plaintext = await decryptData(key, ciphertext.buffer as ArrayBuffer, nonce);
  } catch {
    throw new Error('Wrong backup passphrase, or the file is corrupted.');
  }
  const data = JSON.parse(plaintext);
  return Array.isArray(data) ? data : [data];
}
