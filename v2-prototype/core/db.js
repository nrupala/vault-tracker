/**
 * Sovereign Core v2.0 - Database Engine
 * IndexedDB-first (persistent) with SQLite WASM fallback.
 * Salt stored as plain array (survives structured clone across reloads).
 * Verifier stored for challenge-response password verification.
 */

let db = null;
let dbMode = 'none';
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
            log('info', 'SQLite OPFS initialized');
        } else {
            db = new sqlite3.oo1.DB(':memory:');
            dbMode = 'memory';
            log('warn', 'OPFS unavailable, using in-memory SQLite');
        }
        return true;
    } catch (err) {
        log('warn', 'SQLite failed, using IndexedDB', err);
        return false;
    }
}

/* ── IndexedDB (persistent, survives reload) ── */
let idb = null;

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sovereign-vault-v2', 2);
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
                    CREATE TABLE IF NOT EXISTS vaults (id TEXT PRIMARY KEY, name TEXT, salt BLOB, verifier BLOB, createdAt INTEGER);
                `);
            } catch (err) { log('error', 'SQLite schema failed', err); throw err; }
            return db;
        }
        try {
            await openIDB();
            dbMode = 'indexeddb';
            log('info', 'IndexedDB initialized (persistent)');
            return idb;
        } catch (err) { log('error', 'All storage backends failed', err); throw err; }
    })();
    return initPromise;
}

function useIDB() { return dbMode === 'indexeddb'; }

/* ── Vessels ── */
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

/* ── Settings ── */
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

/* ── Vaults (persistent across sessions) ── */

/**
 * Save vault with challenge-verifier.
 * Salt is stored as plain array (survives IndexedDB structured clone).
 * Verifier is stored as { ciphertext: ArrayBuffer, iv: ArrayBuffer } for password verification.
 */
export async function saveVault(id, name, salt, verifier = null) {
    await initSovereignDB();
    try {
        // Convert Uint8Array to plain array for IndexedDB persistence
        const saltArr = salt instanceof Uint8Array ? Array.from(salt) : salt;
        if (useIDB()) {
            await idbPut('vaults', { id, name, salt: saltArr, verifier, createdAt: Date.now() });
        } else {
            const saltBlob = salt instanceof Uint8Array ? salt : new Uint8Array(salt);
            db.exec({ sql: 'INSERT OR REPLACE INTO vaults VALUES (?,?,?,?,?)',
                bind: [id, name, saltBlob, verifier ? verifier.ciphertext : null, Date.now()] });
        }
    } catch (err) { log('error', 'saveVault failed', err); throw err; }
}

/**
 * Get all vaults. Salt is reconstructed as Uint8Array from stored array.
 * Verifier is preserved for challenge-response authentication.
 */
export async function getAllVaults() {
    await initSovereignDB();
    try {
        if (useIDB()) {
            const rows = await idbGetAll('vaults');
            return rows.map(r => ({
                ...r,
                salt: new Uint8Array(r.salt || []),
                verifier: r.verifier || null
            })).sort((a, b) => b.createdAt - a.createdAt);
        }
        const rows = [];
        db.exec({ sql: 'SELECT * FROM vaults ORDER BY createdAt DESC', rowMode: 'object', callback: r => rows.push(r) });
        return rows.map(r => ({
            ...r,
            salt: r.salt instanceof Uint8Array ? r.salt : new Uint8Array(r.salt || []),
            verifier: r.verifier ? { ciphertext: r.verifier, iv: new Uint8Array(12) } : null
        }));
    } catch (err) { log('error', 'getAllVaults failed', err); throw err; }
}

/**
 * Delete a vault and all its vessels.
 */
export async function deleteVault(id) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            await idbDelete('vaults', id);
            const vessels = await idbGetAll('vessels');
            for (const v of vessels) {
                if (v.id.startsWith(id + '_')) await idbDelete('vessels', v.id);
            }
        } else {
            db.exec({ sql: 'DELETE FROM vaults WHERE id = ?', bind: [id] });
            db.exec({ sql: 'DELETE FROM vessels WHERE id LIKE ?', bind: [id + '_%'] });
        }
    } catch (err) { log('error', 'deleteVault failed', err); throw err; }
}

export async function exportVaultToBlob() {
    try {
        if (!navigator.storage || !navigator.storage.getDirectory) throw new Error('File System API not supported. Use JSON/CSV export.');
        const root = await navigator.storage.getDirectory();
        const fh = await root.getFileHandle('sovereign-vault-v2.db');
        return await fh.getFile();
    } catch (err) {
        log('error', 'exportVaultToBlob failed', err);
        throw new Error('Export failed: ' + (err.message || 'Unknown'));
    }
}

export async function importVaultFromBlob(fileBlob) {
    try {
        if (!(fileBlob instanceof Blob)) throw new Error('Requires a valid Blob/File.');
        if (!navigator.storage || !navigator.storage.getDirectory) throw new Error('File System API not supported.');
        const root = await navigator.storage.getDirectory();
        const fh = await root.getFileHandle('sovereign-vault-v2.db', { create: true });
        const w = await fh.createWritable();
        await w.write(fileBlob);
        await w.close();
        log('info', 'Vault imported. Reload required.');
        return true;
    } catch (err) {
        log('error', 'importVaultFromBlob failed', err);
        throw new Error('Import failed: ' + (err.message || 'Unknown'));
    }
}

export function getDBMode() { return dbMode; }
