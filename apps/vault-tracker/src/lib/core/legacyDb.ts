// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Legacy Dexie (IndexedDB) store — the pre-v1.2.0 storage engine.
 *
 * This module is the previous db.ts, preserved verbatim in behavior:
 *  - it is the SOURCE of the one-time Dexie -> SQLite migration;
 *  - it remains the live store if the migration cannot be verified, so a
 *    failed upgrade can never strand or lose user data;
 *  - its VaultRescueDB snapshot jar stays readable forever, so rescue
 *    snapshots taken by older builds remain restorable.
 *
 * New code should use the facade in ./db, not this module directly.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { EncryptedItem, RescueEntry, Vault, VaultSettings } from './storage/types';

const legacyDb = new Dexie('VaultTrackerDB') as Dexie & {
  vaults: EntityTable<Vault, 'id'>,
  items: EntityTable<EncryptedItem, 'id'>,
  settings: EntityTable<VaultSettings, 'id'>
};

// Schema definition — the FULL version history must be declared here.
//
// The shipped app db.ts declared only versions 3 and 4 (the v1/v2 declarations
// survive in packages/vault-core). Dexie merges schemas forward, so existing
// users' databases (created when v1/v2 were still declared) keep their vaults
// table — but a database created fresh by those builds has NO vaults table at
// all (proven against Dexie 4.3: fresh tables are exactly [items, settings]
// and db.vaults is undefined). Declaring the complete history changes nothing
// for installed databases (Dexie only applies versions above the installed
// one) and lets this reader open every historical state safely.
legacyDb.version(1).stores({
  vaults: 'id', // Primary key
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, *tags',
});

legacyDb.version(2).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, *tags', // Added color
});

legacyDb.version(3).stores({
  items: 'id, vaultId, type, createdAt, updatedAt, priority, isFlagged, color, v, *tags',
}).upgrade(async tx => {
  return tx.table('items').toCollection().modify(item => {
    if (item.v === undefined) {
      item.v = 1;
      item.history = [];
    }
  });
});

legacyDb.version(4).stores({
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

// Correct Dexie behavior: when another tab/connection wants to upgrade the schema,
// close this connection so the upgrade is not blocked.
legacyDb.on('versionchange', () => {
  console.warn('🛡️ Resilience: schema upgrade requested by another tab; closing this connection.');
  legacyDb.close();
});

export { legacyDb };

// ---------------------------------------------------------------------------
// VaultRescueDB — the separate snapshot jar used by the legacy builds.
// ---------------------------------------------------------------------------

function openRescueDb(): Dexie {
  const rescueDB = new Dexie('VaultRescueDB');
  rescueDB.version(1).stores({ backup: 'id' });
  return rescueDB;
}

export async function legacyRescuePut(entry: RescueEntry): Promise<void> {
  const rescueDB = openRescueDb();
  await rescueDB.table('backup').put({
    id: entry.id,
    timestamp: entry.timestamp,
    data: entry.data,
  });
}

export async function legacyRescueGet(id: string): Promise<RescueEntry | undefined> {
  const rescueDB = openRescueDb();
  const row = await rescueDB.table('backup').get(id);
  if (!row || !row.data) return undefined;
  return row as RescueEntry;
}

/**
 * Creates a "Rescue Snapshot" of the entire legacy database.
 * Used by the storage migration BEFORE anything is copied — the snapshot is
 * taken through this existing mechanism so the pre-swap state is recoverable
 * by the same restore path older builds already use.
 */
export async function performLegacyRescueSnapshot(): Promise<void> {
  const vData = await legacyDb.table('vaults').toArray();
  const iData = await legacyDb.table('items').toArray();

  await legacyRescuePut({
    id: 'latest_pre_migration',
    timestamp: Date.now(),
    data: { vaults: vData, items: iData },
  });
  console.log('🛡️ Resilience: Rescue Snapshot created.');
}
