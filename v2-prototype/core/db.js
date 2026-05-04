/**
 * Sovereign Core v2.0 - Fort Knox Storage Engine
 * 
 * Architecture (per Master Plan):
 * - OPFS is PRIMARY for ALL data (vaults, vessels, settings)
 * - IndexedDB is FALLBACK only (browsers without OPFS)
 * - Auto-migration: IndexedDB → OPFS on first OPFS init
 * - navigator.storage.persist() prevents auto-deletion
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

async function requestPersistence() {
    if (persisted) return true;
    try {
        if (navigator.storage && navigator.storage.persist) {
            persisted = await navigator.storage.persist();
            log('info', `Persistent storage: ${persisted ? 'GRANTED' : 'DENIED'}`);
        }
    } catch (err) { log('warn', 'Persistence request failed', err); }
    return persisted;
}

async function initOPFS() {
    try {
        if (!navigator.storage || !navigator.storage.getDirectory) return false;
        opfsRoot = await navigator.storage.getDirectory();
        try { await opfsRoot.getDirectoryHandle('vessels', { create: true }); } catch {}
        try { await opfsRoot.getDirectoryHandle('vaults', { create: true }); } catch {}
        try { await opfsRoot.getDirectoryHandle('settings', { create: true }); } catch {}
        dbMode = 'opfs';
        log('info', 'OPFS initialized (PRIMARY storage)');
        return true;
    } catch (err) { log('warn', 'OPFS init failed', err); return false; }
}

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sovereign-vault-v2', 4);
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

function idbTx(store, mode = 'readonly') { return idb.transaction(store, mode).objectStore(store); }
function idbGetAll(store) { return new Promise((resolve, reject) => { const req = idbTx(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function idbPut(store, data) { return new Promise((resolve, reject) => { const req = idbTx(store, 'readwrite').put(data); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); }
function idbDelete(store, key) { return new Promise((resolve, reject) => { const req = idbTx(store, 'readwrite').delete(key); req.onsuccess = () => resolve(); req.onerror = () => reject(req.error); }); }
function idbGet(store, key) { return new Promise((resolve, reject) => { const req = idbTx(store).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }

/* ── OPFS Helpers ── */
async function opfsGetHandle(path) {
    const parts = path.split('/');
    let current = opfsRoot;
    for (let i = 0; i < parts.length - 1; i++) current = await current.getDirectoryHandle(parts[i], { create: true });
    return current.getFileHandle(parts[parts.length - 1], { create: true });
}
async function opfsWriteFile(path, data) { const h = await opfsGetHandle(path); const w = await h.createWritable(); await w.write(data); await w.close(); }
async function opfsReadFile(path) { const h = await opfsGetHandle(path); const f = await h.getFile(); return await f.arrayBuffer(); }
async function opfsDeleteFile(path) { try { const parts = path.split('/'); let c = opfsRoot; for (let i = 0; i < parts.length - 1; i++) c = await c.getDirectoryHandle(parts[i]); await c.removeEntry(parts[parts.length - 1]); } catch {} }
async function opfsListDir(dir) { const entries = []; const dh = await opfsRoot.getDirectoryHandle(dir); for await (const [name] of dh.entries()) entries.push(name); return entries; }
async function opfsFileExists(path) { try { await opfsGetHandle(path); return true; } catch { return false; } }

/**
 * Initialize storage: OPFS PRIMARY, IndexedDB FALLBACK.
 * Auto-migrates IndexedDB → OPFS on first OPFS init.
 */
export async function initSovereignDB() {
    if ((opfsRoot && dbMode === 'opfs') || (idb && dbMode === 'indexeddb')) return opfsRoot || idb;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        await requestPersistence();

        // ALWAYS open IndexedDB first (for legacy vault discovery)
        await openIDB();

        // Try OPFS (PRIMARY for new data)
        const opfsOk = await initOPFS();
        if (opfsOk) {
            // Migrate any existing IndexedDB data → OPFS
            await migrateIDBToOPFS();
            return opfsRoot;
        }

        // Fallback: use IndexedDB for everything
        dbMode = 'indexeddb';
        log('warn', 'OPFS unavailable — using IndexedDB (FALLBACK)');
        return idb;
    })();

    return initPromise;
}

function useIDB() { return dbMode === 'indexeddb'; }

/**
 * Migrate IndexedDB → OPFS. Runs once.
 * Moves vaults, vessels, and settings to OPFS, then clears IndexedDB.
 */
