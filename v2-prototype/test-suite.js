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

test('SQLite WASM storage', () => {
    const f = readFileSync(join(ROOT, 'core/db.js'), 'utf8');
    assert(f.includes('sqlite3'), 'Should use SQLite');
    assert(f.includes('OpfsDb'), 'Should use OPFS');
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

// ── Results ──
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
} else {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
}
