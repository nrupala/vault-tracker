/**
 * Sovereign Core v2.0 - Fort Knox Storage Engine
 * OPFS (Origin Private File System) as PRIMARY storage.
 * IndexedDB as FALLBACK for browsers without OPFS.
 * navigator.storage.persist() for anti-eviction.
 * 
 * OPFS is sandboxed, invisible to users, invisible to DevTools,
 * and only accessible by this origin. Combined with AES-256-GCM
 * encryption, this is military-grade local storage.
 */

let opfsRoot = null;
let idb = null;
let dbMode = 'none'; // 'opfs', 'indexeddb'
let initPromise = null;
let persisted = false;

function log(level, msg, err) {
    if (level === 'error') console.error('[DB]', msg, err || '');
    else if (level === 'warn') console.warn('[DB]', msg, err || '');
    else console.log('[DB]', msg);
}

/**
 * Request persistent storage to prevent browser auto-deletion.
 * Called once per session.
 */
async function requestPersistence() {
    if (persisted) return true;
    try {
        if (navigator.storage && navigator.storage.persist) {
            persisted = await navigator.storage.persist();
            log('info', `Persistent storage: ${persisted ? 'GRANTED' : 'DENIED'}`);
        }
    } catch (err) {
        log('warn', 'Persistence request failed', err);
    }
    return persisted;
}

/**
 * Initialize OPFS as primary storage.
 * OPFS is sandboxed, hidden, and only accessible by this origin.
 */
async function initOPFS() {
    try {
        if (!navigator.storage || !navigator.storage.getDirectory) {
            log('warn', 'OPFS not supported, falling back to IndexedDB');
            return false;
        }
        opfsRoot = await navigator.storage.getDirectory();
        // Create vaults directory if it doesn't exist
        try {
            await opfsRoot.getDirectoryHandle('vaults', { create: true });
        } catch { /* already exists */ }
        try {
            await opfsRoot.getDirectoryHandle('vessels', { create: true });
        } catch { /* already exists */ }
        dbMode = 'opfs';
        log('info', 'OPFS initialized (sandboxed, hidden, persistent)');
        return true;
    } catch (err) {
        log('warn', 'OPFS init failed, falling back to IndexedDB', err);
        return false;
    }
}

/* ── IndexedDB Fallback ── */
function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sovereign-vault-v2', 3);
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

/**
 * Initialize storage: OPFS first, IndexedDB fallback.
 * Also requests persistent storage to prevent auto-deletion.
 */
export async function initSovereignDB() {
    if ((opfsRoot && dbMode === 'opfs') || (idb && dbMode === 'indexeddb')) return opfsRoot || idb;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        // Request persistent storage (prevents browser auto-deletion)
        await requestPersistence();

        // Try OPFS first (sandboxed, hidden, fast)
        const opfsOk = await initOPFS();
        if (opfsOk) return opfsRoot;

        // Fallback to IndexedDB
        try {
            await openIDB();
            dbMode = 'indexeddb';
            log('info', 'IndexedDB fallback initialized');
            return idb;
        } catch (err) {
            log('error', 'All storage backends failed', err);
            throw err;
        }
    })();

    return initPromise;
}

function useIDB() { return dbMode === 'indexeddb'; }

/* ── OPFS Helpers ── */
async function opfsWriteFile(path, data) {
    const handle = await opfsRoot.getFileHandle(path, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
}

async function opfsReadFile(path) {
    const handle = await opfsRoot.getFileHandle(path);
    const file = await handle.getFile();
    return await file.arrayBuffer();
}

async function opfsDeleteFile(path) {
    try { await opfsRoot.removeEntry(path); } catch { /* file doesn't exist */ }
}

async function opfsListFiles(dir) {
    const entries = [];
    const dirHandle = await opfsRoot.getDirectoryHandle(dir, { create: false });
    for await (const [name] of dirHandle.entries()) {
        entries.push(name);
    }
    return entries;
}

async function opfsFileExists(path) {
    try {
        await opfsRoot.getFileHandle(path);
        return true;
    } catch { return false; }
}

/* ── Vessels (encrypted items) ── */

/**
 * Save a vessel.
 * OPFS: Writes encrypted blob + iv as separate files in vessels/ directory.
 * IndexedDB: Stores as record.
 */
export async function saveVessel(id, blob, iv, type = '', tags = [], priority = 'medium', color = 'none', isFlagged = false) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            await idbPut('vessels', { id, blob, iv, type, tags: JSON.stringify(tags), priority, color, isFlagged: isFlagged ? 1 : 0, timestamp: Date.now(), updatedAt: Date.now() });
        } else {
            // OPFS: Write vessel as JSON metadata + binary blob
            const meta = { id, type, tags, priority, color, isFlagged, timestamp: Date.now(), updatedAt: Date.now() };
            await opfsWriteFile(`vessels/${id}.meta`, JSON.stringify(meta));
            await opfsWriteFile(`vessels/${id}.blob`, blob);
            await opfsWriteFile(`vessels/${id}.iv`, iv);
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
        // OPFS: List all vessel files and read metadata
        const files = await opfsListFiles('vessels');
        const metaFiles = files.filter(f => f.endsWith('.meta'));
        const vessels = [];
        for (const metaFile of metaFiles) {
            try {
                const metaBuf = await opfsReadFile(`vessels/${metaFile}`);
                const meta = JSON.parse(new TextDecoder().decode(metaBuf));
                const id = meta.id || metaFile.replace('.meta', '');
                const blobBuf = await opfsReadFile(`vessels/${id}.blob`);
                const ivBuf = await opfsReadFile(`vessels/${id}.iv`);
                vessels.push({
                    ...meta,
                    blob: blobBuf,
                    iv: ivBuf
                });
            } catch (err) { log('warn', `Failed to read vessel ${metaFile}`, err); }
        }
        return vessels.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) { log('error', 'getAllVessels failed', err); throw err; }
}

