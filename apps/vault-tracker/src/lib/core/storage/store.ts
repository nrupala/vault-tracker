// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Storage backends behind one interface.
 *
 * Two implementations of the same record-level operations:
 *  - SqliteStoreBackend — the v1.2.0 engine. On Android the database file is
 *    encrypted with SQLCipher (capacitor.config.ts sets androidIsEncryption);
 *    the file passphrase is a per-device random secret the app generates once
 *    and hands to the plugin, which stores it in EncryptedSharedPreferences
 *    wrapped by an Android Keystore master key. It is NEVER derived from a
 *    vault password — the file must open before any vault unlocks — and the
 *    plugin's published default passphrase is never accepted: the secret is
 *    ensured to exist BEFORE the first connection (see open()).
 *    On web the same plugin runs on jeep-sqlite (sql.js WASM persisted to
 *    IndexedDB). The plugin offers no file encryption on web; the per-vault
 *    AES-GCM payload sealing remains the wall there, exactly as with Dexie.
 *  - DexieStoreBackend — the legacy IndexedDB store (./legacyDb). It is the
 *    migration source and the fallback binding if migration cannot be
 *    verified, so a failed upgrade never strands data.
 *
 * Records cross this interface as the decoded types from ./types; all SQL
 * and base64 conversion lives in the SQLite backend + ./codec.
 */
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { legacyDb, legacyRescueGet, legacyRescuePut } from '../legacyDb';
import {
  decodeBinaryJson,
  encodeBinaryJson,
  itemToRow,
  rowToItem,
  rowToSettings,
  rowToVault,
  settingsToRow,
  vaultToRow,
  type SqlRow,
} from './codec';
import type { EncryptedItem, RescueEntry, TableName, Vault, VaultSettings } from './types';

export const MAIN_DB_NAME = 'vault_tracker';
export const RESCUE_DB_NAME = 'vault_rescue';
export const MIGRATION_META_KEY = 'storage_migration_v1';

/** Shown in the UI when the storage upgrade could not be completed. */
export const STORAGE_FALLBACK_MESSAGE =
  'The storage upgrade could not be completed. Your data is safe: nothing was changed and the app is using your previous storage. Restart the app to try again.';

export interface StoreCounts {
  vaults: number;
  items: number;
  settings: number;
}

export interface StoreBackend {
  readonly kind: 'sqlite' | 'dexie';
  // Vaults
  getVault(id: string): Promise<Vault | undefined>;
  addVault(vault: Vault): Promise<void>;
  putVault(vault: Vault): Promise<void>;
  bulkPutVaults(rows: Vault[]): Promise<void>;
  updateVault(id: string, changes: Partial<Vault>): Promise<number>;
  deleteVault(id: string): Promise<void>;
  allVaults(): Promise<Vault[]>;
  // Items
  getItem(id: string): Promise<EncryptedItem | undefined>;
  addItem(item: EncryptedItem): Promise<void>;
  putItem(item: EncryptedItem): Promise<void>;
  bulkPutItems(rows: EncryptedItem[]): Promise<void>;
  updateItem(id: string, changes: Partial<EncryptedItem>): Promise<number>;
  deleteItem(id: string): Promise<void>;
  allItems(): Promise<EncryptedItem[]>;
  itemsByVault(vaultId: string): Promise<EncryptedItem[]>;
  countItemsByVault(vaultId: string): Promise<number>;
  deleteItemsByVault(vaultId: string): Promise<number>;
  // Settings
  getSettings(id: string): Promise<VaultSettings | undefined>;
  addSettings(settings: VaultSettings): Promise<void>;
  putSettings(settings: VaultSettings): Promise<void>;
  allSettings(): Promise<VaultSettings[]>;
  // Generic helpers used by the facade's where()/collection emulation
  selectWhere(table: TableName, field: string, value: unknown): Promise<unknown[]>;
  deleteByIds(table: TableName, ids: string[]): Promise<number>;
  // Bulk state
  counts(): Promise<StoreCounts>;
  clearAll(): Promise<void>;
  transaction<T>(mode: string, tables: TableName[], cb: () => Promise<T>): Promise<T>;
  // Migration marker (SQLite backend persists it; Dexie backend has none)
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  // Rescue snapshot jar
  rescuePut(entry: RescueEntry): Promise<void>;
  rescueGet(id: string): Promise<RescueEntry | undefined>;
}

