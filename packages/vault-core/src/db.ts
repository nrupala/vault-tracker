// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Zero-Trust Storage for @vault/core — public surface.
 *
 * Mirrors the app copy's db.ts: the live engine is SQLite (SQLCipher file
 * on Android with a per-device Keystore-held secret; jeep-sqlite on web
 * with per-vault AES-GCM payload sealing as the wall). The exported `db`
 * keeps the Dexie-shaped surface the hooks were written against and
 * delegates to the active backend. initStorage() — called once by the host
 * app at boot — opens the SQLite store and, when legacy Dexie data exists,
 * copies it in one transaction and verifies the copy (row counts,
 * per-vault challenge material byte-identical by digest, item payload
 * digest) before writing the migration marker and switching the binding.
 * On ANY failure the binding stays on the legacy Dexie store, Dexie data
 * is untouched, and the failure is visible via getStorageStatus(). The
 * legacy data is NOT deleted; cleanup is a later step. (Unlike the app
 * copy, this package has no rescue-snapshot mechanism; the untouched
 * source + verified copy is its safety story.)
 */
import { createFacade, type BackendResolver } from './storage/facade';
import { runMigration } from './storage/migration';
import {
  getActiveBackend,
  getDexieBackend,
  getStorageStatus,
  setActiveBackend,
  setStorageStatus,
  subscribeStorageStatus,
  MIGRATION_META_KEY,
  STORAGE_FALLBACK_MESSAGE,
  SqliteStoreBackend,
  type StorageStatus,
} from './storage/store';

export type { EncryptedItem, Vault } from './storage/types';
export { getStorageStatus, subscribeStorageStatus, STORAGE_FALLBACK_MESSAGE };
export type { StorageStatus };

let initPromise: Promise<void> | null = null;
let initDone = false;

const resolveBackend: BackendResolver = () => {
  if (initDone || !initPromise) return getActiveBackend();
  return initPromise.then(() => getActiveBackend());
};

/** The Dexie-shaped storage facade consumed by the hooks. */
export const db = createFacade(resolveBackend);

export function initStorage(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const sqlite = new SqliteStoreBackend();
      await sqlite.open();

      const marker = await sqlite.getMeta(MIGRATION_META_KEY);
      if (marker) {
        setActiveBackend(sqlite);
        setStorageStatus({ backend: 'sqlite', error: null });
        return;
      }

      const legacy = getDexieBackend();
      const legacyCounts = await legacy.counts();
      if (legacyCounts.vaults === 0 && legacyCounts.items === 0) {
        await sqlite.setMeta(MIGRATION_META_KEY, `fresh:${new Date().toISOString()}`);
        setActiveBackend(sqlite);
        setStorageStatus({ backend: 'sqlite', error: null });
        return;
      }

      const report = await runMigration(legacy, sqlite);
      if (!report.ok) {
        throw new Error(`migration verification failed: ${report.problems.join('; ')}`);
      }

      await sqlite.setMeta(MIGRATION_META_KEY, `migrated:${new Date().toISOString()}`);
      setActiveBackend(sqlite);
      setStorageStatus({ backend: 'sqlite', error: null });
    } catch (e) {
      // The binding stays on the legacy store; its data was only ever read.
      console.error('🛡️ Storage: SQLite init/migration failed; staying on legacy storage.', e);
      setActiveBackend(getDexieBackend());
      setStorageStatus({ backend: 'dexie', error: STORAGE_FALLBACK_MESSAGE });
    } finally {
      initDone = true;
    }
  })();
  return initPromise;
}
