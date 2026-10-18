// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Storage backends behind one interface (@vault/core).
 *
 * Mirrors the app copy's storage/store.ts, trimmed to this package's record
 * model (vaults + items; no settings table, no rescue jar).
 *
 *  - SqliteStoreBackend — the new engine. On Android the database file is
 *    encrypted with SQLCipher (the host app's capacitor.config.ts sets
 *    androidIsEncryption); the file passphrase is a per-device random secret
 *    the app generates once and hands to the plugin, which stores it in
 *    EncryptedSharedPreferences wrapped by an Android Keystore master key.
 *    It is NEVER derived from a vault password, and the plugin's published
 *    default passphrase is never accepted: the secret is ensured to exist
 *    BEFORE the first connection (see open()).
 *    On web the same plugin runs on jeep-sqlite (sql.js WASM persisted to
 *    IndexedDB) with NO file encryption — the per-vault AES-GCM payload
 *    sealing remains the wall there, exactly as with Dexie.
 *  - DexieStoreBackend — the legacy IndexedDB store (../legacyDb): the
 *    migration source and the fallback binding if migration cannot be
 *    verified, so a failed upgrade never strands data.
 */
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { legacyDb } from '../legacyDb';
import {
  itemToRow,
  rowToItem,
  rowToVault,
  vaultToRow,
  type SqlRow,
} from './codec';
import type { EncryptedItem, TableName, Vault } from './types';

export const MAIN_DB_NAME = 'vault_tracker';
export const MIGRATION_META_KEY = 'storage_migration_v1';

/** Surfaced via getStorageStatus() when the storage upgrade could not be completed. */
export const STORAGE_FALLBACK_MESSAGE =
  'The storage upgrade could not be completed. Your data is safe: nothing was changed and the app is using your previous storage. Restart the app to try again.';

export interface StoreCounts {
  vaults: number;
  items: number;
}

export interface StoreBackend {
  readonly kind: 'sqlite' | 'dexie';
  getVault(id: string): Promise<Vault | undefined>;
  addVault(vault: Vault): Promise<void>;
  putVault(vault: Vault): Promise<void>;
  bulkPutVaults(rows: Vault[]): Promise<void>;
  updateVault(id: string, changes: Partial<Vault>): Promise<number>;
  deleteVault(id: string): Promise<void>;
  allVaults(): Promise<Vault[]>;
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
  selectWhere(table: TableName, field: string, value: unknown): Promise<unknown[]>;
  deleteByIds(table: TableName, ids: string[]): Promise<number>;
  counts(): Promise<StoreCounts>;
  clearAll(): Promise<void>;
  transaction<T>(mode: string, tables: TableName[], cb: () => Promise<T>): Promise<T>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Binding + status registry
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
// Dexie backend
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

  async selectWhere(table: TableName, field: string, value: unknown) {
    return legacyDb.table(table).where(field).equals(value as never).toArray();
  }
  async deleteByIds(table: TableName, ids: string[]) {
    if (!ids.length) return 0;
    await legacyDb.table(table).bulkDelete(ids);
    return ids.length;
  }
  async counts(): Promise<StoreCounts> {
    return { vaults: await legacyDb.vaults.count(), items: await legacyDb.items.count() };
  }
  async clearAll() {
    await legacyDb.transaction('rw', legacyDb.vaults, legacyDb.items, async () => {
      await legacyDb.vaults.clear();
      await legacyDb.items.clear();
    });
  }
  async transaction<T>(mode: string, tables: TableName[], cb: () => Promise<T>): Promise<T> {
    const dexieTables = tables.map((t) => legacyDb.table(t));
    return legacyDb.transaction(mode as 'rw', dexieTables, cb);
  }
  async getMeta(_key: string): Promise<string | null> { return null; }
  async setMeta(_key: string, _value: string): Promise<void> { /* marker lives in SQLite only */ }
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
  createdAt INTEGER NOT NULL
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
  nonce BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_vaultId ON items(vaultId);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_createdAt ON items(createdAt);
CREATE INDEX IF NOT EXISTS idx_items_updatedAt ON items(updatedAt);
CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority);
CREATE INDEX IF NOT EXISTS idx_items_isFlagged ON items(isFlagged);
CREATE INDEX IF NOT EXISTS idx_items_color ON items(color);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const VAULT_COLUMNS = ['id', 'name', 'salt', 'challengeCiphertext', 'challengeNonce', 'createdAt'] as const;

const ITEM_COLUMNS = [
  'id', 'vaultId', 'type', 'createdAt', 'updatedAt', 'priority', 'isFlagged',
  'color', 'tags', 'encryptedPayload', 'nonce',
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
  private txDepth = 0;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  /**
   * Open the store. Ordering is load-bearing: on native, the device secret
   * MUST exist before the first connection, or the plugin silently falls
   * back to a published default passphrase.
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

    const encrypted = platform !== 'web';
    const mode = encrypted ? 'secret' : 'no-encryption';
    const existing = await this.sqlite.isConnection(MAIN_DB_NAME, false);
    if (existing.result) {
      this.conn = await this.sqlite.retrieveConnection(MAIN_DB_NAME, false);
    } else {
      this.conn = await this.sqlite.createConnection(MAIN_DB_NAME, false, mode, 1, false);
    }
    await this.conn.open();
    await this.conn.execute(SCHEMA_SQL);
  }

  private async initWebPlatform(): Promise<void> {
    // jeep-sqlite is the plugin's web store: the custom element must exist
    // in the DOM (with its WASM path and auto-save enabled) before
    // initWebStore. There is NO file encryption on web — payload sealing
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

  private db(): SQLiteDBConnection {
    if (!this.conn) throw new Error('SQLite store is not open');
    return this.conn;
  }

  private async queryAll(sql: string, values: unknown[] = []): Promise<SqlRow[]> {
    const res = await this.db().query(sql, values);
    return (res.values ?? []) as SqlRow[];
  }

  private async run(sql: string, values: unknown[] = []): Promise<number> {
    const res = await this.db().run(sql, values, this.txDepth === 0);
    return res.changes?.changes ?? 0;
  }

  private async executeSet(table: string, columns: readonly string[], rows: SqlRow[]): Promise<void> {
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

  // -- Generic helpers --------------------------------------------------------
  async selectWhere(table: TableName, field: string, value: unknown): Promise<unknown[]> {
    const rows = await this.queryAll(`SELECT * FROM ${table} WHERE ${field} = ?;`, [value]);
    return table === 'vaults' ? rows.map(rowToVault) : rows.map(rowToItem);
  }
  async deleteByIds(table: TableName, ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    return this.run(`DELETE FROM ${table} WHERE id IN (${placeholders});`, ids);
  }
  async counts(): Promise<StoreCounts> {
    const rows = await this.queryAll(
      'SELECT (SELECT COUNT(*) FROM vaults) AS v, (SELECT COUNT(*) FROM items) AS i;',
    );
    const row = rows[0] ?? { v: 0, i: 0 };
    return { vaults: Number(row.v), items: Number(row.i) };
  }
  async clearAll() {
    await this.run('DELETE FROM vaults;');
    await this.run('DELETE FROM items;');
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
      try { await conn.rollbackTransaction(); } catch { /* original error surfaces */ }
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
}
