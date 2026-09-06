/**
 * Sovereign Core v2.0 - Isolated Chat Database
 * Contacts, conversations, and message storage, fully separate from the vessel
 * vault storage (core/db.js). Follows the same Fort Knox storage doctrine:
 * OPFS primary, IndexedDB fallback, in-memory last resort (also enables Node
 * 20+ testing). Zero external dependencies.
 *
 * Message bodies are stored ONLY as ciphertext (AES-256-GCM) with per-message
 * IVs. The database never holds plaintext chat content. Key pairs are ECDH
 * P-256 (WebCrypto), suitable for Double Ratchet session bootstrap.
 */

import { generateECDHKeyPair, exportPublicKey as cryptoExportPublicKey, encryptData as cryptoEncrypt, decryptData as cryptoDecrypt } from './crypto.js';

const IDB_NAME = 'sovereign-chat-v1';
const IDB_VERSION = 1;
const STORES = ['contacts', 'conversations', 'messages', 'attachments'];

let mode = 'none'; // 'opfs' | 'indexeddb' | 'memory'
let initPromise = null;
let opfsRoot = null;
let idb = null;
const memory = { contacts: new Map(), conversations: new Map(), messages: new Map() };

function log(level, msg, err) {
    if (level === 'error') console.error('[ChatDB]', msg, err || '');
    else if (level === 'warn') console.warn('[ChatDB]', msg, err || '');
    else console.log('[ChatDB]', msg);
}

async function initOPFS() {
    try {
        if (!navigator.storage || !navigator.storage.getDirectory) return false;
        opfsRoot = await navigator.storage.getDirectory();
        // OPFS forbids slashes in names: resolve nested handles one level at a time.
        const chatDir = await opfsRoot.getDirectoryHandle('chat', { create: true });
        for (const dir of ['contacts', 'conversations', 'messages', 'attachments']) {
            await chatDir.getDirectoryHandle(dir, { create: true });
        }
        mode = 'opfs';
        log('info', 'OPFS initialized (PRIMARY chat storage)');
        return true;
    } catch (err) { log('warn', 'OPFS init failed', err); return false; }
}

function openIDB() {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = () => {
                const d = req.result;
                for (const s of STORES) {
                    if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => { idb = req.result; resolve(true); };
            req.onerror = () => resolve(false);
        } catch { resolve(false); }
    });
}

async function ensureInit() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        if (typeof navigator !== 'undefined' && navigator.storage) {
            if (await initOPFS()) return;
            if (typeof indexedDB !== 'undefined' && await openIDB()) { mode = 'indexeddb'; return; }
        }
        mode = 'memory';
        log('warn', 'Falling back to in-memory chat storage (non-persistent)');
    })();
    return initPromise;
}

/* ---------- OPFS primitives ---------- */

async function opfsWrite(path, obj) {
    const [dirPath, fileName] = splitPath(path);
    let dir = opfsRoot;
    for (const part of dirPath) dir = await dir.getDirectoryHandle(part, { create: true });
    const fh = await dir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    await w.write(typeof obj === 'string' ? obj : JSON.stringify(obj));
    await w.close();
}

async function opfsRead(path) {
    const [dirPath, fileName] = splitPath(path);
    let dir = opfsRoot;
    for (const part of dirPath) dir = await dir.getDirectoryHandle(part, { create: false });
    const fh = await dir.getFileHandle(fileName, { create: false });
    const file = await fh.getFile();
    const text = await file.text();
    return text.length ? JSON.parse(text) : null;
}

async function opfsDelete(path) {
    const [dirPath, fileName] = splitPath(path);
    let dir = opfsRoot;
    for (const part of dirPath) dir = await dir.getDirectoryHandle(part, { create: false });
    await dir.removeEntry(fileName);
}

async function opfsList(dirPath) {
    // dirPath is a string like 'chat/contacts' — split it; iterating the string
    // itself walks per-CHARACTER handles and throws NotFoundError.
    const parts = dirPath.split('/').filter(Boolean);
    let dir = opfsRoot;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: false });
    const names = [];
    for await (const [name] of dir.entries()) names.push(name);
    return names;
}

function splitPath(path) {
    const parts = path.split('/');
    const fileName = parts.pop();
    return [parts, fileName];
}

/* ---------- IndexedDB primitives ---------- */

function idbTx(store, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
    });
}

async function idbPut(store, value) { return idbTx(store, 'readwrite', s => s.put(value)); }
async function idbGet(store, id) { return idbTx(store, 'readonly', s => s.get(id)); }
async function idbGetAll(store) { return idbTx(store, 'readonly', s => s.getAll()); }
async function idbDelete(store, id) { return idbTx(store, 'readwrite', s => s.delete(id)); }

/* ---------- Unified record access ---------- */

