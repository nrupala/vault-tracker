/**
 * Sovereign Core v2.0 - Database Engine (SQLite WASM)
 */

import sqlite3InitModule from './sqlite3.js';

let db = null;

export async function initSovereignDB() {
    if (db) return db;
    try {
        const sqlite3 = await sqlite3InitModule();
        if (sqlite3.oo1.OpfsDb) {
            db = new sqlite3.oo1.OpfsDb('/sovereign-vault-v2.db');
        } else {
            db = new sqlite3.oo1.DB(':memory:');
        }
        db.exec(`
            CREATE TABLE IF NOT EXISTS vessels (
                id TEXT PRIMARY KEY, blob BLOB, iv BLOB, type TEXT,
                tags TEXT, priority TEXT DEFAULT 'medium', color TEXT DEFAULT 'none',
                isFlagged INTEGER DEFAULT 0, timestamp INTEGER, updatedAt INTEGER
            );
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS vaults (id TEXT PRIMARY KEY, name TEXT, salt BLOB, createdAt INTEGER);
        `);
        return db;
    } catch (err) { console.error("DB init failed:", err); throw err; }
}

export async function saveVessel(id, blob, iv, type = '', tags = [], priority = 'medium', color = 'none', isFlagged = false) {
    if (!db) await initSovereignDB();
    db.exec({ sql: 'INSERT OR REPLACE INTO vessels VALUES (?,?,?,?,?,?,?,?,?,?)',
        bind: [id, blob, iv, type, JSON.stringify(tags), priority, color, isFlagged ? 1 : 0, Date.now(), Date.now()] });
}

export async function getAllVessels() {
    if (!db) await initSovereignDB();
    const rows = [];
    db.exec({ sql: 'SELECT * FROM vessels ORDER BY timestamp DESC', rowMode: 'object', callback: r => rows.push(r) });
    return rows;
}

export async function getVesselById(id) {
    if (!db) await initSovereignDB();
    let v = null;
    db.exec({ sql: 'SELECT * FROM vessels WHERE id = ?', bind: [id], rowMode: 'object', callback: r => { v = r; } });
    return v;
}

export async function deleteVessel(id) {
    if (!db) await initSovereignDB();
    db.exec({ sql: 'DELETE FROM vessels WHERE id = ?', bind: [id] });
}

export async function updateVessel(id, blob, iv, type, tags, priority, color, isFlagged) {
    if (!db) await initSovereignDB();
    db.exec({ sql: 'UPDATE vessels SET blob=?,iv=?,type=?,tags=?,priority=?,color=?,isFlagged=?,updatedAt=? WHERE id=?',
        bind: [blob, iv, type, JSON.stringify(tags), priority, color, isFlagged ? 1 : 0, Date.now(), id] });
}

export async function getVesselsByType(type) {
    if (!db) await initSovereignDB();
    const rows = [];
    db.exec({ sql: 'SELECT * FROM vessels WHERE type = ? ORDER BY timestamp DESC', bind: [type], rowMode: 'object', callback: r => rows.push(r) });
    return rows;
}

export async function getSetting(key) {
    if (!db) await initSovereignDB();
    let v = null;
    db.exec({ sql: 'SELECT value FROM settings WHERE key = ?', bind: [key], rowMode: 'object', callback: r => { v = r ? r.value : null; } });
    return v;
}

export async function setSetting(key, value) {
    if (!db) await initSovereignDB();
    db.exec({ sql: 'INSERT OR REPLACE INTO settings VALUES (?,?)', bind: [key, JSON.stringify(value)] });
}

export async function saveVault(id, name, salt) {
    if (!db) await initSovereignDB();
    db.exec({ sql: 'INSERT OR REPLACE INTO vaults VALUES (?,?,?,?)', bind: [id, name, salt, Date.now()] });
}

export async function getAllVaults() {
    if (!db) await initSovereignDB();
    const rows = [];
    db.exec({ sql: 'SELECT * FROM vaults ORDER BY createdAt DESC', rowMode: 'object', callback: r => rows.push(r) });
    return rows;
}

export async function exportVaultToBlob() {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle('sovereign-vault-v2.db');
    return await fh.getFile();
}

export async function importVaultFromBlob(fileBlob) {
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle('sovereign-vault-v2.db', { create: true });
    const w = await fh.createWritable();
    await w.write(fileBlob);
    await w.close();
    return true;
}
