import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { db, performRescueSnapshot, type Vault, type EncryptedItem } from './db';
import {
  deriveKey,
  generateSalt,
  generateVerificationPayload,
  verifyPassword,
  generateDEK,
  importDEK,
  wrapDEK,
  unwrapDEK,
  generateRecoveryKey,
  normalizeRecoveryKey,
  encryptData,
  decryptData,
} from './crypto';
import { v4 as uuidv4 } from 'uuid';

const MAGIC = 'VAULT_OPEN_SESAME';

export interface VaultState {
  activeVault: Vault | null;
  encryptionKey: CryptoKey | null; // the DEK for the unlocked vault
  isLocked: boolean;
  vaults: Vault[];
  loadVaults: () => Promise<void>;
  createVault: (name: string, password: string) => Promise<Vault>;
  unlockVault: (id: string, password: string) => Promise<Vault>;
  lockVault: () => void;
  deleteVault: (id: string, password: string) => Promise<void>;
  recoverWithKey: (id: string, recoveryKey: string, newPassword: string) => Promise<Vault>;
  changePassword: (id: string, oldPassword: string, newPassword: string) => Promise<void>;
  // One-time recovery-key surfacing: set after vault creation or legacy migration.
  // The UI shows it once (with a mandatory encrypted-backup prompt) then acknowledges.
  pendingRecoveryKey: string | null;
  pendingRecoveryReason: 'created' | 'migrated' | null;
  acknowledgeRecoveryKey: () => void;
}

const VaultContext = createContext<VaultState | undefined>(undefined);

type HistoryEntry = { v: number; payload: ArrayBuffer; nonce: Uint8Array; updatedAt: number };

/** Re-encrypt one item's payload (and history) from oldKey to newKey. Pure crypto, no DB. */
async function reencryptItem(item: EncryptedItem, oldKey: CryptoKey, newKey: CryptoKey): Promise<EncryptedItem> {
  const plaintext = await decryptData(oldKey, item.encryptedPayload, item.nonce);
  const { ciphertext, nonce } = await encryptData(newKey, plaintext);

  let history = item.history;
  if (history && history.length) {
    const rewritten: HistoryEntry[] = [];
    for (const h of history) {
      const hp = await decryptData(oldKey, h.payload, h.nonce);
      const enc = await encryptData(newKey, hp);
      rewritten.push({ v: h.v, payload: enc.ciphertext, nonce: enc.nonce, updatedAt: h.updatedAt });
    }
    history = rewritten;
  }
  return { ...item, encryptedPayload: ciphertext, nonce, history };
}

/**
 * One-time migration of a legacy (password-derived-key) vault to the DEK model.
 *
 * CRITICAL: all Web Crypto work happens OUTSIDE the Dexie transaction — Dexie
 * transactions must only await IndexedDB operations, so we re-encrypt AND verify
 * every item in memory first, and only then write items + the vault flip inside a
 * single atomic transaction. If anything throws (bad decrypt, storage error), the
 * transaction rolls back and the vault stays untouched on the old scheme; a fresh
 * rescue snapshot is taken first as a second safety net.
 */
