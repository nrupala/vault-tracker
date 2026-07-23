/**
 * Zero-Trust Storage Utility
 * 
 * Uses Dexie (IndexedDB wrapper) to store encrypted payloads.
 * Nothing is stored in plaintext except non-sensitive routing or UI state ids.
 */
import Dexie, { type EntityTable } from 'dexie';

// A Vault represents a protected space. The salt is public and used 
// alongside the User's master password to derive the encryption key via PBKDF2.
export interface Vault {
  id: string; // UUID
  name: string; // Plaintext Name of the vault
  salt: Uint8Array; // Public salt used for password-KEK derivation
  challengeCiphertext: ArrayBuffer; // Used to verify password is correct
  challengeNonce: Uint8Array; // Used to verify password is correct
  createdAt: number;

  // --- v2 key architecture (DEK model) ---
  // Present once a vault is created on, or migrated to, the DEK scheme. Items are
  // encrypted under a random DEK; the DEK is wrapped by a password-derived KEK
  // and, independently, by a recovery-key-derived KEK. keyVersion 2 = DEK model;
  // undefined/1 = legacy (key derived directly from password, migrated on unlock).
  keyVersion?: number;
  dekWrappedByPassword?: ArrayBuffer;
  dekPasswordNonce?: Uint8Array;
  dekWrappedByRecovery?: ArrayBuffer;
  dekRecoveryNonce?: Uint8Array;
  recoverySalt?: Uint8Array; // salt for the recovery-key KEK
}

// All user data (Notes, Tasks, Habits) are stored here.
// The real shape of the data is encrypted in the payload.
export interface EncryptedItem {
  id: string; // UUID of the item itself
  vaultId: string; // References Vault.id
  type: 'note' | 'task' | 'habit' | 'expense';
  createdAt: number;
  updatedAt: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isFlagged: boolean;
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | 'none';
  
  // Tag metadata can remain in plaintext for easy filtering/querying without decryption
  tags: string[]; 

  // The actual specific data payload (e.g. Note content, Checklists, Habit streaks)
  encryptedPayload: ArrayBuffer; 
  nonce: Uint8Array;

  // Resilience & Versioning (v1.1.6+)
  v: number; 
  history?: { v: number; payload: ArrayBuffer; nonce: Uint8Array; updatedAt: number }[];
}

export interface VaultSettings {
  id: string; // vaultId
  historyLimit: number; // Max versions to keep (default 5)
  retentionDays: number; // Days to keep history (default 30)
  autoArchiveCompleted: boolean; // Auto-archive done items
  archiveAfterDays: number; // Days after completion to archive
}

const db = new Dexie('VaultTrackerDB') as Dexie & {
  vaults: EntityTable<Vault, 'id'>,
  items: EntityTable<EncryptedItem, 'id'>,
  settings: EntityTable<VaultSettings, 'id'>
};

// Schema definition
db.version(3).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, v, *tags', 
}).upgrade(async tx => {
  return tx.table('items').toCollection().modify(item => {
    if (item.v === undefined) {
      item.v = 1;
      item.history = [];
    }
  });
});

db.version(4).stores({
  settings: 'id'
}).upgrade(async tx => {
  const vaults = await tx.table('vaults').toArray();
  for (const v of vaults) {
    await tx.table('settings').put({
      id: v.id,
      historyLimit: 5,
      retentionDays: 30,
      autoArchiveCompleted: false,
      archiveAfterDays: 30
    });
  }
});

// --- Resilience: Failsafe Migration (v1.1.6) ---

/**
 * Creates a "Rescue Snapshot" of the entire database before a migration.
 * This is stored in a separate, temporary IndexedDB called 'VaultRescueDB'.
 */
export async function performRescueSnapshot() {
  const rescueDB = new Dexie('VaultRescueDB');
  rescueDB.version(1).stores({ backup: 'id' });
  
  const vData = await db.table('vaults').toArray();
  const iData = await db.table('items').toArray();
  
  await rescueDB.table('backup').put({
    id: 'latest_pre_migration',
    timestamp: Date.now(),
    data: { vaults: vData, items: iData }
  });
  console.log('🛡️ Resilience: Rescue Snapshot created.');
}

/**
 * Restores vaults + items from the most recent rescue snapshot.
 * Recovery path if a migration or corruption leaves the live DB unusable.
 * Returns the counts restored, or null if no snapshot exists.
 */
export async function restoreFromRescueSnapshot(): Promise<{ vaults: number; items: number } | null> {
  const rescueDB = new Dexie('VaultRescueDB');
  rescueDB.version(1).stores({ backup: 'id' });
  const snap = await rescueDB.table('backup').get('latest_pre_migration');
  if (!snap || !snap.data) return null;

  const { vaults = [], items = [] } = snap.data as { vaults: Vault[]; items: EncryptedItem[] };
  await db.transaction('rw', db.vaults, db.items, async () => {
    if (vaults.length) await db.vaults.bulkPut(vaults);
    if (items.length) await db.items.bulkPut(items);
  });
  console.warn(`🛡️ Resilience: Restored ${vaults.length} vault(s) and ${items.length} item(s) from rescue snapshot.`);
  return { vaults: vaults.length, items: items.length };
}

/**
 * Ensures a recent pre-session rescue snapshot exists. Called once at app startup —
 * the reliable place to guarantee a recoverable backup BEFORE the user mutates data
 * or a schema upgrade runs. Re-snapshots only if the last one is older than maxAgeMs.
 */
export async function ensureStartupSnapshot(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  try {
    const rescueDB = new Dexie('VaultRescueDB');
    rescueDB.version(1).stores({ backup: 'id' });
    const existing = await rescueDB.table('backup').get('latest_pre_migration');
    const isStale = !existing || (Date.now() - (existing.timestamp ?? 0)) > maxAgeMs;
    if (isStale) {
      await performRescueSnapshot();
    }
  } catch (e) {
    console.error('🛡️ Resilience: ensureStartupSnapshot failed', e);
  }
}

// Correct Dexie behavior: when another tab/connection wants to upgrade the schema,
// close this connection so the upgrade is not blocked. (versionchange is NOT a
// pre-migration hook — snapshotting is handled by ensureStartupSnapshot() at startup.)
db.on('versionchange', () => {
  console.warn('🛡️ Resilience: schema upgrade requested by another tab; closing this connection.');
  db.close();
});

export { db };
