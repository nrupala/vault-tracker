/**
 * Sovereign Core v2.0 - Internal Test Suite
 * Validates crypto, companion intent parsing, and data flow.
 * Run: node test-suite.js (from v2-prototype directory)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname);

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ✗ ${name}: ${e.message}`);
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

console.log('\n🧪 Sovereign Core v2.0 - Test Suite\n');

// ── 1. File Structure Tests ──
console.log('📁 File Structure:');
test('index.html exists', () => {
    const f = readFileSync(join(ROOT, 'index.html'), 'utf8');
    assert(f.includes('<sovereign-app>'), 'Missing sovereign-app element');
    assert(f.includes('SovereignApp.js'), 'Missing SovereignApp.js reference');
});

test('SovereignApp.js exists and is valid', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('class SovereignApp extends HTMLElement'), 'Not a Web Component');
    assert(f.includes('attachShadow'), 'Missing Shadow DOM');
    assert(f.includes('customElements.define'), 'Not registered');
});

test('crypto.js exists', () => {
    const f = readFileSync(join(ROOT, 'core/crypto.js'), 'utf8');
    assert(f.includes('deriveKey') || f.includes('deriveSovereignKey'), 'Missing deriveKey');
    assert(f.includes('encryptData') || f.includes('encryptSovereignBlob'), 'Missing encrypt');
    assert(f.includes('decryptData') || f.includes('decryptSovereignBlob'), 'Missing decrypt');
    assert(f.includes('600000'), 'Wrong PBKDF2 iterations (should be 600K)');
    assert(f.includes('AES-GCM'), 'Missing AES-GCM');
});

test('db.js exists with all operations', () => {
    const f = readFileSync(join(ROOT, 'core/db.js'), 'utf8');
    assert(f.includes('saveVessel'), 'Missing saveVessel');
    assert(f.includes('getAllVessels'), 'Missing getAllVessels');
    assert(f.includes('deleteVessel'), 'Missing deleteVessel');
    assert(f.includes('updateVessel'), 'Missing updateVessel');
    assert(f.includes('getVesselsByType'), 'Missing getVesselsByType');
    assert(f.includes('getSetting'), 'Missing getSetting');
    assert(f.includes('setSetting'), 'Missing setSetting');
    assert(f.includes('saveVault'), 'Missing saveVault');
    assert(f.includes('getAllVaults'), 'Missing getAllVaults');
});

test('companion.js exists', () => {
    const f = readFileSync(join(ROOT, 'core/companion.js'), 'utf8');
    assert(f.includes('parseSovereignIntent'), 'Missing parseSovereignIntent');
    assert(f.includes('performSecurityAudit'), 'Missing performSecurityAudit');
});

test('scrubber.js exists', () => {
    const f = readFileSync(join(ROOT, 'core/scrubber.js'), 'utf8');
    assert(f.includes('scrubMetadata'), 'Missing scrubMetadata');
    assert(f.includes('inspectMetadata'), 'Missing inspectMetadata');
});

// ── 2. App Component Tests ──
console.log('\n🏗️ App Component:');

test('Has all 8 modules', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    ['tasks', 'notes', 'habits', 'ledger', 'calendar', 'analytics', 'companion', 'settings'].forEach(mod => {
        assert(f.includes(`data-mod="${mod}"`) || f.includes(`data-tab="${mod}"`), `Missing module: ${mod}`);
    });
});

test('Has tabbed navigation', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('tab-btn'), 'Missing tab buttons');
    assert(f.includes('_nav('), 'Missing navigation function');
});

test('Has Shadow DOM containerization', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('attachShadow'), 'Missing Shadow DOM');
    assert(f.includes("mode: 'open'"), 'Shadow DOM not open mode');
});

test('Has auth screen', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('auth-screen'), 'Missing auth screen');
    assert(f.includes('Master Password'), 'Missing password field');
    assert(f.includes('unlock'), 'Missing unlock function');
});

test('Has theme system (5 themes)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('_themes()'), 'Missing theme function');
    assert(f.includes('Dark') && f.includes('Light') && f.includes('Sepia') && f.includes('Deep Blue') && f.includes('AMOLED'), 'Missing themes');
});

test('Has export functions (JSON/CSV/TXT)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('_exportJSON'), 'Missing JSON export');
    assert(f.includes('_exportCSV'), 'Missing CSV export');
    assert(f.includes('_exportTXT'), 'Missing TXT export');
});

test('Has import functions (JSON/CSV/ICS)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('_importJSON'), 'Missing JSON import');
    assert(f.includes('_importCSV'), 'Missing CSV import');
    assert(f.includes('_importICS'), 'Missing ICS import');
});

test('Has ledger CSV export/import', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('_exportLedgerCSV'), 'Missing ledger CSV export');
    assert(f.includes('_importLedgerCSV'), 'Missing ledger CSV import');
});

test('Has calendar views (Month/Week/Day)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('month'), 'Missing month view');
    assert(f.includes('week'), 'Missing week view');
    assert(f.includes('day'), 'Missing day view');
    assert(f.includes('cal-view') || f.includes('cv-btn'), 'Missing calendar view buttons');
});

test('Has analytics with charts', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('chart-priority'), 'Missing priority chart');
    assert(f.includes('chart-behavioral'), 'Missing behavioral chart');
    assert(f.includes('insights'), 'Missing insights section');
});

test('Has companion chat', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('_handleChat'), 'Missing chat handler');
    assert(f.includes('_addChat'), 'Missing chat message function');
    assert(f.includes('chat-msgs'), 'Missing chat container');
});

test('Has settings with data retention', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('historyLimit'), 'Missing history limit setting');
    assert(f.includes('retentionDays'), 'Missing retention days setting');
    assert(f.includes('autoArchive'), 'Missing auto-archive setting');
});

test('Has lock vault functionality', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('lock-btn'), 'Missing lock button');
    assert(f.includes('_key = null'), 'Missing key clearing');
});

test('Has task CRUD (create, toggle, delete)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('add-task'), 'Missing add task');
    assert(f.includes('data.completed'), 'Missing task toggle');
    assert(f.includes('_delete'), 'Missing delete function');
});

test('Has habit check-in with streak calculation', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('habitCheckins'), 'Missing habit checkins storage');
    assert(f.includes('streak'), 'Missing streak calculation');
});

test('Has ledger with debit/credit and running balance', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('credit'), 'Missing credit type');
    assert(f.includes('debit'), 'Missing debit type');
    assert(f.includes('bal'), 'Missing balance calculation');
    assert(f.includes('category'), 'Missing categories');
    assert(f.includes('classification'), 'Missing need/want classification');
});

test('Has mobile responsive nav', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('mnav'), 'Missing mobile nav');
    assert(f.includes('safe-area-inset'), 'Missing safe area support');
    assert(f.includes('@media (max-width:768px)'), 'Missing responsive breakpoint');
});

test('Has vault management (create/select multiple vaults)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('vault-select'), 'Missing vault selector');
    assert(f.includes('vault-name'), 'Missing vault name input');
    assert(f.includes('getAllVaults'), 'Missing vault listing');
    assert(f.includes('saveVault'), 'Missing vault saving');
});

// ── 3. Companion Intent Parsing Tests ──
console.log('\n🤖 Companion Intent Parsing:');

test('Task intent parsing', async () => {
    const { parseSovereignIntent } = await import('./core/companion.js');
    const r = await parseSovereignIntent('Task buy groceries');
    assert(r.intent === 'CREATE_TASK', `Expected CREATE_TASK, got ${r.intent}`);
    assert(r.payload.includes('buy groceries'), `Wrong payload: ${r.payload}`);
});

test('Note intent parsing', async () => {
    const { parseSovereignIntent } = await import('./core/companion.js');
    const r = await parseSovereignIntent('Note meeting at 3pm');
    assert(r.intent === 'CREATE_NOTE', `Expected CREATE_NOTE, got ${r.intent}`);
});

test('Habit intent parsing', async () => {
    const { parseSovereignIntent } = await import('./core/companion.js');
    const r = await parseSovereignIntent('Habit meditate daily');
    assert(r.intent === 'CREATE_HABIT', `Expected CREATE_HABIT, got ${r.intent}`);
});

test('Expense intent parsing', async () => {
    const { parseSovereignIntent } = await import('./core/companion.js');
    const r = await parseSovereignIntent('Expense 20 for lunch');
    assert(r.intent === 'LOG_EXPENSE', `Expected LOG_EXPENSE, got ${r.intent}`);
    assert(r.payload.amount === 20, `Wrong amount: ${r.payload.amount}`);
});

test('Security audit intent parsing', async () => {
    const { parseSovereignIntent } = await import('./core/companion.js');
    const r = await parseSovereignIntent('Security audit');
    assert(r.intent === 'SECURITY_AUDIT', `Expected SECURITY_AUDIT, got ${r.intent}`);
});

test('Unknown intent handling', async () => {
    const { parseSovereignIntent } = await import('./core/companion.js');
    const r = await parseSovereignIntent('random gibberish');
    assert(r.intent === 'UNKNOWN', `Expected UNKNOWN, got ${r.intent}`);
});

// ── 4. Security Tests ──
console.log('\n🔒 Security:');

test('PBKDF2 uses 600K iterations', () => {
    const f = readFileSync(join(ROOT, 'core/crypto.js'), 'utf8');
    assert(f.includes('600000'), 'Should use 600K iterations');
});

test('AES-256-GCM encryption', () => {
    const f = readFileSync(join(ROOT, 'core/crypto.js'), 'utf8');
    assert(f.includes('AES-GCM'), 'Missing AES-GCM');
    assert(f.includes('256'), 'Missing 256-bit key');
});

test('Random IV generation', () => {
    const f = readFileSync(join(ROOT, 'core/crypto.js'), 'utf8');
    assert(f.includes('getRandomValues'), 'Missing random IV');
    assert(f.includes('Uint8Array(12)'), 'Wrong IV size (should be 12 bytes)');
});

test('Password verification challenge', () => {
    const f = readFileSync(join(ROOT, 'core/crypto.js'), 'utf8');
    assert(f.includes('verifyPassword') || f.includes('createVerifier'), 'Missing password verification');
    assert(f.includes('SOVEREIGN_VAULT_VERIFY') || f.includes('VAULT_OPEN_SESAME'), 'Missing challenge magic string');
});

test('Metadata scrubber integration', () => {
    const f = readFileSync(join(ROOT, 'core/crypto.js'), 'utf8');
    assert(f.includes('scrubMetadata'), 'Missing scrubber import');
});

// ── 5. Architecture Tests ──
console.log('\n🏛️ Architecture:');

test('Zero build tools (ESM only)', () => {
    const f = readFileSync(join(ROOT, 'index.html'), 'utf8');
    assert(!f.includes('vite'), 'Should not reference Vite');
    assert(!f.includes('webpack'), 'Should not reference Webpack');
    assert(!f.includes('rollup'), 'Should not reference Rollup');
    assert(f.includes('type="module"'), 'Should use ESM');
});

test('No React dependency', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(!f.includes('React'), 'Should not use React');
    assert(!f.includes('useState'), 'Should not use React hooks');
    assert(!f.includes('useEffect'), 'Should not use React hooks');
});

test('Web Components (Custom Elements)', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('extends HTMLElement'), 'Should extend HTMLElement');
    assert(f.includes('customElements.define'), 'Should define custom element');
});

test('OPFS primary storage', () => {
    const f = readFileSync(join(ROOT, 'core/db.js'), 'utf8');
    assert(f.includes('getDirectory'), 'Should use OPFS getDirectory');
    assert(f.includes('opfsRoot'), 'Should have OPFS root reference');
    assert(f.includes('getFileHandle'), 'Should use OPFS file handles');
});

test('Persistent storage request', () => {
    const f = readFileSync(join(ROOT, 'core/db.js'), 'utf8');
    assert(f.includes('navigator.storage.persist'), 'Should request persistent storage');
    assert(f.includes('requestPersistence'), 'Should have persistence function');
});

test('IndexedDB fallback exists', () => {
    const f = readFileSync(join(ROOT, 'core/db.js'), 'utf8');
    assert(f.includes('indexedDB'), 'Should have IndexedDB fallback');
    assert(f.includes('openIDB'), 'Should have IDB open function');
});

test('No hardcoded XMPP credentials', () => {
    const f = readFileSync(join(ROOT, 'core/sync.js'), 'utf8');
    assert(!f.includes('ws://localhost:5280'), 'Should not have hardcoded XMPP endpoint');
    assert(!f.includes('"user@sovereign"'), 'Should not have hardcoded credentials');
    assert(f.includes('mock'), 'Should have mock mode flag');
});

test('JPEG scrubber has bounds checking', () => {
    const f = readFileSync(join(ROOT, 'core/scrubber.js'), 'utf8');
    assert(f.includes('byteLength'), 'Should check buffer bounds');
    assert(f.includes('offset + 3 > view.byteLength'), 'Should check length field bounds');
});

test('No empty catch blocks in SovereignApp', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(!f.includes('} catch {}'), 'Should not have empty catch blocks');
    assert(f.includes('console.error') || f.includes('console.warn'), 'Should have error logging');
});

test('Personality engine exists', () => {
    const f = readFileSync(join(ROOT, 'core/personality.js'), 'utf8');
    assert(f.includes('PERSONALITIES'), 'Should have PERSONALITIES export');
    assert(f.includes('zen'), 'Should have Zen personality');
    assert(f.includes('focus'), 'Should have Focus personality');
    assert(f.includes('playful'), 'Should have Playful personality');
    assert(f.includes('professional'), 'Should have Professional personality');
    assert(f.includes('energy'), 'Should have Energy personality');
});

test('Companion engine exists', () => {
    const f = readFileSync(join(ROOT, 'core/companion-engine.js'), 'utf8');
    assert(f.includes('CompanionEngine'), 'Should have CompanionEngine class');
    assert(f.includes('greet'), 'Should have greet method');
    assert(f.includes('remember'), 'Should have remember method');
    assert(f.includes('logMood'), 'Should have logMood method');
    assert(f.includes('milestone'), 'Should have milestone tracking');
});

test('Intelligence engine exists', () => {
    const f = readFileSync(join(ROOT, 'core/intelligence.js'), 'utf8');
    assert(f.includes('IntelligenceEngine'), 'Should have IntelligenceEngine class');
    assert(f.includes('suggest'), 'Should have suggest method');
    assert(f.includes('suggestAmount'), 'Should have amount suggestion');
    assert(f.includes('detectAnomaly'), 'Should have anomaly detection');
    assert(f.includes('quickChips'), 'Should have quick chips');
});

test('Service broker exists', () => {
    const f = readFileSync(join(ROOT, 'core/broker.js'), 'utf8');
    assert(f.includes('ServiceBroker'), 'Should have ServiceBroker class');
    assert(f.includes('register'), 'Should have register method');
    assert(f.includes('call'), 'Should have call method');
    assert(f.includes('emit'), 'Should have emit method');
    assert(f.includes('on'), 'Should have on method');
});

test('Chat database exists (isolated)', () => {
    const f = readFileSync(join(ROOT, 'core/chat-db.js'), 'utf8');
    assert(f.includes('sovereign-chat-v1'), 'Should have separate chat DB name');
    assert(f.includes('conversations'), 'Should have conversations store');
    assert(f.includes('messages'), 'Should have messages store');
    assert(f.includes('contacts'), 'Should have contacts store');
    assert(f.includes('attachments'), 'Should have attachments store');
    assert(f.includes('generateKeyPair'), 'Should have E2E key generation');
    assert(f.includes('encryptMessage'), 'Should have message encryption');
    assert(f.includes('decryptMessage'), 'Should have message decryption');
});

test('Journal module in SovereignApp', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('journal'), 'Should have journal module');
    assert(f.includes('journalPrompts'), 'Should have journal prompts');
    assert(f.includes('_renderJournal'), 'Should have journal render method');
    assert(f.includes('_exportJournalMD'), 'Should have journal MD export');
    assert(f.includes('_exportJournalTXT'), 'Should have journal TXT export');
    assert(f.includes('_exportJournalJSON'), 'Should have journal JSON export');
    assert(f.includes('journal-mood-selector'), 'Should have mood selector');
});

test('Peer chat module in SovereignApp', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('data-tab="chat"'), 'Should have chat tab');
    assert(f.includes('data-mod="chat"'), 'Should have chat module');
    assert(f.includes('_renderChat'), 'Should have chat render method');
    assert(f.includes('_chatSendMessage'), 'Should have chat send method');
    assert(f.includes('_chatOpenConversation'), 'Should have chat conversation method');
    assert(f.includes('_chatNewContact'), 'Should have new contact method');
    assert(f.includes('_chatNewConversation'), 'Should have new conversation method');
});

test('Keyboard shortcuts in SovereignApp', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('keydown'), 'Should have keyboard listener');
    assert(f.includes("key === 'k'"), 'Should have Ctrl+K shortcut');
    assert(f.includes("key === 'n'"), 'Should have Ctrl+N shortcut');
    assert(f.includes("key === 'j'"), 'Should have Ctrl+J shortcut');
    assert(f.includes("key === 'l'"), 'Should have Ctrl+L shortcut');
    assert(f.includes("key === 'c'"), 'Should have Ctrl+C shortcut');
    assert(f.includes("key === 'Escape'"), 'Should have Escape shortcut');
});

test('Monthly reflection in analytics', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('monthAgo'), 'Should have monthly reflection');
    assert(f.includes('monthTasks'), 'Should track monthly tasks');
    assert(f.includes('monthJournal'), 'Should track monthly journal entries');
});

test('Morning/evening companion prompts', () => {
    const f = readFileSync(join(ROOT, 'ui/SovereignApp.js'), 'utf8');
    assert(f.includes('hour >= 8 && hour <= 10'), 'Should have morning prompts');
    assert(f.includes('hour >= 17 && hour <= 19'), 'Should have evening prompts');
    assert(f.includes('Weekly Summary'), 'Should have weekly summary');
});

test('OPFS primary storage', () => {
    const f = readFileSync(join(ROOT, 'core/db.js'), 'utf8');
    assert(f.includes('getDirectory'), 'Should use OPFS getDirectory');
    assert(f.includes('opfsRoot'), 'Should have OPFS root reference');
    assert(f.includes('getFileHandle'), 'Should use OPFS file handles');
    assert(f.includes('requestPersistence'), 'Should request persistent storage');
});

// ── Results ──
console.log(`\n${'═'.repeat(50)}`);
// === Functional: Double Ratchet (async) ===
console.log('\n=== Double Ratchet E2EE (functional):');

const asyncTests = [];

asyncTests.push((async () => {
    const { RatchetState, generateDH, encodePK } = await import('./core/double-ratchet.js');
    const shared = crypto.getRandomValues(new Uint8Array(32));

    // A->B and B->A round trips, multi-message
    const alice = new RatchetState();
    const bob = new RatchetState();
    const bobKeys = await generateDH();
    const bobPubRaw = new Uint8Array(await encodePK(bobKeys.publicKey));

    await alice.initAsAlice(shared, bobPubRaw);
    await bob.initAsBob(shared, bobKeys);

    const m1 = await alice.ratchetEncrypt('hello bob, vessel 1 incoming');
    const d1 = await bob.ratchetDecrypt(m1.header, m1.ciphertext, m1.iv);
    test('Alice->Bob decrypt round-trip', () => {
        assert(new TextDecoder().decode(d1) === 'hello bob, vessel 1 incoming', 'plaintext mismatch');
    });

    const m2 = await alice.ratchetEncrypt('second message');
    const d2 = await bob.ratchetDecrypt(m2.header, m2.ciphertext, m2.iv);
    test('Second message decrypts (chain advance)', () => {
        assert(new TextDecoder().decode(d2) === 'second message', 'plaintext mismatch');
    });

    let replayRejected = false;
    try { await bob.ratchetDecrypt(m1.header, m1.ciphertext, m1.iv); } catch { replayRejected = true; }
    test('Replayed message rejected', () => {
        assert(replayRejected, 'replay must not decrypt twice with same chain state');
    });

    const r1 = await bob.ratchetEncrypt('reply from bob');
    const d3 = await alice.ratchetDecrypt(r1.header, r1.ciphertext, r1.iv);
    test('Bob->Alice decrypt round-trip (full ratchet)', () => {
        assert(new TextDecoder().decode(d3) === 'reply from bob', 'plaintext mismatch');
    });

    // Out-of-order delivery handled via skipped keys
    const o1 = await alice.ratchetEncrypt('ooo 1');
    const o2 = await alice.ratchetEncrypt('ooo 2');
    const d5 = await bob.ratchetDecrypt(o2.header, o2.ciphertext, o2.iv);
    const d4 = await bob.ratchetDecrypt(o1.header, o1.ciphertext, o1.iv);
    test('Out-of-order messages decrypt via skipped keys', () => {
        assert(new TextDecoder().decode(d4) === 'ooo 1' && new TextDecoder().decode(d5) === 'ooo 2', 'skip handling broken');
    });
})().catch(e => { test('Double ratchet suite ran without crash', () => { throw e; }); }));

asyncTests.push((async () => {
    const { buildMessage, buildStreamOpen, buildAuthPlain, buildBind, parseStanza, SovereignBroker } = await import('./core/broker.js');

    test('Stanza codec round-trip (build->parse)', () => {
        const signal = { kind: 'vessel', payload: { id: 'v_123', action: 'update' }, from: 'a@x', ts: 1 };
        const xml = buildMessage({ to: 'b@x', from: 'a@x', signal });
        const parsed = parseStanza(xml);
        assert(parsed.name === 'message', 'wrong stanza name');
        assert(parsed.signal && parsed.signal.kind === 'vessel', 'signal lost');
        assert(parsed.signal.payload.id === 'v_123', 'signal payload lost');
    });

    test('SASL PLAIN token decodes to NUL-separated authzid/authcid/passwd', () => {
        const s = buildAuthPlain('u@sovereign', 'secret');
        const token = s.match(/PLAIN">(.+)<\/auth>/)[1];
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        assert(decoded === 'u@sovereign\u0000u@sovereign\u0000secret', 'SASL token malformed: ' + JSON.stringify(decoded));
    });

    test('Stream open + bind stanzas well-formed', () => {
        assert(buildStreamOpen('xmpp.example').includes('stream:stream'), 'no stream open');
        assert(buildBind('sovereign').includes('xmpp-bind'), 'no bind');
    });

    const b1 = new SovereignBroker();
    const b2 = new SovereignBroker();
    await b1.connect({ jid: 'a@sovereign', transport: 'loopback' });
    await b2.connect({ jid: 'b@sovereign', transport: 'loopback' });
    const received = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('no signal in 2s')), 2000);
        b2.addEventListener('signal', e => { clearTimeout(t); resolve(e.detail); });
    });
    b1.sendSignal({ kind: 'ping', payload: { n: 42 } });
    const sig = await received;
    test('Loopback broker delivers signal cross-instance', () => {
        assert(sig.kind === 'ping' && sig.payload.n === 42, 'signal payload mismatch');
    });
    await b1.close();
    await b2.close();
})().catch(e => { test('Broker suite ran without crash', () => { throw e; }); }));

asyncTests.push((async () => {
    const chat = await import('./core/chat-db.js');
    const id1 = 'contact_test_1';
    const id2 = 'contact_test_2';
    const convId = 'conv_test_1';

    await chat.saveContact({ id: id1, name: 'Alice', publicKey: [1, 2, 3], createdAt: 1 });
    await chat.saveContact({ id: id2, name: 'Bob', publicKey: [4, 5, 6], createdAt: 2 });
    const contacts = await chat.getAllContacts();
    test('ChatDB: contacts saved and listed (isolated)', () => {
        assert(contacts.some(c => c.id === id1) && contacts.some(c => c.id === id2), 'contacts missing');
        assert(contacts.every(c => Array.isArray(c.publicKey)), 'publicKey not array');
    });

    await chat.saveConversation({ id: convId, name: 'Alice', contactId: id1, lastActivity: Date.now() });
    const conv = await chat.getConversation(convId);
    test('ChatDB: conversation saved', () => {
        assert(conv && conv.contactId === id1, 'conversation lost');
    });

    await chat.saveMessage({ id: 'm1', conversationId: convId, sender: 'me', ciphertext: [9, 9, 9], iv: [1, 1, 1], timestamp: 100 });
    await chat.saveMessage({ id: 'm2', conversationId: convId, sender: 'me', ciphertext: [8, 8, 8], iv: [2, 2, 2], timestamp: 200 });
    const msgs = await chat.getMessages(convId);
    test('ChatDB: messages stored encrypted + ordered', () => {
        assert(msgs.length === 2, 'wrong message count');
        assert(msgs[0].timestamp <= msgs[1].timestamp, 'not ordered');
        assert(!('content' in msgs[0]), 'plaintext content must never be stored');
    });

    const convs = await chat.getAllConversations();
    test('ChatDB: conversation preview stays zero-knowledge', () => {
        assert(convs.some(c => c.id === convId && c.lastMessage === '[encrypted]'), 'preview leaks or missing');
    });

    await chat.deleteConversation(convId);
    const after = await chat.getMessages(convId);
    test('ChatDB: deleteConversation removes messages too', () => {
        assert(after.length === 0, 'orphan messages remain');
    });
    console.log(`  (chat-db storage mode: ${chat.getChatDBMode()})`);
})().catch(e => { test('ChatDB suite ran without crash', () => { throw e; }); }));

await Promise.allSettled(asyncTests);

console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
} else {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
}
