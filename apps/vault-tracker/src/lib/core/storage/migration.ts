// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Dexie -> SQLite migration: pure orchestration over two StoreBackends.
 *
 * This module deliberately imports no platform code (no Capacitor plugin, no
 * Dexie) so the copy + verification logic is unit-testable with in-memory
 * fake backends. The caller (../db init) owns the safety ordering:
 *   rescue snapshot FIRST, then runMigration(), then — only on an ok
 *   report — write the migration marker and switch the app's binding.
 * Any problem in the report means: binding stays on the source, the source
 * is untouched, and no marker is written. The target copy is rebuilt from
 * scratch on every attempt (clearAll inside the copy transaction), so a
 * crashed attempt can simply be retried at the next startup.
 */
import { itemsDigest, vaultChallengeDigest } from './codec';
import type { StoreBackend, StoreCounts } from './store';

export interface MigrationReport {
  ok: boolean;
  problems: string[];
  sourceCounts: StoreCounts;
  targetCounts: StoreCounts;
}

function countsEqual(a: StoreCounts, b: StoreCounts): boolean {
  return a.vaults === b.vaults && a.items === b.items && a.settings === b.settings;
}

/**
 * Verify that the target holds exactly what the source holds: row counts,
 * every vault's password-challenge material byte-identical (via digest),
 * per-vault item counts, and a digest over all item payloads.
 */
export async function verifyMigration(
  source: StoreBackend,
  target: StoreBackend,
): Promise<MigrationReport> {
  const problems: string[] = [];
  const sourceCounts = await source.counts();
  const targetCounts = await target.counts();

  if (!countsEqual(sourceCounts, targetCounts)) {
    problems.push(
      `row counts differ (source vaults=${sourceCounts.vaults} items=${sourceCounts.items} settings=${sourceCounts.settings}; ` +
      `target vaults=${targetCounts.vaults} items=${targetCounts.items} settings=${targetCounts.settings})`,
    );
  }

  const sourceVaults = await source.allVaults();
  const targetVaults = await target.allVaults();
  const targetById = new Map(targetVaults.map((v) => [v.id, v]));

  for (const sourceVault of sourceVaults) {
    const targetVault = targetById.get(sourceVault.id);
    if (!targetVault) {
      problems.push(`vault ${sourceVault.id} missing in target`);
      continue;
    }
    const [sourceDigest, targetDigest] = [
      await vaultChallengeDigest(sourceVault),
      await vaultChallengeDigest(targetVault),
    ];
    if (sourceDigest !== targetDigest) {
      problems.push(`vault ${sourceVault.id} challenge material differs after copy`);
    }
    const [sourceItems, targetItems] = [
      await source.countItemsByVault(sourceVault.id),
      await target.countItemsByVault(sourceVault.id),
    ];
    if (sourceItems !== targetItems) {
      problems.push(
        `vault ${sourceVault.id} item count differs (source=${sourceItems}, target=${targetItems})`,
      );
    }
  }

  const [sourceItemsDigest, targetItemsDigest] = [
    await itemsDigest(await source.allItems()),
    await itemsDigest(await target.allItems()),
  ];
  if (sourceItemsDigest !== targetItemsDigest) {
    problems.push('item payload digest differs after copy');
  }

  return { ok: problems.length === 0, problems, sourceCounts, targetCounts };
}

/**
 * Copy every vault, item, and settings row from source to target inside a
 * single target transaction (the target is cleared first, so retries are
 * idempotent), then verify. The source is only ever read.
 */
export async function runMigration(
  source: StoreBackend,
  target: StoreBackend,
): Promise<MigrationReport> {
  const vaults = await source.allVaults();
  const items = await source.allItems();
  const settings = await source.allSettings();

  await target.transaction('rw', ['vaults', 'items', 'settings'], async () => {
    await target.clearAll();
    await target.bulkPutVaults(vaults);
    await target.bulkPutItems(items);
    for (const s of settings) await target.putSettings(s);
  });

  return verifyMigration(source, target);
}
