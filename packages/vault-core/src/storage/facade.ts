// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Dexie-shaped facade over the active StoreBackend (@vault/core).
 *
 * Reproduces exactly the surface the package hooks use — get / add / put /
 * bulkPut / update / delete / toArray / where().equals() collections with
 * toArray / count / delete / and / modify, plus transaction() and table() —
 * on top of whichever backend is bound (SQLite after the verified
 * migration, legacy Dexie before it or if migration could not be verified).
 * Mirrors the app copy's storage/facade.ts, trimmed to vaults + items.
 */
import { encodeBinaryJson } from './codec';
import type { StoreBackend } from './store';
import type { EncryptedItem, TableName, Vault } from './types';

/** Returns the active backend, or a promise for it while init is running. */
export type BackendResolver = () => StoreBackend | Promise<StoreBackend>;

interface TableOps<T> {
  get(backend: StoreBackend, id: string): Promise<T | undefined>;
  add(backend: StoreBackend, record: T): Promise<void>;
  put(backend: StoreBackend, record: T): Promise<void>;
  bulkPut(backend: StoreBackend, records: T[]): Promise<void>;
  update(backend: StoreBackend, id: string, changes: Partial<T>): Promise<number>;
  remove(backend: StoreBackend, id: string): Promise<void>;
  all(backend: StoreBackend): Promise<T[]>;
}

export class FacadeCollection<T extends { id: string }> {
  constructor(
    private readonly resolve: BackendResolver,
    private readonly table: FacadeTable<T>,
    private readonly fetchRows: (backend: StoreBackend) => Promise<T[]>,
  ) {}

  private async rows(): Promise<T[]> {
    const backend = await this.resolve();
    return this.fetchRows(backend);
  }

  async toArray(): Promise<T[]> {
    return this.rows();
  }

  async count(): Promise<number> {
    return (await this.rows()).length;
  }

  and(predicate: (record: T) => boolean): FacadeCollection<T> {
    return new FacadeCollection<T>(this.resolve, this.table, async (backend) =>
      (await this.fetchRows(backend)).filter(predicate),
    );
  }

  async delete(): Promise<number> {
    const rows = await this.rows();
    if (!rows.length) return 0;
    const backend = await this.resolve();
    return backend.deleteByIds(this.table.tableName, rows.map((r) => r.id));
  }

  /** Dexie Collection.modify: mutate each record in place; changed rows are written back. */
  async modify(mutator: (record: T) => boolean | void): Promise<number> {
    const rows = await this.rows();
    let modified = 0;
    for (const row of rows) {
      const before = encodeBinaryJson(row);
      if (mutator(row) === false) continue;
      if (encodeBinaryJson(row) !== before) {
        await this.table.put(row);
        modified++;
      }
    }
    return modified;
  }
}

export class FacadeWhereClause<T extends { id: string }> {
  constructor(
    private readonly resolve: BackendResolver,
    private readonly table: FacadeTable<T>,
    private readonly field: string,
  ) {}

  equals(value: unknown): FacadeCollection<T> {
    return new FacadeCollection<T>(
      this.resolve,
      this.table,
      async (backend) =>
        (await backend.selectWhere(this.table.tableName, this.field, value)) as T[],
    );
  }
}

export class FacadeTable<T extends { id: string }> {
  constructor(
    private readonly resolve: BackendResolver,
    readonly tableName: TableName,
    private readonly ops: TableOps<T>,
  ) {}

  private async backend(): Promise<StoreBackend> {
    return this.resolve();
  }

  async get(id: string): Promise<T | undefined> {
    return this.ops.get(await this.backend(), id);
  }
  async add(record: T): Promise<void> {
    return this.ops.add(await this.backend(), record);
  }
  async put(record: T): Promise<void> {
    return this.ops.put(await this.backend(), record);
  }
  async bulkPut(records: T[]): Promise<void> {
    return this.ops.bulkPut(await this.backend(), records);
  }
  async update(id: string, changes: Partial<T>): Promise<number> {
    return this.ops.update(await this.backend(), id, changes);
  }
  async delete(id: string): Promise<void> {
    return this.ops.remove(await this.backend(), id);
  }
  async toArray(): Promise<T[]> {
    return this.ops.all(await this.backend());
  }
  where(field: string): FacadeWhereClause<T> {
    return new FacadeWhereClause<T>(this.resolve, this, field);
  }
  toCollection(): FacadeCollection<T> {
    return new FacadeCollection<T>(this.resolve, this, (backend) => this.ops.all(backend));
  }
}

export interface VaultFacade {
  vaults: FacadeTable<Vault>;
  items: FacadeTable<EncryptedItem>;
  transaction(mode: string, ...args: unknown[]): Promise<unknown>;
  table(name: TableName): FacadeTable<never>;
}

export function createFacade(resolve: BackendResolver): VaultFacade {
  const vaults = new FacadeTable<Vault>(resolve, 'vaults', {
    get: (b, id) => b.getVault(id),
    add: (b, r) => b.addVault(r),
    put: (b, r) => b.putVault(r),
    bulkPut: (b, rows) => b.bulkPutVaults(rows),
    update: (b, id, changes) => b.updateVault(id, changes),
    remove: (b, id) => b.deleteVault(id),
    all: (b) => b.allVaults(),
  });
  const items = new FacadeTable<EncryptedItem>(resolve, 'items', {
    get: (b, id) => b.getItem(id),
    add: (b, r) => b.addItem(r),
    put: (b, r) => b.putItem(r),
    bulkPut: (b, rows) => b.bulkPutItems(rows),
    update: (b, id, changes) => b.updateItem(id, changes),
    remove: (b, id) => b.deleteItem(id),
    all: (b) => b.allItems(),
  });

  const tables: Record<TableName, FacadeTable<never>> = {
    vaults: vaults as FacadeTable<never>,
    items: items as FacadeTable<never>,
  };

  return {
    vaults,
    items,
    table(name: TableName) {
      return tables[name];
    },
    async transaction(mode: string, ...args: unknown[]) {
      const cb = args[args.length - 1] as () => Promise<unknown>;
      const names = (args.slice(0, -1) as FacadeTable<never>[]).map((t) => t.tableName);
      const backend = await resolve();
      return backend.transaction(mode, names, cb);
    },
  };
}