async function migrateVaultToDEK(
  vault: Vault,
  passwordKek: CryptoKey
): Promise<{ migratedVault: Vault; dekKey: CryptoKey; recoveryKey: string }> {
  await performRescueSnapshot();

  const dek = generateDEK();
  const dekKey = await importDEK(dek);

  const recoveryKey = generateRecoveryKey();
  const recoverySalt = generateSalt();
  const recoveryKek = await deriveKey(normalizeRecoveryKey(recoveryKey), recoverySalt);

  const pw = await wrapDEK(passwordKek, dek);
  const rec = await wrapDEK(recoveryKek, dek);

  // Phase 1 — re-encrypt everything in memory (no DB writes yet).
  const items = await db.items.where('vaultId').equals(vault.id).toArray();
  const reencrypted: EncryptedItem[] = [];
  for (const item of items) {
    reencrypted.push(await reencryptItem(item, passwordKek, dekKey));
  }
  // Verify each re-encrypted item decrypts under the DEK BEFORE writing anything.
  for (const it of reencrypted) {
    await decryptData(dekKey, it.encryptedPayload, it.nonce);
  }

  // Phase 2 — atomic write only (no crypto inside the transaction).
  await db.transaction('rw', db.items, db.vaults, async () => {
    if (reencrypted.length) await db.items.bulkPut(reencrypted);
    await db.vaults.update(vault.id, {
      keyVersion: 2,
      dekWrappedByPassword: pw.ciphertext,
      dekPasswordNonce: pw.nonce,
      dekWrappedByRecovery: rec.ciphertext,
      dekRecoveryNonce: rec.nonce,
      recoverySalt,
    });
  });

  const migratedVault = await db.vaults.get(vault.id);
  if (!migratedVault) throw new Error('Migration failed: vault not found after write');
  return { migratedVault, dekKey, recoveryKey };
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [activeVault, setActiveVault] = useState<Vault | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);
  const [pendingRecoveryReason, setPendingRecoveryReason] = useState<'created' | 'migrated' | null>(null);

  const loadVaults = useCallback(async () => {
    const list = await db.vaults.toArray();
    setVaults(list);
  }, []);

  const createVault = async (name: string, masterPassword: string) => {
    const salt = generateSalt();
    const passwordKek = await deriveKey(masterPassword, salt);
    const { challengeCiphertext, challengeNonce } = await generateVerificationPayload(passwordKek);

    // DEK model: random data key wrapped independently by the password KEK and a recovery KEK.
    const dek = generateDEK();
    const recoveryKey = generateRecoveryKey();
    const recoverySalt = generateSalt();
    const recoveryKek = await deriveKey(normalizeRecoveryKey(recoveryKey), recoverySalt);

    const pw = await wrapDEK(passwordKek, dek);
    const rec = await wrapDEK(recoveryKek, dek);

    const newVault: Vault = {
      id: uuidv4(),
      name,
      salt,
      challengeCiphertext,
      challengeNonce,
      createdAt: Date.now(),
      keyVersion: 2,
      dekWrappedByPassword: pw.ciphertext,
      dekPasswordNonce: pw.nonce,
      dekWrappedByRecovery: rec.ciphertext,
      dekRecoveryNonce: rec.nonce,
      recoverySalt,
    };

    await db.vaults.add(newVault);
    const dekKey = await importDEK(dek);
    setActiveVault(newVault);
    setEncryptionKey(dekKey);
    setIsLocked(false);
    setPendingRecoveryKey(recoveryKey);
    setPendingRecoveryReason('created');
    await loadVaults();
    return newVault;
  };

  const unlockVault = async (vaultId: string, masterPassword: string) => {
    const vault = await db.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    const passwordKek = await deriveKey(masterPassword, vault.salt);

    // DEK vault: unwrap the DEK (GCM auth failure => wrong password).
    if (vault.keyVersion === 2 && vault.dekWrappedByPassword && vault.dekPasswordNonce) {
      let dek: Uint8Array;
      try {
        dek = await unwrapDEK(passwordKek, vault.dekWrappedByPassword, vault.dekPasswordNonce);
      } catch {
        throw new Error('Invalid master password');
      }
      const dekKey = await importDEK(dek);
      setActiveVault(vault);
      setEncryptionKey(dekKey);
      setIsLocked(false);
      return vault;
    }

    // Legacy vault: verify the password against the challenge, then migrate to DEK.
    let magic: string;
    try {
      magic = await decryptData(passwordKek, vault.challengeCiphertext, vault.challengeNonce);
    } catch {
      throw new Error('Invalid master password');
    }
    if (magic !== MAGIC) throw new Error('Invalid master password');

    const { migratedVault, dekKey, recoveryKey } = await migrateVaultToDEK(vault, passwordKek);
    setActiveVault(migratedVault);
    setEncryptionKey(dekKey);
    setIsLocked(false);
    setPendingRecoveryKey(recoveryKey);
    setPendingRecoveryReason('migrated');
    await loadVaults();
    return migratedVault;
  };

  const lockVault = () => {
    setActiveVault(null);
    setEncryptionKey(null);
    setIsLocked(true);
  };

  const recoverWithKey = async (vaultId: string, recoveryKey: string, newPassword: string) => {
    const vault = await db.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');
    if (
      vault.keyVersion !== 2 ||
      !vault.dekWrappedByRecovery ||
      !vault.dekRecoveryNonce ||
      !vault.recoverySalt
    ) {
      throw new Error('No recovery key is set up for this vault. Unlock once with your password to enable recovery.');
    }

    const recoveryKek = await deriveKey(normalizeRecoveryKey(recoveryKey), vault.recoverySalt);
    let dek: Uint8Array;
    try {
      dek = await unwrapDEK(recoveryKek, vault.dekWrappedByRecovery, vault.dekRecoveryNonce);
    } catch {
      throw new Error('Invalid recovery key');
    }

    // Set a new password: fresh salt + KEK, re-wrap the DEK, refresh the challenge.
    const newSalt = generateSalt();
    const newPwKek = await deriveKey(newPassword, newSalt);
    const pw = await wrapDEK(newPwKek, dek);
    const { challengeCiphertext, challengeNonce } = await generateVerificationPayload(newPwKek);

    await db.vaults.update(vaultId, {
      salt: newSalt,
      challengeCiphertext,
      challengeNonce,
      dekWrappedByPassword: pw.ciphertext,
      dekPasswordNonce: pw.nonce,
    });

    const updated = await db.vaults.get(vaultId);
    if (!updated) throw new Error('Recovery failed: vault not found after write');
    const dekKey = await importDEK(dek);
    setActiveVault(updated);
    setEncryptionKey(dekKey);
    setIsLocked(false);
    await loadVaults();
    return updated;
  };

  const changePassword = async (vaultId: string, oldPassword: string, newPassword: string) => {
    const vault = await db.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');
    if (vault.keyVersion !== 2 || !vault.dekWrappedByPassword || !vault.dekPasswordNonce) {
      throw new Error('Unlock this vault once to upgrade its security before changing the password.');
    }
    const oldKek = await deriveKey(oldPassword, vault.salt);
    let dek: Uint8Array;
    try {
      dek = await unwrapDEK(oldKek, vault.dekWrappedByPassword, vault.dekPasswordNonce);
    } catch {
      throw new Error('Invalid current password');
    }
    // DEK win: rotate the password by re-wrapping the DEK — no item re-encryption.
    const newSalt = generateSalt();
    const newKek = await deriveKey(newPassword, newSalt);
    const pw = await wrapDEK(newKek, dek);
    const { challengeCiphertext, challengeNonce } = await generateVerificationPayload(newKek);
    await db.vaults.update(vaultId, {
      salt: newSalt,
      challengeCiphertext,
      challengeNonce,
      dekWrappedByPassword: pw.ciphertext,
      dekPasswordNonce: pw.nonce,
    });
    await loadVaults();
  };

  const deleteVault = async (vaultId: string, masterPassword: string) => {
    const vault = await db.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    // Verify password before allowing deletion (the challenge is maintained for all vaults).
    await verifyPassword(masterPassword, vault.salt, vault.challengeNonce, vault.challengeCiphertext);

    await db.items.where('vaultId').equals(vaultId).delete();
    await db.vaults.delete(vaultId);

    if (activeVault?.id === vaultId) {
      lockVault();
    }
    await loadVaults();
  };

  const acknowledgeRecoveryKey = () => {
    setPendingRecoveryKey(null);
    setPendingRecoveryReason(null);
  };

  const contextValue: VaultState = {
    activeVault,
    encryptionKey,
    isLocked,
    vaults,
    loadVaults,
    createVault,
    unlockVault,
    lockVault,
    deleteVault,
    recoverWithKey,
    changePassword,
    pendingRecoveryKey,
    pendingRecoveryReason,
    acknowledgeRecoveryKey,
  };

  return React.createElement(VaultContext.Provider, { value: contextValue }, children);
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