function serialize(keyObj) {
    // Ensure ciphertext/iv/publicKey survive JSON (ArrayBuffer/TypedArray -> arrays)
    const out = {};
    for (const [k, v] of Object.entries(keyObj)) {
        if (v instanceof Uint8Array) out[k] = Array.from(v);
        else if (v instanceof ArrayBuffer) out[k] = Array.from(new Uint8Array(v));
        else out[k] = v;
    }
    return out;
}

async function putRecord(kind, record) {
    await ensureInit();
    const rec = serialize(record);
    if (mode === 'opfs') return opfsWrite(`chat/${kind}/${rec.id}.json`, rec);
    if (mode === 'indexeddb') return idbPut(kind, rec);
    memory[kind].set(rec.id, rec);
}

async function getRecord(kind, id) {
    await ensureInit();
    if (mode === 'opfs') return opfsRead(`chat/${kind}/${id}.json`);
    if (mode === 'indexeddb') return idbGet(kind, id);
    return memory[kind].get(id) || null;
}

async function getAllRecords(kind) {
    await ensureInit();
    if (mode === 'opfs') {
        const names = await opfsList(`chat/${kind}`);
        const out = [];
        for (const name of names) {
            if (!name.endsWith('.json')) continue;
            try { out.push(await opfsRead(`chat/${kind}/${name}`)); }
            catch (err) { log('warn', `Failed to read ${kind}/${name}`, err); }
        }
        return out;
    }
    if (mode === 'indexeddb') return idbGetAll(kind);
    return [...memory[kind].values()];
}

async function deleteRecord(kind, id) {
    await ensureInit();
    if (mode === 'opfs') return opfsDelete(`chat/${kind}/${id}.json`);
    if (mode === 'indexeddb') return idbDelete(kind, id);
    memory[kind].delete(id);
}

/* ================= Public API ================= */

export async function saveContact({ id, name, publicKey, createdAt }) {
    if (!id || !name) throw new Error('saveContact: id and name are required');
    await putRecord('contacts', { id, name, publicKey, createdAt: createdAt || Date.now() });
}

export async function getAllContacts() {
    const all = await getAllRecords('contacts');
    return all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function saveConversation({ id, name, contactId, lastActivity }) {
    if (!id || !name || !contactId) throw new Error('saveConversation: id, name, contactId required');
    await putRecord('conversations', {
        id, name, contactId,
        lastMessage: '', lastActivity: lastActivity || Date.now()
    });
}

export async function getConversation(id) {
    return getRecord('conversations', id);
}

export async function getAllConversations() {
    const all = await getAllRecords('conversations');
    return all.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
}

export async function saveMessage({ id, conversationId, sender, ciphertext, iv, mimeType, timestamp }) {
    if (!id || !conversationId) throw new Error('saveMessage: id and conversationId are required');
    await putRecord('messages', {
        id, conversationId, sender,
        ciphertext, iv,
        mimeType: mimeType || 'text/plain',
        timestamp: timestamp || Date.now()
    });
    const conv = await getRecord('conversations', conversationId);
    if (conv) {
        // Zero-knowledge preview: the DB never stores plaintext chat content.
        conv.lastMessage = '[encrypted]';
        conv.lastActivity = timestamp || Date.now();
        await putRecord('conversations', conv);
    }
}

export async function getMessages(conversationId) {
    const all = await getAllRecords('messages');
    return all
        .filter(m => m.conversationId === conversationId)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

export async function deleteConversation(id) {
    const msgs = await getAllRecords('messages');
    for (const m of msgs) {
        if (m.conversationId === id) await deleteRecord('messages', m.id);
    }
    await deleteRecord('conversations', id);
}

export async function generateKeyPair() {
    return generateECDHKeyPair();
}

export async function exportPublicKey(keyPairOrKey) {
    const pk = keyPairOrKey && keyPairOrKey.publicKey ? keyPairOrKey.publicKey : keyPairOrKey;
    return cryptoExportPublicKey(pk);
}

export { cryptoEncrypt as encryptData, cryptoDecrypt as decryptData };

/** Message-encryption aliases (same AES-256-GCM engine, message semantics). */
export const encryptMessage = cryptoEncrypt;
export const decryptMessage = cryptoDecrypt;

/* ---------- Encrypted attachments (isolated store) ---------- */

export async function saveAttachment({ id, conversationId, name, mimeType, ciphertext, iv, timestamp }) {
    if (!id || !conversationId) throw new Error('saveAttachment: id and conversationId are required');
    await putRecord('attachments', {
        id, conversationId,
        name: name || 'attachment',
        mimeType: mimeType || 'application/octet-stream',
        ciphertext, iv,
        timestamp: timestamp || Date.now()
    });
}

export async function getAttachments(conversationId) {
    const all = await getAllRecords('attachments');
    return all.filter(a => a.conversationId === conversationId)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

export async function deleteAttachment(id) {
    await deleteRecord('attachments', id);
}

export function getChatDBMode() { return mode; }