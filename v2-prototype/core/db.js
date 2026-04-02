/**
 * Sovereign Core v2.0 - Database Engine (SQLite WASM)
 * Zero dependencies. Uses native WebAssembly.
 */

import sqlite3InitModule from './sqlite3.js';

let db = null;

export async function initSovereignDB() {
    if (db) return db;

    try {
        const sqlite3 = await sqlite3InitModule();
        
        // Use OPFS (Origin Private File System) for persistent storage
        if (sqlite3.oo1.OpfsDb) {
            db = new sqlite3.oo1.OpfsDb('/sovereign-vault-v2.db');
            console.log("Sovereign DB Initialized on OPFS.");
        } else {
            db = new sqlite3.oo1.DB(':memory:');
            console.warn('OPFS not supported, using in-memory DB for this session.');
        }

        // Initialize the "Hollow Vessel" table
        // id: uuid, blob: encrypted data, iv: 12-byte nonce, ts: timestamp
        db.exec(`
            CREATE TABLE IF NOT EXISTS vessels (
                id TEXT PRIMARY KEY,
                blob BLOB,
                iv BLOB,
                timestamp INTEGER
            );
        `);

        return db;
    } catch (err) {
        console.error("Failed to initialize SQLite:", err);
        throw err;
    }
}

export async function saveVessel(vesselId, blob, iv) {
    if (!db) await initSovereignDB();
    db.exec({
        sql: 'INSERT OR REPLACE INTO vessels (id, blob, iv, timestamp) VALUES (?, ?, ?, ?)',
        bind: [vesselId, blob, iv, Date.now()]
    });
}

export async function getAllVessels() {
    if (!db) await initSovereignDB();
    const rows = [];
    db.exec({
        sql: 'SELECT * FROM vessels ORDER BY timestamp DESC',
        rowMode: 'object',
        callback: (row) => rows.push(row)
    });
    return rows;
}

export async function getVesselById(vesselId) {
    if (!db) await initSovereignDB();
    let vessel = null;
    db.exec({
        sql: 'SELECT * FROM vessels WHERE id = ?',
        bind: [vesselId],
        rowMode: 'object',
        callback: (row) => { vessel = row; }
    });
    return vessel;
}

export async function deleteVessel(vesselId) {
    if (!db) await initSovereignDB();
    db.exec({
        sql: 'DELETE FROM vessels WHERE id = ?',
        bind: [vesselId]
    });
    console.log(`Vessel ${vesselId} deleted from vault`);
}

export async function updateVessel(vesselId, blob, iv) {
    if (!db) await initSovereignDB();
    db.exec({
        sql: 'UPDATE vessels SET blob = ?, iv = ?, timestamp = ? WHERE id = ?',
        bind: [blob, iv, Date.now(), vesselId]
    });
    console.log(`Vessel ${vesselId} updated in vault`);
}

export async function getVesselsByType(type) {
    if (!db) await initSovereignDB();
    const rows = [];
    db.exec({
        sql: 'SELECT * FROM vessels WHERE id LIKE ? ORDER BY timestamp DESC',
        bind: [`${type}_%`],
        rowMode: 'object',
        callback: (row) => rows.push(row)
    });
    return rows;
}
