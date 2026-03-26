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
  salt: Uint8Array; // Public salt used for key derivation
  challengeCiphertext: ArrayBuffer; // Used to verify password is correct
  challengeNonce: Uint8Array; // Used to verify password is correct
  createdAt: number;
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
db.version(1).stores({
  vaults: 'id', // Primary key
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, *tags', // Indexed fields
});

db.version(2).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, *tags', 
});

db.version(4).stores({
  settings: 'id'
}).upgrade(async tx => {
  // Migration: Initialize settings for existing vaults
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

// Hook into version changes to trigger snapshots
db.on('versionchange', () => {
  console.warn('🛡️ Resilience: Schema update detected. Performing pre-flight snapshot...');
  performRescueSnapshot();
});

export { db };
