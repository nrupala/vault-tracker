// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import {
  bytesToBase64,
  base64ToBytes,
  encodeBinaryJson,
  decodeBinaryJson,
  itemToRow,
  rowToItem,
  rowToSettings,
  rowToVault,
  settingsToRow,
  toBytes,
  vaultChallengeDigest,
  vaultToRow,
} from '../lib/core/storage/codec';
import { runMigration, verifyMigration } from '../lib/core/storage/migration';
import { createFacade } from '../lib/core/storage/facade';
import type { StoreBackend, StoreCounts } from '../lib/core/storage/store';
import type { EncryptedItem, RescueEntry, TableName, Vault, VaultSettings } from '../lib/core/storage/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function buf(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

function makeVault(id: string, dek = false): Vault {
  const vault: Vault = {
    id,
    name: `Vault ${id}`,
    salt: bytes(1, 2, 3, 4),
    challengeCiphertext: buf(9, 8, 7, 6),
    challengeNonce: bytes(5, 5, 5),
    createdAt: 1700000000000,
  };
  if (dek) {
    vault.keyVersion = 2;
    vault.dekWrappedByPassword = buf(1, 1, 2, 2);
    vault.dekPasswordNonce = bytes(3, 3);
    vault.dekWrappedByRecovery = buf(4, 4, 5, 5);
    vault.dekRecoveryNonce = bytes(6, 6);
    vault.recoverySalt = bytes(7, 7, 7);
  }
  return vault;
}

function makeItem(id: string, vaultId: string): EncryptedItem {
  return {
    id,
    vaultId,
    type: 'note',
    createdAt: 1700000001000,
    updatedAt: 1700000002000,
    priority: 'medium',
    isFlagged: true,
    color: 'blue',
    tags: ['alpha', 'beta'],
    encryptedPayload: buf(10, 20, 30, 40),
    nonce: bytes(11, 22, 33),
    v: 3,
    history: [
      { v: 2, payload: buf(1, 2), nonce: bytes(9, 9), updatedAt: 1700000001500 },
      { v: 1, payload: buf(3, 4), nonce: bytes(8, 8), updatedAt: 1700000001200 },
    ],
  };
}

function makeSettings(id: string): VaultSettings {
  return { id, historyLimit: 7, retentionDays: 45, autoArchiveCompleted: true, archiveAfterDays: 10 };
}

function expectBytesEqual(actual: unknown, expected: unknown) {
  expect(Array.from(toBytes(actual as Uint8Array))).toEqual(
    Array.from(toBytes(expected as Uint8Array)),
  );
}

// ---------------------------------------------------------------------------
// In-memory StoreBackend for migration/facade tests, with fault injection.
// ---------------------------------------------------------------------------

class FakeBackend implements StoreBackend {
  readonly kind = 'dexie' as const;
  vaults = new Map<string, Vault>();
  items = new Map<string, EncryptedItem>();
  settings = new Map<string, VaultSettings>();
  meta = new Map<string, string>();
  rescue = new Map<string, RescueEntry>();
  failOnBulkPutItems = false;
  dropItemOnBulkPut = false;
  corruptChallengesOnRead = false;
  putItemCalls: string[] = [];

  async getVault(id: string) {
    const v = this.vaults.get(id);
    if (!v) return undefined;
    if (this.corruptChallengesOnRead) {
      const copy = { ...v, challengeNonce: bytes(99, 99, 99) };
      return copy;
    }
    return v;
  }
  async addVault(v: Vault) { if (this.vaults.has(v.id)) throw new Error('ConstraintError'); this.vaults.set(v.id, v); }
  async putVault(v: Vault) { this.vaults.set(v.id, v); }
  async bulkPutVaults(rows: Vault[]) { for (const r of rows) this.vaults.set(r.id, r); }
  async updateVault(id: string, changes: Partial<Vault>) {
    const cur = this.vaults.get(id); if (!cur) return 0;
    this.vaults.set(id, { ...cur, ...changes }); return 1;
  }
  async deleteVault(id: string) { this.vaults.delete(id); }
  async allVaults() { return [...this.vaults.values()].map((v) => (this.corruptChallengesOnRead ? { ...v, challengeNonce: bytes(99) } : v)); }

