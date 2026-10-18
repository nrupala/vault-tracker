// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Legacy Dexie (IndexedDB) store for @vault/core — the pre-swap engine,
 * preserved as the migration source and the fallback binding if the
 * Dexie -> SQLite migration cannot be verified. New code should use the
 * facade in ./db, not this module directly.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { EncryptedItem, Vault } from './storage/types';

const legacyDb = new Dexie('VaultTrackerDB') as Dexie & {
  vaults: EntityTable<Vault, 'id'>,
  items: EntityTable<EncryptedItem, 'id'>
};

// Schema definition
legacyDb.version(1).stores({
  vaults: 'id', // Primary key
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, *tags', // Indexed fields
});

legacyDb.version(2).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, *tags', // Added color
});

export { legacyDb };
