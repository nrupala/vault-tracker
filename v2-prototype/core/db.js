/**
 * Sovereign Core v2.0 - Database Engine
 * SQLite WASM with IndexedDB fallback when OPFS/SharedArrayBuffer unavailable.
 */

let db = null;
let dbMode = 'none'; // 'opfs', 'memory', 'indexeddb'
let initPromise = null;

function log(level, msg, err) {
    if (level === 'error') console.error('[DB]', msg, err || '');
    else if (level === 'warn') console.warn('[DB]', msg, err || '');
    else console.log('[DB]', msg);
}

async function tryInitSQLite() {
    try {
        const mod = await import('./sqlite3.js');
        const sqlite3InitModule = mod.default;
        const sqlite3 = await sqlite3InitModule();
        if (sqlite3.oo1.OpfsDb) {
            db = new sqlite3.oo1.OpfsDb('/sovereign-vault-v2.db');
            dbMode = 'opfs';
            log('info', 'SQLite initialized on OPFS');
        } else {
            db = new sqlite3.oo1.DB(':memory:');
            dbMode = 'memory';
            log('warn', 'OPFS unavailable, using in-memory DB');
        }
        return true;
    } catch (err) {
        log('warn', 'SQLite WASM failed (COOP/COEP headers required), falling back to IndexedDB', err);
        return false;
    }
}

// ── IndexedDB Fallback ──
let idb = null;

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sovereign-vault-v2', 1);
        req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains('vessels')) d.createObjectStore('vessels', { keyPath: 'id' });
            if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
            if (!d.objectStoreNames.contains('vaults')) d.createObjectStore('vaults', { keyPath: 'id' });
        };
        req.onsuccess = () => { idb = req.result; resolve(); };
        req.onerror = () => reject(req.error);
    });
}

function idbTx(store, mode = 'readonly') {
    return idb.transaction(store, mode).objectStore(store);
}