  async getItem(id: string) { return this.items.get(id); }
  async addItem(i: EncryptedItem) { if (this.items.has(i.id)) throw new Error('ConstraintError'); this.items.set(i.id, i); }
  async putItem(i: EncryptedItem) { this.putItemCalls.push(i.id); this.items.set(i.id, i); }
  async bulkPutItems(rows: EncryptedItem[]) {
    if (this.failOnBulkPutItems) throw new Error('injected bulkPut failure');
    const effective = this.dropItemOnBulkPut ? rows.slice(1) : rows;
    for (const r of effective) this.items.set(r.id, r);
  }
  async updateItem(id: string, changes: Partial<EncryptedItem>) {
    const cur = this.items.get(id); if (!cur) return 0;
    this.items.set(id, { ...cur, ...changes }); return 1;
  }
  async deleteItem(id: string) { this.items.delete(id); }
  async allItems() { return [...this.items.values()]; }
  async itemsByVault(vaultId: string) { return [...this.items.values()].filter((i) => i.vaultId === vaultId); }
  async countItemsByVault(vaultId: string) { return (await this.itemsByVault(vaultId)).length; }
  async deleteItemsByVault(vaultId: string) {
    const list = await this.itemsByVault(vaultId);
    for (const i of list) this.items.delete(i.id);
    return list.length;
  }

  async getSettings(id: string) { return this.settings.get(id); }
  async addSettings(s: VaultSettings) { if (this.settings.has(s.id)) throw new Error('ConstraintError'); this.settings.set(s.id, s); }
  async putSettings(s: VaultSettings) { this.settings.set(s.id, s); }
  async allSettings() { return [...this.settings.values()]; }

  async selectWhere(table: TableName, field: string, value: unknown): Promise<unknown[]> {
    const rows = table === 'vaults' ? [...this.vaults.values()] : table === 'items' ? [...this.items.values()] : [...this.settings.values()];
    return rows.filter((r) => (r as unknown as Record<string, unknown>)[field] === value);
  }
  async deleteByIds(table: TableName, ids: string[]) {
    const map = table === 'vaults' ? this.vaults : table === 'items' ? this.items : this.settings;
    let n = 0;
    for (const id of ids) if (map.delete(id as never)) n++;
    return n;
  }
  async counts(): Promise<StoreCounts> {
    return { vaults: this.vaults.size, items: this.items.size, settings: this.settings.size };
  }
  async clearAll() { this.vaults.clear(); this.items.clear(); this.settings.clear(); }
  async transaction<T>(_mode: string, _tables: TableName[], cb: () => Promise<T>): Promise<T> { return cb(); }
  async getMeta(key: string) { return this.meta.get(key) ?? null; }
  async setMeta(key: string, value: string) { this.meta.set(key, value); }
  async rescuePut(entry: RescueEntry) { this.rescue.set(entry.id, entry); }
  async rescueGet(id: string) { return this.rescue.get(id); }
}

function seedSource(): FakeBackend {
  const source = new FakeBackend();
  source.vaults.set('v-legacy', makeVault('v-legacy'));
  source.vaults.set('v-dek', makeVault('v-dek', true));
  source.items.set('i-1', makeItem('i-1', 'v-legacy'));
  source.items.set('i-2', makeItem('i-2', 'v-dek'));
  source.items.set('i-3', makeItem('i-3', 'v-dek'));
  source.settings.set('v-legacy', makeSettings('v-legacy'));
  source.settings.set('v-dek', makeSettings('v-dek'));
  return source;
}

// ---------------------------------------------------------------------------
// Codec
// ---------------------------------------------------------------------------

