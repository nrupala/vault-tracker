// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Zero-Trust Storage — public surface.
 *
 * v1.2.0 storage swap: the live engine is now SQLite — on Android an
 * SQLCipher-encrypted file whose passphrase is a per-device secret held in
 * the Android Keystore (never derived from a vault password, never leaving
 * the device); on web, jeep-sqlite (sql.js WASM over IndexedDB) with the
 * per-vault AES-GCM payload sealing as the wall, exactly as before. Item
 * payloads remain AES-GCM ciphertext on every platform; nothing is stored
 * in plaintext except non-sensitive routing or UI state ids.
 *
 * The exported `db` object keeps the Dexie-shaped surface the hooks were
 * written against (see ./storage/facade) and delegates to the active
 * backend. initStorage() — called once from main.tsx at boot — opens the
 * SQLite store and, when legacy Dexie data exists, migrates it:
 *   1. a rescue snapshot is written through the existing VaultRescueDB
 *      mechanism BEFORE anything is copied;
 *   2. vaults, items, and settings are copied inside one transaction;
 *   3. the copy is verified (row counts, per-vault challenge material
 *      byte-identical by digest, item payload digest);
 *   4. only then is the migration marker written and the binding switched.
 * On ANY failure the binding stays on the legacy Dexie store, Dexie data is
 * untouched, and a visible error state is raised (getStorageStatus /
 * useStorageStatus) — no silent fallback, no data-loss path. The legacy
 * data is NOT deleted by this release; cleanup is a later step.
 */
import { useEffect, useState } from 'react';
import { performLegacyRescueSnapshot } from './legacyDb';
import { normalizeItem, normalizeVault } from './storage/codec';
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
  type StoreBackend,
} from './storage/store';

export type { EncryptedItem, RescueEntry, Vault, VaultSettings } from './storage/types';
export { getStorageStatus, subscribeStorageStatus, STORAGE_FALLBACK_MESSAGE };
export type { StorageStatus };

// ---------------------------------------------------------------------------
// Init / migration orchestration
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;
let initDone = false;

const resolveBackend: BackendResolver = () => {
  if (initDone || !initPromise) return getActiveBackend();
  return initPromise.then(() => getActiveBackend());
};

/** The Dexie-shaped storage facade consumed by the hooks. */
export const db = createFacade(resolveBackend);

async function resolvedBackend(): Promise<StoreBackend> {
  const backend = resolveBackend();
  return backend instanceof Promise ? await backend : backend;
}

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
      const isFreshInstall =
        legacyCounts.vaults === 0 && legacyCounts.items === 0 && legacyCounts.settings === 0;

      if (isFreshInstall) {
        await sqlite.setMeta(MIGRATION_META_KEY, `fresh:${new Date().toISOString()}`);
        setActiveBackend(sqlite);
        setStorageStatus({ backend: 'sqlite', error: null });
        return;
      }

      // Safety first: snapshot the legacy store through the existing
      // VaultRescueDB mechanism BEFORE copying anything.
      await performLegacyRescueSnapshot();

      const report = await runMigration(legacy, sqlite);
      if (!report.ok) {
        throw new Error(`migration verification failed: ${report.problems.join('; ')}`);
      }

      await sqlite.setMeta(MIGRATION_META_KEY, `migrated:${new Date().toISOString()}`);
      setActiveBackend(sqlite);
      setStorageStatus({ backend: 'sqlite', error: null });
      console.log(
        `🛡️ Storage: migrated ${report.sourceCounts.vaults} vault(s), ` +
        `${report.sourceCounts.items} item(s), ${report.sourceCounts.settings} settings to SQLite.`,
      );
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

/** React hook for the visible storage status (used by the App error banner). */
export function useStorageStatus(): StorageStatus {
  const [status, setStatus] = useState<StorageStatus>(getStorageStatus);
  useEffect(() => subscribeStorageStatus(setStatus), []);
  return status;
}

// ---------------------------------------------------------------------------
// Rescue snapshots (semantics unchanged from the Dexie era: a full copy of
// vaults + items in a separate jar, keyed 'latest_pre_migration').
// ---------------------------------------------------------------------------

/**
 * Creates a "Rescue Snapshot" of the entire ACTIVE database before a risky
 * operation. Stored in the active backend's rescue jar (the legacy
 * VaultRescueDB jar while on Dexie; a separate SQLite database after the
 * swap), so it survives corruption of the live store either way.
 */
export async function performRescueSnapshot(): Promise<void> {
  const backend = await resolvedBackend();
  const vaults = await backend.allVaults();
  const items = await backend.allItems();
  await backend.rescuePut({
    id: 'latest_pre_migration',
    timestamp: Date.now(),
    data: { vaults, items },
  });
  console.log('🛡️ Resilience: Rescue Snapshot created.');
}

/**
 * Restores vaults + items from the most recent rescue snapshot.
 * After the swap, a snapshot taken by a pre-swap build (legacy jar) is
 * still found and restored into the SQLite store.
 * Returns the counts restored, or null if no snapshot exists.
 */
export async function restoreFromRescueSnapshot(): Promise<{ vaults: number; items: number } | null> {
  const backend = await resolvedBackend();
  let entry = await backend.rescueGet('latest_pre_migration');
  if (!entry && backend.kind === 'sqlite') {
    entry = await getDexieBackend().rescueGet('latest_pre_migration');
  }
  if (!entry || !entry.data) return null;

  const vaults = (entry.data.vaults ?? []).map(normalizeVault);
  const items = (entry.data.items ?? []).map(normalizeItem);
  await backend.transaction('rw', ['vaults', 'items'], async () => {
    if (vaults.length) await backend.bulkPutVaults(vaults);
    if (items.length) await backend.bulkPutItems(items);
  });
  console.warn(`🛡️ Resilience: Restored ${vaults.length} vault(s) and ${items.length} item(s) from rescue snapshot.`);
  return { vaults: vaults.length, items: items.length };
}

/**
 * Ensures a recent pre-session rescue snapshot exists. Called once at app
 * startup — the reliable place to guarantee a recoverable backup BEFORE the
 * user mutates data. Re-snapshots only if the last one is older than maxAgeMs.
 */
export async function ensureStartupSnapshot(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  try {
    const backend = await resolvedBackend();
    let latest = await backend.rescueGet('latest_pre_migration');
    if (backend.kind === 'sqlite') {
      const legacyEntry = await getDexieBackend().rescueGet('latest_pre_migration');
      if (legacyEntry && (!latest || legacyEntry.timestamp > latest.timestamp)) {
        latest = legacyEntry;
      }
    }
    const isStale = !latest || (Date.now() - (latest.timestamp ?? 0)) > maxAgeMs;
    if (isStale) {
      await performRescueSnapshot();
    }
  } catch (e) {
    console.error('🛡️ Resilience: ensureStartupSnapshot failed', e);
  }
}