function idbGetAll(store) {
    return new Promise((resolve, reject) => {
        const req = idbTx(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(store, data) {
    return new Promise((resolve, reject) => {
        const req = idbTx(store, 'readwrite').put(data);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function idbDelete(store, key) {
    return new Promise((resolve, reject) => {
        const req = idbTx(store, 'readwrite').delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function idbGet(store, key) {
    return new Promise((resolve, reject) => {
        const req = idbTx(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function initSovereignDB() {
    if (db || idb) return db || idb;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const sqliteOk = await tryInitSQLite();
        if (sqliteOk) {
            try {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS vessels (
                        id TEXT PRIMARY KEY, blob BLOB, iv BLOB, type TEXT,
                        tags TEXT, priority TEXT DEFAULT 'medium', color TEXT DEFAULT 'none',
                        isFlagged INTEGER DEFAULT 0, timestamp INTEGER, updatedAt INTEGER
                    );
                    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
                    CREATE TABLE IF NOT EXISTS vaults (id TEXT PRIMARY KEY, name TEXT, salt BLOB, createdAt INTEGER);
                `);
            } catch (err) { log('error', 'SQLite schema creation failed', err); throw err; }
            return db;
        }

        // Fallback to IndexedDB
        try {
            await openIDB();
            dbMode = 'indexeddb';
            log('info', 'IndexedDB fallback initialized');
            return idb;
        } catch (err) { log('error', 'All storage backends failed', err); throw err; }
    })();

    return initPromise;
}

function useIDB() { return dbMode === 'indexeddb'; }

export async function saveVessel(id, blob, iv, type = '', tags = [], priority = 'medium', color = 'none', isFlagged = false) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            await idbPut('vessels', { id, blob, iv, type, tags: JSON.stringify(tags), priority, color, isFlagged: isFlagged ? 1 : 0, timestamp: Date.now(), updatedAt: Date.now() });
        } else {
            db.exec({ sql: 'INSERT OR REPLACE INTO vessels VALUES (?,?,?,?,?,?,?,?,?,?)',
                bind: [id, blob, iv, type, JSON.stringify(tags), priority, color, isFlagged ? 1 : 0, Date.now(), Date.now()] });
        }
    } catch (err) { log('error', 'saveVessel failed', err); throw err; }
}

export async function getAllVessels() {
    await initSovereignDB();
    try {
        if (useIDB()) {
            const rows = await idbGetAll('vessels');
            return rows.sort((a, b) => b.timestamp - a.timestamp);
        }
        const rows = [];
        db.exec({ sql: 'SELECT * FROM vessels ORDER BY timestamp DESC', rowMode: 'object', callback: r => rows.push(r) });
        return rows;
    } catch (err) { log('error', 'getAllVessels failed', err); throw err; }
}

export async function getVesselById(id) {
    await initSovereignDB();
    try {
        if (useIDB()) return await idbGet('vessels', id);
        let v = null;
        db.exec({ sql: 'SELECT * FROM vessels WHERE id = ?', bind: [id], rowMode: 'object', callback: r => { v = r; } });
        return v;
    } catch (err) { log('error', 'getVesselById failed', err); throw err; }
}

export async function deleteVessel(id) {
    await initSovereignDB();
    try {
        if (useIDB()) { await idbDelete('vessels', id); return; }
        db.exec({ sql: 'DELETE FROM vessels WHERE id = ?', bind: [id] });
    } catch (err) { log('error', 'deleteVessel failed', err); throw err; }
}

export async function updateVessel(id, blob, iv, type, tags, priority, color, isFlagged) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            await idbPut('vessels', { id, blob, iv, type, tags: JSON.stringify(tags), priority, color, isFlagged: isFlagged ? 1 : 0, timestamp: Date.now(), updatedAt: Date.now() });
        } else {
            db.exec({ sql: 'UPDATE vessels SET blob=?,iv=?,type=?,tags=?,priority=?,color=?,isFlagged=?,updatedAt=? WHERE id=?',
                bind: [blob, iv, type, JSON.stringify(tags), priority, color, isFlagged ? 1 : 0, Date.now(), id] });
        }
    } catch (err) { log('error', 'updateVessel failed', err); throw err; }
}

export async function getVesselsByType(type) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            const rows = await idbGetAll('vessels');
            return rows.filter(r => r.type === type).sort((a, b) => b.timestamp - a.timestamp);
        }
        const rows = [];
        db.exec({ sql: 'SELECT * FROM vessels WHERE type = ? ORDER BY timestamp DESC', bind: [type], rowMode: 'object', callback: r => rows.push(r) });
        return rows;
    } catch (err) { log('error', 'getVesselsByType failed', err); throw err; }
}

export async function getSetting(key) {
    await initSovereignDB();
    try {
        if (useIDB()) { const r = await idbGet('settings', key); return r ? r.value : null; }
        let v = null;
        db.exec({ sql: 'SELECT value FROM settings WHERE key = ?', bind: [key], rowMode: 'object', callback: r => { v = r ? r.value : null; } });
        return v;
    } catch (err) { log('error', 'getSetting failed', err); throw err; }
}

export async function setSetting(key, value) {
    await initSovereignDB();
    try {
        if (useIDB()) { await idbPut('settings', { key, value: JSON.stringify(value) }); return; }
        db.exec({ sql: 'INSERT OR REPLACE INTO settings VALUES (?,?)', bind: [key, JSON.stringify(value)] });
    } catch (err) { log('error', 'setSetting failed', err); throw err; }
}

export async function saveVault(id, name, salt) {
    await initSovereignDB();
    try {
        if (useIDB()) { await idbPut('vaults', { id, name, salt, createdAt: Date.now() }); return; }
        db.exec({ sql: 'INSERT OR REPLACE INTO vaults VALUES (?,?,?,?)', bind: [id, name, salt, Date.now()] });
    } catch (err) { log('error', 'saveVault failed', err); throw err; }
}

export async function getAllVaults() {
    await initSovereignDB();
    try {
        if (useIDB()) {
            const rows = await idbGetAll('vaults');
            return rows.sort((a, b) => b.createdAt - a.createdAt);
        }
        const rows = [];
        db.exec({ sql: 'SELECT * FROM vaults ORDER BY createdAt DESC', rowMode: 'object', callback: r => rows.push(r) });
        return rows;
    } catch (err) { log('error', 'getAllVaults failed', err); throw err; }
}

export async function exportVaultToBlob() {
    try {
        if (!navigator.storage || !navigator.storage.getDirectory) {
            throw new Error('File System Access API not supported. Use export JSON/CSV instead.');
        }
        const root = await navigator.storage.getDirectory();
        const fh = await root.getFileHandle('sovereign-vault-v2.db');
        return await fh.getFile();
    } catch (err) {
        log('error', 'exportVaultToBlob failed', err);
        throw new Error('Vault export failed: ' + (err.message || 'Unknown error'));
    }
}

export async function importVaultFromBlob(fileBlob) {
    try {
        if (!(fileBlob instanceof Blob)) {
            throw new Error('Import requires a valid Blob or File object.');
        }
        if (!navigator.storage || !navigator.storage.getDirectory) {
            throw new Error('File System Access API not supported. Use import JSON/CSV instead.');
        }
        const root = await navigator.storage.getDirectory();
        const fh = await root.getFileHandle('sovereign-vault-v2.db', { create: true });
        const w = await fh.createWritable();
        await w.write(fileBlob);
        await w.close();
        log('info', 'Vault imported from blob. Reload required.');
        return true;
    } catch (err) {
        log('error', 'importVaultFromBlob failed', err);
        throw new Error('Vault import failed: ' + (err.message || 'Unknown error'));
    }
}

export function getDBMode() { return dbMode; }