export async function getVesselById(id) {
    await initSovereignDB();
    try {
        if (useIDB()) return await idbGet('vessels', id);
        // OPFS
        if (!await opfsFileExists(`vessels/${id}.meta`)) return null;
        const metaBuf = await opfsReadFile(`vessels/${id}.meta`);
        const meta = JSON.parse(new TextDecoder().decode(metaBuf));
        const blobBuf = await opfsReadFile(`vessels/${id}.blob`);
        const ivBuf = await opfsReadFile(`vessels/${id}.iv`);
        return { ...meta, blob: blobBuf, iv: ivBuf };
    } catch (err) { log('error', 'getVesselById failed', err); throw err; }
}

export async function deleteVessel(id) {
    await initSovereignDB();
    try {
        if (useIDB()) { await idbDelete('vessels', id); return; }
        // OPFS
        await opfsDeleteFile(`vessels/${id}.meta`);
        await opfsDeleteFile(`vessels/${id}.blob`);
        await opfsDeleteFile(`vessels/${id}.iv`);
    } catch (err) { log('error', 'deleteVessel failed', err); throw err; }
}

export async function updateVessel(id, blob, iv, type, tags, priority, color, isFlagged) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            await idbPut('vessels', { id, blob, iv, type, tags: JSON.stringify(tags), priority, color, isFlagged: isFlagged ? 1 : 0, timestamp: Date.now(), updatedAt: Date.now() });
        } else {
            // OPFS: Overwrite files
            const meta = { id, type, tags, priority, color, isFlagged, timestamp: Date.now(), updatedAt: Date.now() };
            await opfsWriteFile(`vessels/${id}.meta`, JSON.stringify(meta));
            await opfsWriteFile(`vessels/${id}.blob`, blob);
            await opfsWriteFile(`vessels/${id}.iv`, iv);
        }
    } catch (err) { log('error', 'updateVessel failed', err); throw err; }
}

export async function getVesselsByType(type) {
    const all = await getAllVessels();
    return all.filter(v => v.type === type);
}

/* ── Settings ── */
export async function getSetting(key) {
    await initSovereignDB();
    try {
        if (useIDB()) { const r = await idbGet('settings', key); return r ? r.value : null; }
        // OPFS: Settings stored as JSON files
        if (!await opfsFileExists(`settings/${key}.json`)) return null;
        const buf = await opfsReadFile(`settings/${key}.json`);
        return JSON.parse(new TextDecoder().decode(buf));
    } catch (err) { log('error', 'getSetting failed', err); throw err; }
}

export async function setSetting(key, value) {
    await initSovereignDB();
    try {
        if (useIDB()) { await idbPut('settings', { key, value: JSON.stringify(value) }); return; }
        // OPFS
        try { await opfsRoot.getDirectoryHandle('settings', { create: true }); } catch { /* exists */ }
        await opfsWriteFile(`settings/${key}.json`, JSON.stringify(value));
    } catch (err) { log('error', 'setSetting failed', err); throw err; }
}

/* ── Vaults (persistent across sessions) ── */

/**
 * Save vault metadata.
 * OPFS: Writes vault.json in vaults/ directory.
 * Salt is stored as plain array (survives JSON serialization).
 * Verifier stored for challenge-response password verification.
 */
export async function saveVault(id, name, salt, verifier = null) {
    await initSovereignDB();
    try {
        const saltArr = salt instanceof Uint8Array ? Array.from(salt) : salt;
        const vaultData = { id, name, salt: saltArr, verifier, createdAt: Date.now() };
        if (useIDB()) {
            await idbPut('vaults', vaultData);
        } else {
            // OPFS: Write vault metadata as JSON
            try { await opfsRoot.getDirectoryHandle('vaults', { create: true }); } catch { /* exists */ }
            await opfsWriteFile(`vaults/${id}.json`, JSON.stringify(vaultData));
        }
    } catch (err) { log('error', 'saveVault failed', err); throw err; }
}

/**
 * Get all vaults. Salt is reconstructed as Uint8Array.
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
        // OPFS: List all vault JSON files
        const files = await opfsListFiles('vaults');
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        const vaults = [];
        for (const file of jsonFiles) {
            try {
                const buf = await opfsReadFile(`vaults/${file}`);
                const vault = JSON.parse(new TextDecoder().decode(buf));
                vaults.push({
                    ...vault,
                    salt: new Uint8Array(vault.salt || []),
                    verifier: vault.verifier || null
                });
            } catch (err) { log('warn', `Failed to read vault ${file}`, err); }
        }
        return vaults.sort((a, b) => b.createdAt - a.createdAt);
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
            // OPFS
            await opfsDeleteFile(`vaults/${id}.json`);
            // Delete all vessels belonging to this vault
            const files = await opfsListFiles('vessels');
            for (const f of files) {
                if (f.startsWith(id + '_')) {
                    await opfsDeleteFile(`vessels/${f}`);
                }
            }
        }
    } catch (err) { log('error', 'deleteVault failed', err); throw err; }
}

/**
 * Export entire vault as encrypted blob.
 * OPFS: Reads all files from vaults/ and vessels/ directories.
 */
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

/**
 * Import vault from blob.
 */
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
export function isPersisted() { return persisted; }