describe('storage codec', () => {
  it('round-trips base64', () => {
    const original = bytes(0, 1, 2, 250, 251, 252, 253, 254, 255);
    expectBytesEqual(base64ToBytes(bytesToBase64(original)), original);
  });

  it('round-trips a legacy vault through its SQL row', () => {
    const vault = makeVault('v1');
    const back = rowToVault(vaultToRow(vault));
    expect(back.id).toBe(vault.id);
    expect(back.name).toBe(vault.name);
    expect(back.createdAt).toBe(vault.createdAt);
    expect(back.keyVersion).toBeUndefined();
    expectBytesEqual(back.salt, vault.salt);
    expectBytesEqual(back.challengeCiphertext, vault.challengeCiphertext);
    expectBytesEqual(back.challengeNonce, vault.challengeNonce);
  });

  it('round-trips a DEK vault with all wrapped-key fields', () => {
    const vault = makeVault('v2', true);
    const back = rowToVault(vaultToRow(vault));
    expect(back.keyVersion).toBe(2);
    expectBytesEqual(back.dekWrappedByPassword, vault.dekWrappedByPassword);
    expectBytesEqual(back.dekPasswordNonce, vault.dekPasswordNonce);
    expectBytesEqual(back.dekWrappedByRecovery, vault.dekWrappedByRecovery);
    expectBytesEqual(back.dekRecoveryNonce, vault.dekRecoveryNonce);
    expectBytesEqual(back.recoverySalt, vault.recoverySalt);
  });

  it('round-trips an item including tags, color, and history', () => {
    const item = makeItem('i1', 'v1');
    const back = rowToItem(itemToRow(item));
    expect(back.type).toBe('note');
    expect(back.isFlagged).toBe(true);
    expect(back.color).toBe('blue');
    expect(back.tags).toEqual(['alpha', 'beta']);
    expect(back.v).toBe(3);
    expectBytesEqual(back.encryptedPayload, item.encryptedPayload);
    expectBytesEqual(back.nonce, item.nonce);
    expect(back.history).toHaveLength(2);
    expectBytesEqual(back.history![0].payload, item.history![0].payload);
    expectBytesEqual(back.history![0].nonce, item.history![0].nonce);
    expect(back.history![0].updatedAt).toBe(item.history![0].updatedAt);
  });

  it('round-trips settings including booleans', () => {
    const settings = makeSettings('v1');
    expect(rowToSettings(settingsToRow(settings))).toEqual(settings);
    const off = { ...settings, autoArchiveCompleted: false };
    expect(rowToSettings(settingsToRow(off))).toEqual(off);
  });

  it('round-trips binary fields through the snapshot JSON codec', () => {
    const snapshot = { vaults: [makeVault('v1', true)], items: [makeItem('i1', 'v1')] };
    const decoded = decodeBinaryJson(encodeBinaryJson(snapshot)) as typeof snapshot;
    expectBytesEqual(decoded.vaults[0].challengeCiphertext, snapshot.vaults[0].challengeCiphertext);
    expectBytesEqual(decoded.items[0].history![0].payload, snapshot.items[0].history![0].payload);
  });

  it('challenge digest is stable and sensitive to the challenge bytes', async () => {
    const a = await vaultChallengeDigest(makeVault('v1'));
    const b = await vaultChallengeDigest(makeVault('v1'));
    expect(a).toBe(b);
    const tampered = { ...makeVault('v1'), challengeNonce: bytes(1, 1, 1) };
    expect(await vaultChallengeDigest(tampered)).not.toBe(a);
  });
});

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

