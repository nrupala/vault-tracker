// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * DB-1 SPIKE — throwaway proof for the Dexie -> SQLite + SQLCipher swap.
 *
 * This module is NOT imported anywhere and MUST NOT be wired into the app.
 * It exists to prove, on a real Android build, that
 * @capacitor-community/sqlite 8.1.1 can:
 *   1. take an app-supplied, per-device random secret (setEncryptionSecret)
 *      which the plugin keeps in EncryptedSharedPreferences wrapped by an
 *      Android Keystore master key (AES256_GCM) — i.e. the SQLCipher file
 *      opens BEFORE any vault password is entered, exactly as the DB-1
 *      architecture requires;
 *   2. open a SQLCipher-encrypted database (capacitor.config.ts sets
 *      androidIsEncryption: true; connections use mode "secret");
 *   3. create a table, write a row, read it back, and close cleanly.
 *
 * WARNING (from the plugin's own Android sources, GlobalSQLite.java):
 * if no secret has been set, the plugin silently falls back to a published
 * default passphrase ("sqlite secret"). The real VaultStore adapter must
 * therefore ALWAYS ensure a device secret exists before the first
 * connection — this spike demonstrates that ordering.
 *
 * Web is intentionally not exercised here: the plugin's web store
 * (jeep-sqlite + sql.js WASM persisted to IndexedDB) needs the sql-wasm.wasm
 * asset and a <jeep-sqlite> element, which land with the actual swap.
 */
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const SPIKE_DB = 'db1_spike';

/** 256-bit random device secret, hex-encoded (the plugin's secret format). */
function generateDeviceSecret(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface SqliteSpikeResult {
  platform: string;
  secretWasAlreadyStored: boolean;
  readBack: string | null;
}

/**
 * Runs the native round-trip proof. Throws on web (see header) and on any
 * step failing — CI/logcat output is the evidence, not a return code alone.
 */
export async function runSqliteSpike(): Promise<SqliteSpikeResult> {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    throw new Error('DB-1 spike is native-only; web store arrives with the swap');
  }

  const sqlite = new SQLiteConnection(CapacitorSQLite);

  // 1. Device-secret custody: generate once, hand to the plugin, which stores
  //    it Keystore-wrapped. Never derived from any vault password.
  const stored = await sqlite.isSecretStored();
  const secretWasAlreadyStored = stored.result === true;
  if (!secretWasAlreadyStored) {
    await sqlite.setEncryptionSecret(generateDeviceSecret());
  }

  // 2. Open an encrypted connection (mode "secret" = use the stored secret).
  const db = await sqlite.createConnection(SPIKE_DB, false, 'secret', 1, false);
  await db.open();
  try {
    // 3. Round-trip: create, write, read back.
    await db.execute(
      'CREATE TABLE IF NOT EXISTS spike_probe (id TEXT PRIMARY KEY, val TEXT NOT NULL);',
    );
    await db.run('INSERT OR REPLACE INTO spike_probe (id, val) VALUES (?, ?);', [
      'probe',
      'sqlcipher-ok',
    ]);
    const res = await db.query('SELECT val FROM spike_probe WHERE id = ?;', ['probe']);
    const readBack =
      res.values && res.values.length > 0 ? String(res.values[0].val) : null;
    if (readBack !== 'sqlcipher-ok') {
      throw new Error(`DB-1 spike read-back mismatch: ${String(readBack)}`);
    }
    return { platform, secretWasAlreadyStored, readBack };
  } finally {
    await db.close();
    await sqlite.closeConnection(SPIKE_DB, false);
  }
}
