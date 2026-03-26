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

const db = new Dexie('VaultTrackerDB') as Dexie & {
  vaults: EntityTable<Vault, 'id'>,
  items: EntityTable<EncryptedItem, 'id'>
};

// Schema definition
db.version(1).stores({
  vaults: 'id', // Primary key
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, *tags', // Indexed fields
});

db.version(2).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, *tags', 
});

db.version(3).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, v, *tags', // Added v (version)
}).upgrade(async tx => {
  // Migration: Initialize version and history for existing items
  return tx.table('items').toCollection().modify(item => {
    if (item.v === undefined) {
      item.v = 1;
      item.history = [];
    }
  });
});

export { db };