describe('Dexie -> SQLite migration', () => {
  it('copies vaults, items, and settings and verifies clean', async () => {
    const source = seedSource();
    const target = new FakeBackend();
    const report = await runMigration(source, target);
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
    expect(await target.counts()).toEqual({ vaults: 2, items: 3, settings: 2 });

    const migratedItem = await target.getItem('i-2');
    expectBytesEqual(migratedItem!.encryptedPayload, makeItem('i-2', 'v-dek').encryptedPayload);
    expect(migratedItem!.history).toHaveLength(2);

    // Source is only ever read.
    expect(await source.counts()).toEqual({ vaults: 2, items: 3, settings: 2 });
  });

  it('is idempotent: a second run rebuilds the target and still verifies', async () => {
    const source = seedSource();
    const target = new FakeBackend();
    await runMigration(source, target);
    const report = await runMigration(source, target);
    expect(report.ok).toBe(true);
    expect(await target.counts()).toEqual({ vaults: 2, items: 3, settings: 2 });
  });

  it('fails verification when a challenge byte differs in the target', async () => {
    const source = seedSource();
    const target = new FakeBackend();
    target.corruptChallengesOnRead = true;
    const report = await runMigration(source, target);
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.includes('challenge material differs'))).toBe(true);
  });

  it('fails verification when an item is dropped during copy', async () => {
    const source = seedSource();
    const target = new FakeBackend();
    target.dropItemOnBulkPut = true;
    const report = await runMigration(source, target);
    expect(report.ok).toBe(false);
    expect(report.problems.length).toBeGreaterThan(0);
  });

  it('propagates copy failures so the caller keeps the legacy binding', async () => {
    const source = seedSource();
    const target = new FakeBackend();
    target.failOnBulkPutItems = true;
    await expect(runMigration(source, target)).rejects.toThrow('injected bulkPut failure');
  });

  it('verifyMigration on identical stores reports ok', async () => {
    const a = seedSource();
    const b = seedSource();
    const report = await verifyMigration(a, b);
    expect(report.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Facade (Dexie-shaped surface over a backend)
// ---------------------------------------------------------------------------

describe('storage facade', () => {
  function seededFacade() {
    const backend = seedSource();
    const facade = createFacade(() => backend);
    return { backend, facade };
  }

  it('where().equals() supports toArray / count / and() / delete()', async () => {
    const { backend, facade } = seededFacade();
    const items = await facade.items.where('vaultId').equals('v-dek').toArray();
    expect(items.map((i) => i.id).sort()).toEqual(['i-2', 'i-3']);
    expect(await facade.items.where('vaultId').equals('v-dek').count()).toBe(2);
    expect(
      await facade.items.where('vaultId').equals('v-dek').and((i) => i.type === 'note').count(),
    ).toBe(2);
    expect(
      await facade.items.where('vaultId').equals('v-dek').and((i) => i.type === 'task').count(),
    ).toBe(0);
    const deleted = await facade.items.where('vaultId').equals('v-dek').delete();
    expect(deleted).toBe(2);
    expect(await backend.countItemsByVault('v-dek')).toBe(0);
    expect(await backend.countItemsByVault('v-legacy')).toBe(1);
  });

  it('toCollection().modify() writes back only changed records', async () => {
    const backend = new FakeBackend();
    const facade = createFacade(() => backend);
    const item = makeItem('i-old', 'v-legacy');
    item.history = [
      { v: 1, payload: buf(1), nonce: bytes(1), updatedAt: 1000 }, // ancient
      { v: 2, payload: buf(2), nonce: bytes(2), updatedAt: Date.now() }, // fresh
    ];
    backend.items.set('i-old', item);
    backend.putItemCalls = [];

    const cutoff = Date.now() - 60_000;
    const modified = await facade.items.toCollection().modify((record) => {
      if (record.history) {
        record.history = record.history.filter((h) => h.updatedAt > cutoff);
      }
    });

    expect(modified).toBe(1);
    expect(backend.putItemCalls).toEqual(['i-old']);
    expect(backend.items.get('i-old')!.history).toHaveLength(1);
  });

  it('update() returns 1 for an existing record and 0 for a missing one', async () => {
    const { facade } = seededFacade();
    expect(await facade.vaults.update('v-legacy', { name: 'Renamed' })).toBe(1);
    expect((await facade.vaults.get('v-legacy'))!.name).toBe('Renamed');
    expect(await facade.vaults.update('missing', { name: 'Nope' })).toBe(0);
  });

  it('transaction() forwards table names and runs the callback', async () => {
    const { facade } = seededFacade();
    let seenTables: TableName[] = [];
    const spyBackend = seedSource();
    const originalTx = spyBackend.transaction.bind(spyBackend);
    spyBackend.transaction = async (mode, tables, cb) => {
      seenTables = tables;
      return originalTx(mode, tables, cb);
    };
    const facade2 = createFacade(() => spyBackend);
    await facade2.transaction('rw', facade2.items, facade2.vaults, async () => {
      await facade2.items.bulkPut([makeItem('i-9', 'v-legacy')]);
    });
    expect(seenTables).toEqual(['items', 'vaults']);
    expect(await spyBackend.getItem('i-9')).toBeDefined();
    void facade;
  });
});