async function migrateIDBToOPFS() {
    try {
        if (!opfsRoot) return;
        const flag = await opfsFileExists('settings/__migrated.json');
        if (flag) { log('info', 'OPFS migration already complete'); return; }

        // Open IndexedDB to check for legacy data
        await openIDB();
        const vaults = await idbGetAll('vaults');
        const vessels = await idbGetAll('vessels');
        const settings = await idbGetAll('settings');

        if (!vaults.length && !vessels.length) {
            // Nothing to migrate
            await opfsWriteFile('settings/__migrated.json', JSON.stringify({ timestamp: Date.now() }));
            return;
        }

        log('info', `Migrating ${vaults.length} vaults, ${vessels.length} vessels to OPFS...`);

        // Migrate vaults
        for (const v of vaults) {
            const vaultData = { ...v, salt: v.salt instanceof Uint8Array ? Array.from(v.salt) : v.salt };
            await opfsWriteFile(`vaults/${v.id}.json`, JSON.stringify(vaultData));
        }

        // Migrate vessels
        for (const v of vessels) {
            const meta = { id: v.id, type: v.type, tags: v.tags, priority: v.priority, color: v.color, isFlagged: v.isFlagged, timestamp: v.timestamp, updatedAt: v.updatedAt };
            await opfsWriteFile(`vessels/${v.id}.meta`, JSON.stringify(meta));
            await opfsWriteFile(`vessels/${v.id}.blob`, v.blob);
            await opfsWriteFile(`vessels/${v.id}.iv`, v.iv);
        }

        // Migrate settings
        for (const s of settings) {
            if (s.key === '__opfs_migration_done') continue;
            await opfsWriteFile(`settings/${s.key}.json`, s.value);
        }

        // Clear IndexedDB (data now in OPFS)
        for (const v of vessels) { try { await idbDelete('vessels', v.id); } catch {} }
        for (const v of vaults) { try { await idbDelete('vaults', v.id); } catch {} }
        for (const s of settings) { try { await idbDelete('settings', s.key); } catch {} }

        await opfsWriteFile('settings/__migrated.json', JSON.stringify({ timestamp: Date.now(), vaults: vaults.length, vessels: vessels.length }));
        log('info', `Migration complete: ${vaults.length} vaults, ${vessels.length} vessels moved to OPFS`);
    } catch (err) { log('error', 'Migration failed', err); }
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
        const files = await opfsListDir('vessels');
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

/* ── Vaults ── */
export async function saveVault(id, name, salt, verifier = null) {
    await initSovereignDB();
    try {
        const saltArr = salt instanceof Uint8Array ? Array.from(salt) : salt;
        const vaultData = { id, name, salt: saltArr, verifier, createdAt: Date.now() };
        if (useIDB()) {
            await idbPut('vaults', vaultData);
        } else {
            await opfsWriteFile(`vaults/${id}.json`, JSON.stringify(vaultData));
        }
    } catch (err) { log('error', 'saveVault failed', err); throw err; }
}

export async function getAllVaults() {
    await initSovereignDB();
    try {
        const vaults = [];
        
        // Always check IndexedDB first (legacy vaults)
        if (idb) {
            try {
                const idbVaults = await idbGetAll('vaults');
                for (const r of idbVaults) {
                    let salt;
                    if (r.salt instanceof Uint8Array) {
                        salt = r.salt;
                    } else if (r.salt instanceof ArrayBuffer) {
                        salt = new Uint8Array(r.salt);
                    } else if (Array.isArray(r.salt)) {
                        salt = new Uint8Array(r.salt);
                    } else if (typeof r.salt === 'string') {
                        const binary = atob(r.salt);
                        salt = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) salt[i] = binary.charCodeAt(i);
                    } else {
                        salt = new Uint8Array(0);
                    }
                    vaults.push({ ...r, salt, verifier: r.verifier || null });
                }
            } catch (err) { log('warn', 'IDB vault read failed', err); }
        }
        
        // Also check OPFS (new vaults)
        if (opfsRoot) {
            try {
                const files = await opfsListDir('vaults');
                for (const f of files.filter(f => f.endsWith('.json'))) {
                    try {
                        const buf = await opfsReadFile(`vaults/${f}`);
                        const v = JSON.parse(new TextDecoder().decode(buf));
                        let salt;
                        if (v.salt instanceof Uint8Array) {
                            salt = v.salt;
                        } else if (v.salt instanceof ArrayBuffer) {
                            salt = new Uint8Array(v.salt);
                        } else if (Array.isArray(v.salt)) {
                            salt = new Uint8Array(v.salt);
                        } else {
                            salt = new Uint8Array(v.salt || []);
                        }
                        if (!vaults.find(existing => existing.id === v.id)) {
                            vaults.push({ ...v, salt, verifier: v.verifier || null });
                        }
                    } catch (err) { log('warn', `Failed to read vault ${f}`, err); }
                }
            } catch (err) { log('warn', 'OPFS vault read failed', err); }
        }
        
        return vaults.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) { log('error', 'getAllVaults failed', err); throw err; }
}

export async function deleteVault(id) {
    await initSovereignDB();
    try {
        if (useIDB()) {
            await idbDelete('vaults', id);
            const vessels = await idbGetAll('vessels');
            for (const v of vessels) { if (v.id.startsWith(id + '_')) await idbDelete('vessels', v.id); }
        } else {
            await opfsDeleteFile(`vaults/${id}.json`);
            const files = await opfsListDir('vessels');
            for (const f of files) { if (f.startsWith(id + '_')) await opfsDeleteFile(`vessels/${f}`); }
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