// ---------------------------------------------------------------------------
// Binding + status registry. The facade resolves every call through the
// active backend; init (../db) flips the binding to SQLite only after the
// migration has been verified.
// ---------------------------------------------------------------------------

export interface StorageStatus {
  backend: 'sqlite' | 'dexie';
  error: string | null;
}

let status: StorageStatus = { backend: 'dexie', error: null };
const statusListeners = new Set<(s: StorageStatus) => void>();

export function getStorageStatus(): StorageStatus {
  return status;
}

export function setStorageStatus(next: StorageStatus): void {
  status = next;
  for (const fn of statusListeners) fn(status);
}

export function subscribeStorageStatus(fn: (s: StorageStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

let dexieBackend: DexieStoreBackend | null = null;
let activeBackend: StoreBackend | null = null;

export function getDexieBackend(): DexieStoreBackend {
  if (!dexieBackend) dexieBackend = new DexieStoreBackend();
  return dexieBackend;
}

export function getActiveBackend(): StoreBackend {
  if (!activeBackend) activeBackend = getDexieBackend();
  return activeBackend;
}

export function setActiveBackend(backend: StoreBackend): void {
  activeBackend = backend;
}

// ---------------------------------------------------------------------------
// Dexie backend — thin delegation to the legacy store.
// ---------------------------------------------------------------------------

export class DexieStoreBackend implements StoreBackend {
  readonly kind = 'dexie' as const;

  async getVault(id: string) { return legacyDb.vaults.get(id); }
  async addVault(vault: Vault) { await legacyDb.vaults.add(vault); }
  async putVault(vault: Vault) { await legacyDb.vaults.put(vault); }
  async bulkPutVaults(rows: Vault[]) { if (rows.length) await legacyDb.vaults.bulkPut(rows); }
  async updateVault(id: string, changes: Partial<Vault>) { return legacyDb.vaults.update(id, changes); }
  async deleteVault(id: string) { await legacyDb.vaults.delete(id); }
  async allVaults() { return legacyDb.vaults.toArray(); }

  async getItem(id: string) { return legacyDb.items.get(id); }
  async addItem(item: EncryptedItem) { await legacyDb.items.add(item); }
  async putItem(item: EncryptedItem) { await legacyDb.items.put(item); }
  async bulkPutItems(rows: EncryptedItem[]) { if (rows.length) await legacyDb.items.bulkPut(rows); }
  async updateItem(id: string, changes: Partial<EncryptedItem>) { return legacyDb.items.update(id, changes); }
  async deleteItem(id: string) { await legacyDb.items.delete(id); }
  async allItems() { return legacyDb.items.toArray(); }
  async itemsByVault(vaultId: string) { return legacyDb.items.where('vaultId').equals(vaultId).toArray(); }
  async countItemsByVault(vaultId: string) { return legacyDb.items.where('vaultId').equals(vaultId).count(); }
  async deleteItemsByVault(vaultId: string) { return legacyDb.items.where('vaultId').equals(vaultId).delete(); }

  async getSettings(id: string) { return legacyDb.settings.get(id); }
  async addSettings(settings: VaultSettings) { await legacyDb.settings.add(settings); }
  async putSettings(settings: VaultSettings) { await legacyDb.settings.put(settings); }
  async allSettings() { return legacyDb.settings.toArray(); }

  async selectWhere(table: TableName, field: string, value: unknown) {
    return legacyDb.table(table).where(field).equals(value as never).toArray();
  }
  async deleteByIds(table: TableName, ids: string[]) {
    if (!ids.length) return 0;
    await legacyDb.table(table).bulkDelete(ids);
    return ids.length;
  }
  async counts(): Promise<StoreCounts> {
    return {
      vaults: await legacyDb.vaults.count(),
      items: await legacyDb.items.count(),
      settings: await legacyDb.settings.count(),
    };
  }
  async clearAll() {
    await legacyDb.transaction('rw', legacyDb.vaults, legacyDb.items, legacyDb.settings, async () => {
      await legacyDb.vaults.clear();
      await legacyDb.items.clear();
      await legacyDb.settings.clear();
    });
  }
  async transaction<T>(mode: string, tables: TableName[], cb: () => Promise<T>): Promise<T> {
    const dexieTables = tables.map((t) => legacyDb.table(t));
    return legacyDb.transaction(mode as 'rw', dexieTables, cb);
  }
  async getMeta(_key: string): Promise<string | null> { return null; }
  async setMeta(_key: string, _value: string): Promise<void> { /* marker lives in SQLite only */ }
  async rescuePut(entry: RescueEntry) { await legacyRescuePut(entry); }
  async rescueGet(id: string) { return legacyRescueGet(id); }
}

// ---------------------------------------------------------------------------
// SQLite backend
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  salt BLOB NOT NULL,
  challengeCiphertext BLOB NOT NULL,
  challengeNonce BLOB NOT NULL,
  createdAt INTEGER NOT NULL,
  keyVersion INTEGER,
  dekWrappedByPassword BLOB,
  dekPasswordNonce BLOB,
  dekWrappedByRecovery BLOB,
  dekRecoveryNonce BLOB,
  recoverySalt BLOB
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  vaultId TEXT NOT NULL,
  type TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  priority TEXT NOT NULL,
  isFlagged INTEGER NOT NULL,
  color TEXT,
  tags TEXT NOT NULL,
  encryptedPayload BLOB NOT NULL,
  nonce BLOB NOT NULL,
  v INTEGER NOT NULL,
  history TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_vaultId ON items(vaultId);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_createdAt ON items(createdAt);
CREATE INDEX IF NOT EXISTS idx_items_updatedAt ON items(updatedAt);
CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority);
CREATE INDEX IF NOT EXISTS idx_items_isFlagged ON items(isFlagged);
CREATE INDEX IF NOT EXISTS idx_items_color ON items(color);
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  historyLimit INTEGER NOT NULL,
  retentionDays INTEGER NOT NULL,
  autoArchiveCompleted INTEGER NOT NULL,
  archiveAfterDays INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const RESCUE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS backup (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  data TEXT NOT NULL
);
`;

const VAULT_COLUMNS = [
  'id', 'name', 'salt', 'challengeCiphertext', 'challengeNonce', 'createdAt',
  'keyVersion', 'dekWrappedByPassword', 'dekPasswordNonce',
  'dekWrappedByRecovery', 'dekRecoveryNonce', 'recoverySalt',
] as const;

const ITEM_COLUMNS = [
  'id', 'vaultId', 'type', 'createdAt', 'updatedAt', 'priority', 'isFlagged',
  'color', 'tags', 'encryptedPayload', 'nonce', 'v', 'history',
] as const;

const SETTINGS_COLUMNS = [
  'id', 'historyLimit', 'retentionDays', 'autoArchiveCompleted', 'archiveAfterDays',
] as const;

/** Dexie update() semantics: shallow-merge changes; undefined deletes the key. */
function applyChanges<T extends object>(record: T, changes: Partial<T>): T {
  const merged = { ...record } as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return merged as T;
}

/** 256-bit random device secret, hex-encoded (the plugin's secret format). */
function generateDeviceSecret(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class SqliteStoreBackend implements StoreBackend {
  readonly kind = 'sqlite' as const;
  private sqlite: SQLiteConnection;
  private conn: SQLiteDBConnection | null = null;
  private rescueConn: SQLiteDBConnection | null = null;
  private txDepth = 0;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  /**
   * Open the store. Ordering is load-bearing (DB-1 finding): on native, the
   * device secret MUST exist before the first connection, or the plugin
   * silently falls back to a published default passphrase.
   */
  async open(): Promise<void> {
    if (this.conn) return;
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      await this.initWebPlatform();
    } else {
      const stored = await this.sqlite.isSecretStored();
      if (stored.result !== true) {
        await this.sqlite.setEncryptionSecret(generateDeviceSecret());
      }
    }

    this.conn = await this.openConnection(MAIN_DB_NAME, platform);
    await this.conn.execute(SCHEMA_SQL);
    this.rescueConn = await this.openConnection(RESCUE_DB_NAME, platform);
    await this.rescueConn.execute(RESCUE_SCHEMA_SQL);
  }

  private async initWebPlatform(): Promise<void> {
    // jeep-sqlite is the plugin's web store: the custom element must exist in
    // the DOM (with its WASM path and auto-save enabled) before initWebStore.
    // Honest posture: there is NO file encryption on web — payload sealing
    // under each vault's password-derived key remains the wall, as with Dexie.
    if (!document.querySelector('jeep-sqlite')) {
      const { defineCustomElements } = await import('jeep-sqlite/loader');
      defineCustomElements(window);
      const el = document.createElement('jeep-sqlite');
      el.setAttribute('wasm-path', new URL('assets', document.baseURI).href);
      el.setAttribute('auto-save', 'true');
      document.body.appendChild(el);
    }
    await this.sqlite.initWebStore();
  }

  private async openConnection(name: string, platform: string): Promise<SQLiteDBConnection> {
    const encrypted = platform !== 'web';
    const mode = encrypted ? 'secret' : 'no-encryption';
    let conn: SQLiteDBConnection;
    const existing = await this.sqlite.isConnection(name, false);
    if (existing.result) {
      conn = await this.sqlite.retrieveConnection(name, false);
    } else {
      conn = await this.sqlite.createConnection(name, false, mode, 1, false);
    }
    await conn.open();
    return conn;
  }

  private db(): SQLiteDBConnection {
    if (!this.conn) throw new Error('SQLite store is not open');
    return this.conn;
  }

  private rescueDb(): SQLiteDBConnection {
    if (!this.rescueConn) throw new Error('SQLite rescue store is not open');
    return this.rescueConn;
  }

  private async queryAll(sql: string, values: unknown[] = []): Promise<SqlRow[]> {
    const res = await this.db().query(sql, values);
    return (res.values ?? []) as SqlRow[];
  }

  private async run(sql: string, values: unknown[] = []): Promise<number> {
    const res = await this.db().run(sql, values, this.txDepth === 0);
    return res.changes?.changes ?? 0;
  }

  private async executeSet(
    table: string,
    columns: readonly string[],
    rows: SqlRow[],
  ): Promise<void> {
    if (!rows.length) return;
    const placeholders = columns.map(() => '?').join(', ');
    const statement = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`;
    const set = rows.map((row) => ({
      statement,
      values: columns.map((c) => row[c] ?? null),
    }));
    await this.db().executeSet(set, this.txDepth === 0);
  }

  private async insertOne(table: string, columns: readonly string[], row: SqlRow): Promise<void> {
    const placeholders = columns.map(() => '?').join(', ');
    await this.db().run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`,
      columns.map((c) => row[c] ?? null),
      this.txDepth === 0,
    );
  }

  // -- Vaults ---------------------------------------------------------------
  async getVault(id: string) {
    const rows = await this.queryAll('SELECT * FROM vaults WHERE id = ?;', [id]);
    return rows.length ? rowToVault(rows[0]) : undefined;
  }
  async addVault(vault: Vault) { await this.insertOne('vaults', VAULT_COLUMNS, vaultToRow(vault)); }
  async putVault(vault: Vault) { await this.executeSet('vaults', VAULT_COLUMNS, [vaultToRow(vault)]); }
  async bulkPutVaults(rows: Vault[]) { await this.executeSet('vaults', VAULT_COLUMNS, rows.map(vaultToRow)); }
  async updateVault(id: string, changes: Partial<Vault>): Promise<number> {
    const existing = await this.getVault(id);
    if (!existing) return 0;
    await this.putVault(applyChanges(existing, changes));
    return 1;
  }
  async deleteVault(id: string) { await this.run('DELETE FROM vaults WHERE id = ?;', [id]); }
  async allVaults() {
    const rows = await this.queryAll('SELECT * FROM vaults;');
    return rows.map(rowToVault);
  }

  // -- Items ----------------------------------------------------------------
  async getItem(id: string) {
    const rows = await this.queryAll('SELECT * FROM items WHERE id = ?;', [id]);
    return rows.length ? rowToItem(rows[0]) : undefined;
  }
  async addItem(item: EncryptedItem) { await this.insertOne('items', ITEM_COLUMNS, itemToRow(item)); }
  async putItem(item: EncryptedItem) { await this.executeSet('items', ITEM_COLUMNS, [itemToRow(item)]); }
  async bulkPutItems(rows: EncryptedItem[]) { await this.executeSet('items', ITEM_COLUMNS, rows.map(itemToRow)); }
  async updateItem(id: string, changes: Partial<EncryptedItem>): Promise<number> {
    const existing = await this.getItem(id);
    if (!existing) return 0;
    await this.putItem(applyChanges(existing, changes));
    return 1;
  }
  async deleteItem(id: string) { await this.run('DELETE FROM items WHERE id = ?;', [id]); }
  async allItems() {
    const rows = await this.queryAll('SELECT * FROM items;');
    return rows.map(rowToItem);
  }
  async itemsByVault(vaultId: string) {
    const rows = await this.queryAll('SELECT * FROM items WHERE vaultId = ?;', [vaultId]);
    return rows.map(rowToItem);
  }
  async countItemsByVault(vaultId: string) {
    const rows = await this.queryAll('SELECT COUNT(*) AS n FROM items WHERE vaultId = ?;', [vaultId]);
    return rows.length ? Number(rows[0].n) : 0;
  }
  async deleteItemsByVault(vaultId: string) {
    return this.run('DELETE FROM items WHERE vaultId = ?;', [vaultId]);
  }

  // -- Settings ---------------------------------------------------------------
  async getSettings(id: string) {
    const rows = await this.queryAll('SELECT * FROM settings WHERE id = ?;', [id]);
    return rows.length ? rowToSettings(rows[0]) : undefined;
  }
  async addSettings(settings: VaultSettings) { await this.insertOne('settings', SETTINGS_COLUMNS, settingsToRow(settings)); }
  async putSettings(settings: VaultSettings) { await this.executeSet('settings', SETTINGS_COLUMNS, [settingsToRow(settings)]); }
  async allSettings() {
    const rows = await this.queryAll('SELECT * FROM settings;');
    return rows.map(rowToSettings);
  }

  // -- Generic helpers --------------------------------------------------------
  async selectWhere(table: TableName, field: string, value: unknown): Promise<unknown[]> {
    const rows = await this.queryAll(`SELECT * FROM ${table} WHERE ${field} = ?;`, [value]);
    if (table === 'vaults') return rows.map(rowToVault);
    if (table === 'items') return rows.map(rowToItem);
    return rows.map(rowToSettings);
  }
  async deleteByIds(table: TableName, ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    return this.run(`DELETE FROM ${table} WHERE id IN (${placeholders});`, ids);
  }
  async counts(): Promise<StoreCounts> {
    const rows = await this.queryAll(
      'SELECT (SELECT COUNT(*) FROM vaults) AS v, (SELECT COUNT(*) FROM items) AS i, (SELECT COUNT(*) FROM settings) AS s;',
    );
    const row = rows[0] ?? { v: 0, i: 0, s: 0 };
    return { vaults: Number(row.v), items: Number(row.i), settings: Number(row.s) };
  }
  async clearAll() {
    await this.run('DELETE FROM vaults;');
    await this.run('DELETE FROM items;');
    await this.run('DELETE FROM settings;');
  }
  async transaction<T>(_mode: string, _tables: TableName[], cb: () => Promise<T>): Promise<T> {
    const conn = this.db();
    if (this.txDepth > 0) return cb();
    await conn.beginTransaction();
    this.txDepth++;
    try {
      const result = await cb();
      await conn.commitTransaction();
      return result;
    } catch (e) {
      try { await conn.rollbackTransaction(); } catch { /* connection-level failure surfaces via the original error */ }
      throw e;
    } finally {
      this.txDepth--;
    }
  }

  // -- Meta (migration marker) --------------------------------------------------
  async getMeta(key: string): Promise<string | null> {
    const rows = await this.queryAll('SELECT value FROM meta WHERE key = ?;', [key]);
    return rows.length ? String(rows[0].value) : null;
  }
  async setMeta(key: string, value: string): Promise<void> {
    await this.db().run(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);',
      [key, value],
      this.txDepth === 0,
    );
  }

  // -- Rescue jar -----------------------------------------------------------------
  async rescuePut(entry: RescueEntry): Promise<void> {
    await this.rescueDb().run(
      'INSERT OR REPLACE INTO backup (id, timestamp, data) VALUES (?, ?, ?);',
      [entry.id, entry.timestamp, encodeBinaryJson(entry.data)],
    );
  }
  async rescueGet(id: string): Promise<RescueEntry | undefined> {
    const res = await this.rescueDb().query('SELECT id, timestamp, data FROM backup WHERE id = ?;', [id]);
    const row = res.values?.[0];
    if (!row) return undefined;
    return {
      id: String(row.id),
      timestamp: Number(row.timestamp),
      data: decodeBinaryJson(String(row.data)) as RescueEntry['data'],
    };
  }
}
