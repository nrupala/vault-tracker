/**
 * Sovereign App v2.0 - Containerized Web Component
 * Shadow DOM, tabbed UI, zero external dependencies.
 * Features: full edit modals, all calendar views, vault persistence, challenge-verifier auth.
 */

class SovereignApp extends HTMLElement {
    constructor() {
        super();
        this._shadow = this.attachShadow({ mode: 'open' });
        this._key = null;
        this._salt = null;
        this._vaultId = null;
        this._vaultName = '';
        this._items = [];
        this._habits = {};
        this._tab = 'tasks';
        this._calDate = new Date();
        this._calView = 'month';
        this._calFilter = 'all';
        this._settings = { historyLimit: 5, retentionDays: 30, autoArchive: false };
        this._ledgerStats = null;
        this._themeIdx = 0;
        this._authMode = 'unlock';
        this._intelligence = null;
        this._interactionIntelligence = null;
        this._prompts = [];
        this._personality = 'focus';
        this._companion = null;
        this._journalPrompts = [
            "How are you feeling today?",
            "What went well today?",
            "What's on your mind?",
            "What are you grateful for?",
            "What would you like to let go of?",
            "What did you learn today?",
            "What made you smile today?",
            "What's one thing you want to remember?",
            "How did you take care of yourself today?",
            "What challenged you today?",
            "What are you looking forward to?",
            "What would you tell your past self?",
            "What's something you're proud of?",
            "What drained your energy today?",
            "What gave you energy today?",
            "What's a small win you had today?",
            "What's something you want to improve tomorrow?",
            "Who made a positive impact on your day?",
            "What's a thought you can't shake?",
            "If today had a title, what would it be?",
            "What's something you noticed today that you usually miss?",
            "What's a decision you made today that you're glad about?",
            "What's something you want to be kinder to yourself about?",
            "What's a moment today you'd like to relive?",
            "What's weighing on your heart right now?",
            "What's something beautiful you saw today?",
            "What's a conversation you wish you could have?",
            "What's something you're ready to forgive?",
            "What's a boundary you need to set?",
            "What's something you want to celebrate about yourself?"
        ];
    }

    async connectedCallback() {
        this._render();
        this._bind();
        this._setAuthMode('unlock');
        await this._loadVaultList();
    }

    /* ── Utility ── */
    _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    _log(level, msg, err) { if (level === 'error') console.error('[App]', msg, err || ''); else if (level === 'warn') console.warn('[App]', msg, err || ''); }

    _themes() {
        return [
            { bg: '#0a0a0a', s1: '#141414', s2: '#1e1e1e', t1: '#e5e5e5', t2: '#a3a3a3', n: 'Dark' },
            { bg: '#ffffff', s1: '#f8f8f8', s2: '#f0f0f0', t1: '#111827', t2: '#6b7280', n: 'Light' },
            { bg: '#1a1410', s1: '#231d16', s2: '#2d251c', t1: '#e5d5b5', t2: '#a89070', n: 'Sepia' },
            { bg: '#0c1929', s1: '#132238', s2: '#1a2d45', t1: '#d4e4f7', t2: '#7a9cc6', n: 'Deep Blue' },
            { bg: '#000000', s1: '#0a0a0a', s2: '#141414', t1: '#e5e5e5', t2: '#a3a3a3', n: 'AMOLED' }
        ];
    }

    _applyTheme(idx) {
        const t = this._themes()[idx];
        this.style.setProperty('--bg', t.bg); this.style.setProperty('--s1', t.s1);
        this.style.setProperty('--s2', t.s2); this.style.setProperty('--t1', t.t1);
        this.style.setProperty('--t2', t.t2);
    }

    /* ── Vault Management ── */
    async _loadVaultList() {
        try {
            const { initSovereignDB, getAllVaults } = await import('../core/db.js');
            await initSovereignDB();
            const vaults = await getAllVaults();
            const sel = this._shadow.getElementById('vault-select');
            if (!sel) return;
            if (vaults.length > 0) {
                sel.innerHTML = vaults.map(v => `<option value="${v.id}">${this._esc(v.name)}</option>`).join('');
            } else {
                sel.innerHTML = '<option value="">No vaults yet</option>';
            }
        } catch (err) { this._log('warn', 'Vault list load failed:', err); }
    }

    _setAuthMode(mode) {
        this._authMode = mode;
        const el = this._shadow.getElementById('auth-mode');
        if (el) el.dataset.mode = mode;
        this._authErr('');
        const pw = this._shadow.getElementById('auth-pw'); if (pw) pw.value = '';
        const vni = this._shadow.getElementById('vault-name-input'); if (vni) vni.value = '';
        const vsg = this._shadow.getElementById('vault-select-group');
        if (vsg) vsg.style.display = (mode === 'create') ? 'none' : 'block';
        const vng = this._shadow.getElementById('vault-name-group');
        if (vng) vng.style.display = (mode === 'create') ? 'block' : 'none';
        const lbl = this._shadow.getElementById('auth-pw-label');
        if (lbl) lbl.textContent = mode === 'delete' ? 'Confirm Password to Delete' : 'Master Password';
        const btn = this._shadow.getElementById('auth-submit');
        if (btn) btn.textContent = mode === 'create' ? 'Create Vault' : mode === 'delete' ? 'Delete Vault' : 'Unlock Vault';
        // Update tab active state
        this._shadow.querySelectorAll('.mode-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.mode === mode);
        });
    }

    async _handleAuth() {
        const pw = this._shadow.getElementById('auth-pw')?.value.trim();
        if (!pw) return this._authErr('Password required');
        const mode = this._authMode;
        try {
            this._authErr(mode === 'create' ? 'Creating...' : mode === 'delete' ? 'Deleting...' : 'Unlocking...');
            const { deriveKey, createVerifier, verifyPassword, vaultDNA } = await import('../core/crypto.js');
            const { initSovereignDB, getAllVaults, saveVault, deleteVault } = await import('../core/db.js');
            await initSovereignDB();

            if (mode === 'create') {
                const name = this._shadow.getElementById('vault-name-input')?.value.trim();
                if (!name) return this._authErr('Vault name required');
                const vaults = await getAllVaults();
                if (vaults.find(v => v.name.toLowerCase() === name.toLowerCase())) return this._authErr('Name already exists');
                const salt = crypto.getRandomValues(new Uint8Array(16));
                const verifier = await createVerifier(pw, salt);
                this._key = await deriveKey(pw, salt);
                const id = 'vault_' + crypto.randomUUID();
                await saveVault(id, name, salt, verifier);
                this._vaultId = id; this._vaultName = name; this._salt = salt;
            } else if (mode === 'unlock') {
                const vid = this._shadow.getElementById('vault-select')?.value;
                if (!vid) return this._authErr('Select a vault');
                const vaults = await getAllVaults();
                const vault = vaults.find(v => v.id === vid);
                if (!vault) return this._authErr('Vault not found');
                
                // Ensure salt is proper Uint8Array
                let salt;
                if (vault.salt instanceof Uint8Array) {
                    salt = vault.salt;
                } else if (vault.salt instanceof ArrayBuffer) {
                    salt = new Uint8Array(vault.salt);
                } else if (Array.isArray(vault.salt)) {
                    salt = new Uint8Array(vault.salt);
                } else {
                    return this._authErr('Vault data corrupted');
                }
                
                const valid = await verifyPassword(pw, salt, vault.verifier);
                if (!valid) {
                    // Try legacy vault unlock (old format without verifier)
                    this._authErr('Trying legacy vault format...');
                    const legacyValid = await this._tryLegacyUnlock(pw, salt, vault);
                    if (!legacyValid) return this._authErr('Wrong password');
                    
                    // Legacy vault authenticated — trigger migration
                    this._authErr('Converting vault to new format...');
                    const migrationResult = await this._migrateVault(vault, pw, salt);
                    if (!migrationResult.success) {
                        return this._authErr(`Vault conversion failed. Log: ${migrationResult.logFile}. Please email this log to the developer.`);
                    }
                    this._authErr('Vault is now in new format. Unlocking...');
                    // Re-verify with new format
                    this._key = await deriveKey(pw, salt);
                } else {
                    this._key = await deriveKey(pw, salt);
                }
                this._vaultId = vault.id; this._vaultName = vault.name; this._salt = salt;
            } else if (mode === 'delete') {
                const vid = this._shadow.getElementById('vault-select')?.value;
                if (!vid) return this._authErr('Select a vault');
                const vaults = await getAllVaults();
                const vault = vaults.find(v => v.id === vid);
                if (!vault) return this._authErr('Vault not found');
                
                let salt;
                if (vault.salt instanceof Uint8Array) salt = vault.salt;
                else if (vault.salt instanceof ArrayBuffer) salt = new Uint8Array(vault.salt);
                else if (Array.isArray(vault.salt)) salt = new Uint8Array(vault.salt);
                else return this._authErr('Vault data corrupted');
                
                let valid = await verifyPassword(pw, salt, vault.verifier);
                // Fallback: legacy unlock
                if (!valid) valid = await this._tryLegacyUnlock(pw, salt, vault);
                if (!valid) return this._authErr('Wrong password');
                
                await deleteVault(vid);
                this._authErr('Vault "' + vault.name + '" permanently deleted');
                await this._loadVaultList();
                this._setAuthMode('unlock');
                return;
            }

            // After successful auth, load app
            await this._loadSettings();
            await this._loadItems();
            await this._initIntelligence();
            await this._initCompanion();
            const authScreen = this._shadow.getElementById('auth-screen');
            const appEl = this._shadow.getElementById('app');
            if (authScreen) authScreen.style.display = 'none';
            if (appEl) appEl.style.display = 'flex';
            const vl = this._shadow.getElementById('vault-label');
            if (vl) vl.textContent = this._vaultName;
            this._nav(this._tab);
        } catch (e) { this._log('error', 'Auth failed:', e); this._authErr('Error: ' + e.message); }
    }

    /* ── Legacy Vault Unlock (old format without verifier) ── */
    async _tryLegacyUnlock(password, salt, vault) {
        try {
            const { deriveKey, encryptData, decryptData } = await import('../core/crypto.js');
            const { getAllVessels } = await import('../core/db.js');
            
            // Derive key with legacy salt
            const key = await deriveKey(password, salt);
            
            // Try to decrypt the first vessel as a test
            const vessels = await getAllVessels();
            if (vessels.length === 0) {
                // Empty vault — assume password is correct
                return true;
            }
            
            // Try to decrypt first vessel
            const first = vessels[0];
            try {
                await decryptData(key, first.blob, first.iv);
                return true; // Successfully decrypted — password is correct
            } catch {
                return false; // Wrong password
            }
        } catch (err) {
            this._log('warn', 'Legacy unlock failed:', err);
            return false;
        }
    }

    /* ── Migrate Legacy Vault to New Format ── */
    async _migrateVault(vault, password, salt) {
        const logFile = `vault-migration-${vault.id}-${Date.now()}.log`;
        const log = [];
        const logEntry = (msg) => { log.push(`[${new Date().toISOString()}] ${msg}`); };
        
        try {
            logEntry(`Starting vault migration for "${vault.name}" (${vault.id})`);
            
            const { deriveKey, createVerifier, encryptData } = await import('../core/crypto.js');
            const { getAllVessels, saveVault, saveVessel, setSetting, getSetting } = await import('../core/db.js');
            
            // Step 1: Create verifier for new format
            logEntry('Creating challenge-verifier...');
            const verifier = await createVerifier(password, salt);
            
            // Step 2: Save vault with new format
            logEntry('Updating vault metadata...');
            await saveVault(vault.id, vault.name, salt, verifier);
            
            // Step 3: Re-encrypt all vessels with new format (they're already encrypted, just need metadata update)
            logEntry('Verifying vessel integrity...');
            const vessels = await getAllVessels();
            let verified = 0;
            let failed = 0;
            const key = await deriveKey(password, salt);
            const { decryptData } = await import('../core/crypto.js');
            
            for (const v of vessels) {
                try {
                    await decryptData(key, v.blob, v.iv);
                    verified++;
                } catch (err) {
                    failed++;
                    logEntry(`FAILED to decrypt vessel ${v.id}: ${err.message}`);
                }
            }
            
            logEntry(`Verification: ${verified} passed, ${failed} failed`);
            
            // Step 4: Migrate settings (habit checkins, etc.)
            logEntry('Migrating settings...');
            const habitCheckins = await getSetting('habitCheckins');
            if (habitCheckins) {
                // Re-encrypt with vault key
                const { ciphertext, iv } = await encryptData(key, habitCheckins);
                await setSetting('habitCheckins', { ciphertext: Array.from(new Uint8Array(ciphertext)), iv: Array.from(iv) });
                logEntry('Habit checkins re-encrypted');
            }
            
            // Step 5: Mark migration complete
            logEntry('Migration complete');
            await setSetting('__vaultVersion', 2);
            
            return { success: true, logFile, verified, failed };
        } catch (err) {
            logEntry(`MIGRATION FAILED: ${err.message}`);
            logEntry(`Stack: ${err.stack}`);
            
            // Save log file
            try {
                const { setSetting } = await import('../core/db.js');
                await setSetting(`__migrationLog_${vault.id}`, log);
            } catch (saveErr) {
                logEntry(`Failed to save migration log: ${saveErr.message}`);
            }
            
            return { success: false, logFile, error: err.message, log };
        }
    }


    _authErr(msg) { const el = this._shadow.getElementById('auth-err'); if (el) el.textContent = msg; }

    async _loadSettings() {
        try {
            const { getSetting } = await import('../core/db.js');
            const h = await getSetting('historyLimit');
            const r = await getSetting('retentionDays');
            const a = await getSetting('autoArchive');
            if (h) this._settings.historyLimit = JSON.parse(h);
            if (r) this._settings.retentionDays = JSON.parse(r);
            if (a) this._settings.autoArchive = JSON.parse(a);
        } catch (err) { this._log('warn', 'Settings load failed:', err); }
    }

    async _loadItems() {
        try {
            const { getAllVessels, getSetting } = await import('../core/db.js');
            const { decryptData } = await import('../core/crypto.js');
            const vessels = await getAllVessels();
            this._items = [];
            for (const v of vessels) {
                try {
                    const data = await decryptData(this._key, v.blob, v.iv);
                    const parsed = JSON.parse(data);
                    this._items.push({
                        id: v.id, type: v.type || parsed.type || 'unknown',
                        data: parsed.payload || parsed,
                        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                        priority: parsed.priority || v.priority || 'medium',
                        color: parsed.color || 'none',
                        isFlagged: parsed.isFlagged || false,
                        timestamp: v.timestamp, updatedAt: v.updatedAt
                    });
                } catch (err) { this._log('warn', 'Decrypt failed for', v.id, err); }
            }
            const hd = await getSetting('habitCheckins');
            if (hd) {
                try {
                    // Try decrypting (encrypted format)
                    const parsed = JSON.parse(hd);
                    if (parsed.ciphertext && parsed.iv) {
                        const { decryptData } = await import('../core/crypto.js');
                        const decrypted = await decryptData(this._key, new Uint8Array(parsed.ciphertext), new Uint8Array(parsed.iv));
                        this._habits = JSON.parse(decrypted);
                    } else {
                        // Legacy plaintext
                        this._habits = parsed;
                    }
                } catch { this._habits = JSON.parse(hd); }
            }
        } catch (err) { this._log('error', 'Load items failed:', err); }
    }

    async _initIntelligence() {
        try {
            const { IntelligenceEngine } = await import('../core/intelligence.js');
            this._intelligence = new IntelligenceEngine();
            this._intelligence.learn(this._items);
            this._prompts = this._intelligence.smartPrompts(this._items);
            this._renderPrompts();
        } catch (err) { this._log('warn', 'Intelligence init failed:', err); }
    }

    _renderPrompts() {
        const container = this._shadow.getElementById('smart-prompts');
        if (!container || !this._prompts.length) return;
        container.innerHTML = this._prompts.map(p =>
            `<div class="prompt ${p.type}"><span>${p.text}</span><button class="prompt-dismiss" onclick="this.parentElement.remove()">✕</button></div>`
        ).join('');
    }

    async _initCompanion() {
        try {
            const { CompanionEngine } = await import('../core/companion-engine.js');
            const { PERSONALITIES } = await import('../core/personality.js');
            this._companion = new CompanionEngine();
            this._companion.setKey(this._key); // Set vault key for encryption
            await this._companion.load();

            // Load saved personality
            const saved = localStorage.getItem('sovereign-personality');
            if (saved && PERSONALITIES[saved]) this._personality = saved;

            // Get personality instance
            const { personality } = await import('../core/personality.js');
            personality.set(this._personality);
            this._personalityInstance = personality;

            // Add greeting to companion chat
            const greeting = this._companion.greet(personality.get(), this._items);
            if (greeting) {
                this._addChat('bot', greeting);
            }

            // Mood check-in
            const moodPrompt = this._companion.moodCheckIn();
            if (moodPrompt) {
                this._addChat('bot', moodPrompt.text);
            }

            // Morning/evening prompts
            const hour = new Date().getHours();
            if (hour >= 8 && hour <= 10) {
                const pending = this._items.filter(i => i.type === 'task' && !i.data.completed).length;
                if (pending > 0) this._addChat('bot', `☀️ Good morning! You have ${pending} pending task${pending > 1 ? 's' : ''}. What would you like to focus on today?`);
            }
            if (hour >= 17 && hour <= 19) {
                const today = new Date().toDateString();
                const todayDone = this._items.filter(i => i.type === 'task' && i.data.completed && new Date(i.timestamp).toDateString() === today).length;
                if (todayDone > 0) this._addChat('bot', `🌅 You completed ${todayDone} task${todayDone > 1 ? 's' : ''} today. How are you feeling about your progress?`);
            }

            // Weekly summary (shown on Mondays)
            const dayOfWeek = new Date().getDay();
            if (dayOfWeek === 1 && hour >= 9) {
                const weekAgo = Date.now() - 604800000;
                const weekTasks = this._items.filter(i => i.type === 'task' && i.timestamp > weekAgo);
                const weekDone = weekTasks.filter(t => t.data.completed).length;
                const weekJournal = this._items.filter(i => i.type === 'journal' && i.timestamp > weekAgo).length;
                const weekExpenses = this._items.filter(i => i.type === 'ledger' && i.timestamp > weekAgo && i.data.type === 'debit').reduce((s, l) => s + Math.abs(parseFloat(l.data.amount) || 0), 0);
                this._addChat('bot', `📊 Weekly Summary: ${weekDone}/${weekTasks.length} tasks completed, ${weekJournal} journal entries, $${weekExpenses.toFixed(2)} spent. ${weekDone > weekTasks.length / 2 ? "Great week!" : "Room to grow this week."}`);
            }

            // Apply personality accent color
            this.style.setProperty('--personality-accent', personality.get().accent);
        } catch (err) { this._log('warn', 'Companion init failed:', err); }
    }

    /* ── CRUD ── */
    async _seal(type, payload, tags = [], priority = 'medium', color = 'none', isFlagged = false) {
        try {
            const { createVessel } = await import('../core/crypto.js');
            const { saveVessel } = await import('../core/db.js');
            const vessel = await createVessel(this._key, type, payload, tags, priority, color);
            const id = `${type}_${crypto.randomUUID()}`;
            await saveVessel(id, vessel.ciphertext, vessel.iv, type, tags, priority, color, isFlagged);
            await this._loadItems();
            this._nav(this._tab);
        } catch (err) { this._log('error', 'Seal failed:', err); }
    }

    async _delete(id) {
        try {
            const { deleteVessel } = await import('../core/db.js');
            await deleteVessel(id);
            await this._loadItems();
            this._nav(this._tab);
        } catch (err) { this._log('error', 'Delete failed:', err); }
    }

    async _update(id, payload, tags, priority, color, isFlagged) {
        try {
            const { createVessel } = await import('../core/crypto.js');
            const { updateVessel } = await import('../core/db.js');
            const item = this._items.find(i => i.id === id);
            if (!item) return;
            const vessel = await createVessel(this._key, item.type, payload, tags, priority, color);
            await updateVessel(id, vessel.ciphertext, vessel.iv, item.type, tags, priority, color, isFlagged);
            await this._loadItems();
            this._nav(this._tab);
        } catch (err) { this._log('error', 'Update failed:', err); }
    }

    /* ── Navigation ── */
    _nav(tab) {
        this._tab = tab;
        this._shadow.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        this._shadow.querySelectorAll('.mod').forEach(m => m.classList.toggle('active', m.dataset.mod === tab));
        const titles = { tasks: 'Tasks', notes: 'Notes', habits: 'Habits', ledger: 'Ledger', calendar: 'Calendar', analytics: 'Analytics', companion: 'Companion', settings: 'Settings' };
        const titleEl = this._shadow.getElementById('title');
        if (titleEl) titleEl.textContent = titles[tab] || tab;
        this._renderMod();
    }

    _renderMod() {
        const fn = { tasks: '_renderTasks', notes: '_renderNotes', habits: '_renderHabits', ledger: '_renderLedger', journal: '_renderJournal', calendar: '_renderCalendar', analytics: '_renderAnalytics', chat: '_renderChat', companion: '_renderCompanion', settings: '_renderSettings' }[this._tab];
        if (fn) this[fn]();
    }

    /* ── Render: Tasks ── */
    _renderTasks() {
        const tasks = this._items.filter(i => i.type === 'task');
        const done = tasks.filter(t => t.data.completed).length;
        const crit = tasks.filter(t => t.priority === 'critical' && !t.data.completed).length;
        const overdue = tasks.filter(t => !t.data.completed && t.data.dueDate && new Date(t.data.dueDate) < new Date()).length;
        const stats = this._shadow.getElementById('task-stats');
        if (stats) stats.innerHTML = `<div class="sc"><div class="sl">Completion</div><div class="sv">${tasks.length ? Math.round(done / tasks.length * 100) : 0}%</div><div class="ss">${done}/${tasks.length}</div></div><div class="sc"><div class="sl">Active</div><div class="sv">${tasks.length - done}</div></div><div class="sc"><div class="sl">Critical</div><div class="sv" style="color:var(--danger)">${crit}</div></div><div class="sc"><div class="sl">Overdue</div><div class="sv" style="color:var(--warn)">${overdue}</div></div>`;
        const list = this._shadow.getElementById('task-list');
        if (!list) return;
        if (!tasks.length) { list.innerHTML = '<div class="empty"><div class="ei">✓</div><div>No tasks yet</div></div>'; return; }
        list.innerHTML = tasks.map(t => {
            const due = t.data.dueDate ? new Date(t.data.dueDate).toLocaleDateString() : '';
            const od = !t.data.completed && t.data.dueDate && new Date(t.data.dueDate) < new Date();
            return `<div class="ic ${t.isFlagged ? 'flagged' : ''}"><button class="chk ${t.data.completed ? 'on' : ''}" data-id="${t.id}">${t.data.completed ? '✓' : ''}</button><div class="ib"><div class="it ${t.data.completed ? 'done' : ''}" data-edit="${t.id}">${t.isFlagged ? '🚩 ' : ''}${this._esc(t.data.title || 'Untitled')}</div><div class="im"><span class="pb p-${t.priority}">${t.priority}</span>${due ? `<span style="color:${od ? 'var(--danger)' : 'var(--t2)'}">${od ? '⚠ ' : ''}${due}</span>` : ''}${(t.tags || []).map(g => `<span class="tg">${this._esc(g)}</span>`).join('')}</div></div><button class="ab" data-edit="${t.id}">✎</button><button class="ab del" data-del="${t.id}">✕</button></div>`;
        }).join('');
    }

    /* ── Render: Notes ── */
    _renderNotes() {
        const notes = this._items.filter(i => i.type === 'note');
        const list = this._shadow.getElementById('note-list');
        if (!list) return;
        if (!notes.length) { list.innerHTML = '<div class="empty"><div class="ei">📝</div><div>No notes yet</div></div>'; return; }
        list.innerHTML = notes.map(n => `<div class="ic ${n.isFlagged ? 'flagged' : ''}"><div class="ib"><div class="it" data-edit="${n.id}">${n.isFlagged ? '🚩 ' : ''}${this._esc(n.data.title || 'Untitled')}</div><div class="im"><span>${this._esc((n.data.content || '').substring(0, 120))}${(n.data.content || '').length > 120 ? '...' : ''}</span>${(n.tags || []).map(g => `<span class="tg">${this._esc(g)}</span>`).join('')}<span>${new Date(n.timestamp).toLocaleDateString()}</span></div></div><button class="ab" data-edit="${n.id}">✎</button><button class="ab del" data-del="${n.id}">✕</button></div>`).join('');
    }

    /* ── Render: Habits ── */
    _renderHabits() {
        const habits = this._items.filter(i => i.type === 'habit');
        const list = this._shadow.getElementById('habit-list');
        if (!list) return;
        if (!habits.length) { list.innerHTML = '<div class="empty"><div class="ei">🔄</div><div>No habits yet</div></div>'; return; }
        const today = new Date().toDateString();
        list.innerHTML = `<div class="hg">` + habits.map(h => {
            const ci = this._habits[h.id] || [];
            const checked = ci.includes(today);
            let streak = 0; const d = new Date();
            while (ci.includes(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
            return `<div class="hc ${h.isFlagged ? 'flagged' : ''}"><div class="hh"><div><div class="ht">${h.isFlagged ? '🚩 ' : ''}${this._esc(h.data.title || 'Untitled')}</div><div class="hs">🔥 ${streak} day streak</div></div><button class="hcb ${checked ? 'on' : ''}" data-hid="${h.id}">✓</button></div><div class="im"><span class="pb p-${h.priority}">${h.priority}</span><span style="font-size:0.65rem;color:var(--t2)">${ci.length} check-ins</span></div><button class="ab" data-edit="${h.id}">✎</button><button class="ab del" data-del="${h.id}" style="margin-left:0.25rem">✕</button></div>`;
        }).join('') + `</div>`;
    }

    /* ── Render: Journal ── */
    _renderJournal() {
        const entries = this._items.filter(i => i.type === 'journal').sort((a, b) => b.timestamp - a.timestamp);
        const prompt = this._journalPrompts[Math.floor(Date.now() / 86400000) % this._journalPrompts.length];
        const today = new Date().toDateString();
        const todayEntry = entries.find(e => new Date(e.timestamp).toDateString() === today);

        const stats = this._shadow.getElementById('journal-stats');
        if (stats) {
            const moods = entries.filter(e => e.data.mood).map(e => e.data.mood);
            const moodCounts = {};
            moods.forEach(m => { moodCounts[m] = (moodCounts[m] || 0) + 1; });
            const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
            stats.innerHTML = `<div class="sc"><div class="sl">Entries</div><div class="sv">${entries.length}</div></div><div class="sc"><div class="sl">This Week</div><div class="sv">${entries.filter(e => (Date.now() - e.timestamp) < 604800000).length}</div></div><div class="sc"><div class="sl">Top Mood</div><div class="sv">${topMood ? this._moodEmoji(topMood[0]) : '—'}</div></div><div class="sc"><div class="sl">Streak</div><div class="sv">${this._journalStreak(entries)} days</div></div>`;
        }

        const list = this._shadow.getElementById('journal-list');
        if (!list) return;
        if (!entries.length) {
            list.innerHTML = `<div class="empty"><div class="ei">📔</div><div>No journal entries yet</div><div style="font-size:0.75rem;color:var(--t2);margin-top:0.5rem">Your private space for unstructured thoughts</div></div>`;
            return;
        }

        // Group by date
        const grouped = {};
        entries.forEach(e => {
            const date = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(e);
        });

        let html = '';
        for (const [date, items] of Object.entries(grouped)) {
            html += `<div style="font-size:0.7rem;color:var(--t2);margin:1rem 0 0.5rem;text-transform:uppercase;letter-spacing:0.05em">${date}</div>`;
            html += items.map(e => {
                const mood = e.data.mood ? this._moodEmoji(e.data.mood) : '';
                const preview = (e.data.content || '').substring(0, 150);
                return `<div class="ic ${e.isFlagged ? 'flagged' : ''}"><div class="ib"><div class="it" data-edit="${e.id}">${mood} ${this._esc(e.data.title || 'Untitled Entry')}</div><div class="im"><span>${this._esc(preview)}${(e.data.content || '').length > 150 ? '...' : ''}</span>${(e.tags || []).map(g => `<span class="tg">${this._esc(g)}</span>`).join('')}<span>${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div><button class="ab" data-edit="${e.id}">✎</button><button class="ab del" data-del="${e.id}">✕</button></div>`;
            }).join('');
        }
        list.innerHTML = html;

        // Show today's prompt
        const promptEl = this._shadow.getElementById('journal-prompt');
        if (promptEl) {
            promptEl.textContent = todayEntry ? `Continue today's entry...` : `"${prompt}"`;
        }
    }

    _moodEmoji(mood) {
        const map = { good: '😊', okay: '😐', sad: '😔', stressed: '😤', great: '🤩', tired: '😴', anxious: '😰', grateful: '🙏', hopeful: '🌟', peaceful: '🧘' };
        return map[mood] || '📝';
    }

    _journalStreak(entries) {
        if (!entries.length) return 0;
        let streak = 0;
        const d = new Date();
        const dates = new Set(entries.map(e => new Date(e.timestamp).toDateString()));
        while (dates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
        return streak;
    }

    /* ── Render: Ledger ── */
    _renderLedger() {
        const items = this._items.filter(i => i.type === 'ledger').sort((a, b) => a.timestamp - b.timestamp);
        let bal = 0, inc = 0, exp = 0;
        const rows = items.map(l => {
            const cr = l.data.type === 'credit';
            const amt = Math.abs(parseFloat(l.data.amount) || 0);
            if (cr) { bal += amt; inc += amt; } else { bal -= amt; exp += amt; }
            return { ...l, cr, amt, bal };
        });
        const sp = inc > 0 ? Math.round((bal / inc) * 100) : 0;
        const needs = items.filter(l => l.data.classification === 'need' && l.data.type === 'debit').reduce((s, l) => s + Math.abs(parseFloat(l.data.amount) || 0), 0);
        const wants = items.filter(l => l.data.classification === 'want' && l.data.type === 'debit').reduce((s, l) => s + Math.abs(parseFloat(l.data.amount) || 0), 0);
        const ts = needs + wants;
        const np = ts > 0 ? Math.round(needs / ts * 100) : 0;
        const wp = ts > 0 ? Math.round(wants / ts * 100) : 0;
        this._ledgerStats = { inc, exp, bal, sp, np, wp, needs, wants };
        const stats = this._shadow.getElementById('ledger-stats');
        if (stats) stats.innerHTML = `<div class="sc"><div class="sl">Net Balance</div><div class="sv ${bal >= 0 ? 'pos' : 'neg'}">$${bal.toFixed(2)}</div></div><div class="sc"><div class="sl">Income</div><div class="sv" style="color:var(--primary)">$${inc.toFixed(2)}</div></div><div class="sc"><div class="sl">Expenses</div><div class="sv" style="color:var(--danger)">$${exp.toFixed(2)}</div></div><div class="sc"><div class="sl">Saving</div><div class="sv">${sp}%</div><div class="ss">${items.length} txns</div></div>`;
        const tbody = this._shadow.getElementById('ledger-tbody');
        if (!tbody) return;
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--t2)">No transactions</td></tr>'; return; }
        tbody.innerHTML = rows.reverse().map(r => `<tr><td>${new Date(r.timestamp).toLocaleDateString()}</td><td>${this._esc(r.data.category || 'general')}</td><td><span class="tg" style="background:${r.cr ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};color:${r.cr ? 'var(--primary)' : 'var(--danger)'}">${r.cr ? 'Credit' : 'Debit'}</span></td><td>${this._esc(r.data.desc || '')}${r.data.notes ? `<br><span style="font-size:0.65rem;color:var(--t2)">${this._esc(r.data.notes)}</span>` : ''}</td><td class="${r.cr ? '' : 'amtd'}">${r.cr ? '' : '$' + r.amt.toFixed(2)}</td><td class="${r.cr ? 'amtc' : ''}">${r.cr ? '$' + r.amt.toFixed(2) : ''}</td><td class="${r.bal >= 0 ? 'pos' : 'neg'}">$${r.bal.toFixed(2)}</td><td><button class="ab del" data-del="${r.id}">✕</button></td></tr>`).join('');
    }

    /* ── Render: Calendar ── */
    _renderCalendar() {
        const view = this._shadow.getElementById('cal-view');
        const title = this._shadow.getElementById('cal-title');
        if (!view || !title) return;
        const all = this._items;
        const filtered = this._calFilter === 'all' ? all : all.filter(i => i.type === this._calFilter);

        if (this._calView === 'month') {
            // Use UTC to avoid timezone date shifts
            const y = this._calDate.getUTCFullYear(), m = this._calDate.getUTCMonth();
            title.textContent = new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const fd = new Date(Date.UTC(y, m, 1));
            const ld = new Date(Date.UTC(y, m + 1, 0));
            const sd = fd.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const today = new Date();
            let h = '<div class="cg">';
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => h += `<div class="ch">${d}</div>`);
            // Start from the Sunday before or on the 1st
            const start = new Date(Date.UTC(y, m, 1 - sd));
            for (let i = 0; i < 42; i++) {
                const d = new Date(start.getTime() + i * 86400000); // Add days in ms to avoid setDate timezone issues
                const other = d.getUTCMonth() !== m;
                const isToday = d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
                const ds = d.toISOString().split('T')[0]; // YYYY-MM-DD in UTC
                const di = filtered.filter(it => {
                    const itemDate = new Date(it.timestamp);
                    return itemDate.getUTCFullYear() === d.getUTCFullYear() && itemDate.getUTCMonth() === d.getUTCMonth() && itemDate.getUTCDate() === d.getUTCDate();
                });
                h += `<div class="cd ${other ? 'om' : ''} ${isToday ? 'td' : ''}"><div class="cdn">${d.getUTCDate()}</div>${di.slice(0, 3).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 15) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}${di.length > 3 ? `<div class="cm">+${di.length - 3}</div>` : ''}</div>`;
                if (d.getTime() > ld.getTime() && i >= 34) break;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'week') {
            const sow = new Date(this._calDate.getTime());
            sow.setUTCDate(sow.getUTCDate() - sow.getUTCDay());
            const eow = new Date(sow.getTime() + 6 * 86400000);
            title.textContent = `${sow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${eow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            let h = '<div class="cg">';
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => h += `<div class="ch">${d}</div>`);
            for (let i = 0; i < 7; i++) {
                const d = new Date(sow.getTime() + i * 86400000);
                const isToday = d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
                const di = filtered.filter(it => {
                    const itemDate = new Date(it.timestamp);
                    return itemDate.getUTCFullYear() === d.getUTCFullYear() && itemDate.getUTCMonth() === d.getUTCMonth() && itemDate.getUTCDate() === d.getUTCDate();
                });
                h += `<div class="cd ${isToday ? 'td' : ''}" style="min-height:100px"><div class="cdn">${d.getUTCDate()}</div>${di.slice(0, 4).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 15) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}${di.length > 4 ? `<div class="cm">+${di.length - 4}</div>` : ''}</div>`;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'workweek') {
            const sow = new Date(this._calDate.getTime());
            const day = sow.getUTCDay();
            sow.setUTCDate(sow.getUTCDate() - day + (day === 0 ? -6 : 1)); // Monday
            const eow = new Date(sow.getTime() + 4 * 86400000);
            title.textContent = `${sow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${eow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            let h = '<div class="cg">';
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(d => h += `<div class="ch">${d}</div>`);
            for (let i = 0; i < 5; i++) {
                const d = new Date(sow.getTime() + i * 86400000);
                const isToday = d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
                const di = filtered.filter(it => {
                    const itemDate = new Date(it.timestamp);
                    return itemDate.getUTCFullYear() === d.getUTCFullYear() && itemDate.getUTCMonth() === d.getUTCMonth() && itemDate.getUTCDate() === d.getUTCDate();
                });
                h += `<div class="cd ${isToday ? 'td' : ''}" style="min-height:100px"><div class="cdn">${d.getUTCDate()}</div>${di.slice(0, 4).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 15) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}${di.length > 4 ? `<div class="cm">+${di.length - 4}</div>` : ''}</div>`;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'day') {
            title.textContent = this._calDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const di = filtered.filter(it => {
                const itemDate = new Date(it.timestamp);
                return itemDate.getUTCFullYear() === this._calDate.getUTCFullYear() && itemDate.getUTCMonth() === this._calDate.getUTCMonth() && itemDate.getUTCDate() === this._calDate.getUTCDate();
            });
            let h = '';
            for (let hr = 0; hr < 24; hr++) {
                const hi = di.filter(it => new Date(it.timestamp).getUTCHours() === hr);
                h += `<div class="dh"><div class="dhl">${hr.toString().padStart(2, '0')}:00</div><div class="dhc">${hi.map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 30) || it.type; return `<div class="ci ${it.type}" style="margin-bottom:0.25rem">${this._esc(t)}</div>`; }).join('')}</div></div>`;
            }
            view.innerHTML = h;
        } else if (this._calView === 'schedule') {
            title.textContent = 'Schedule View';
            const sorted = [...filtered].sort((a, b) => b.timestamp - a.timestamp);
            let h = '<div style="display:flex;flex-direction:column;gap:0.375rem">';
            if (!sorted.length) h += '<div class="empty"><div class="ei">📅</div><div>No items</div></div>';
            sorted.forEach(it => {
                const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 40) || it.type;
                h += `<div class="ic"><div class="ib"><div class="it">${this._esc(t)}</div><div class="im"><span class="tg" style="background:var(--${it.type === 'task' ? 'primary' : it.type === 'note' ? 'info' : it.type === 'habit' ? 'warn' : 'purple'}20);color:var(--${it.type === 'task' ? 'primary' : it.type === 'note' ? 'info' : it.type === 'habit' ? 'warn' : 'purple'})">${it.type}</span><span>${new Date(it.timestamp).toLocaleString()}</span></div></div></div>`;
            });
            h += '</div>'; view.innerHTML = h;
        }
    }

    /* ── Render: Analytics ── */
    _renderAnalytics() {
        const tasks = this._items.filter(i => i.type === 'task');
        const notes = this._items.filter(i => i.type === 'note');
        const habits = this._items.filter(i => i.type === 'habit');
        const done = tasks.filter(t => t.data.completed).length;
        const cr = tasks.length ? Math.round(done / tasks.length * 100) : 0;
        let ms = 0, tst = 0;
        habits.forEach(h => { const ci = this._habits[h.id] || []; let s = 0; const d = new Date(); while (ci.includes(d.toDateString())) { s++; d.setDate(d.getDate() - 1); } if (s > ms) ms = s; tst += s; });
        const as = habits.length ? Math.round(tst / habits.length) : 0;
        const pr = { low: 0, medium: 0, high: 0, critical: 0 };
        tasks.forEach(t => { pr[t.priority] = (pr[t.priority] || 0) + 1; });
        const mp = Math.max(...Object.values(pr), 1);
        const colors = { low: '#3b82f6', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
        const ls = this._ledgerStats || { np: 0, wp: 0, needs: 0, wants: 0 };
        this._shadow.getElementById('analytics-stats').innerHTML = `<div class="sc"><div class="sl">Completion</div><div class="sv">${cr}%</div><div class="ss">${done}/${tasks.length}</div></div><div class="sc"><div class="sl">Best Streak</div><div class="sv">🔥 ${ms}</div><div class="ss">Avg: ${as}</div></div><div class="sc"><div class="sl">Notes</div><div class="sv">${notes.length}</div></div><div class="sc"><div class="sl">Total</div><div class="sv">${this._items.length}</div></div>`;
        this._shadow.getElementById('chart-priority').innerHTML = Object.entries(pr).map(([k, v]) => `<div class="cbi"><div class="cbv">${v}</div><div class="cbf" style="height:${(v / mp) * 100}%;background:${colors[k]}"></div><div class="cbl">${k}</div></div>`).join('');
        this._shadow.getElementById('chart-behavioral').innerHTML = `<div style="margin-bottom:0.75rem"><div style="display:flex;justify-content:space-between;font-size:0.75rem"><span>Needs</span><span>${ls.np}% ($${ls.needs.toFixed(2)})</span></div><div class="prb"><div class="prf" style="width:${ls.np}%;background:var(--info)"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:0.75rem"><span>Wants</span><span>${ls.wp}% ($${ls.wants.toFixed(2)})</span></div><div class="prb"><div class="prf" style="width:${ls.wp}%;background:var(--warn)"></div></div></div>`;
        const insights = [];
        const tsp = (ls.needs || 0) + (ls.wants || 0);
        if (tsp > 0 && ls.wp > 40) insights.push({ t: 'w', m: `High discretionary spending: ${ls.wp}% of expenses are "wants".` });
        const ov = tasks.filter(t => !t.data.completed && t.data.dueDate && new Date(t.data.dueDate) < new Date()).length;
        if (ov > 3) insights.push({ t: 'd', m: `${ov} overdue tasks. Consider breaking them down.` });
        // Monthly reflection
        const monthAgo = Date.now() - 2592000000;
        const monthTasks = tasks.filter(t => t.timestamp > monthAgo);
        const monthDone = monthTasks.filter(t => t.data.completed).length;
        const monthJournal = this._items.filter(i => i.type === 'journal' && i.timestamp > monthAgo).length;
        if (monthTasks.length > 0) insights.push({ t: 'i', m: `This month: ${monthDone}/${monthTasks.length} tasks completed (${monthTasks.length ? Math.round(monthDone/monthTasks.length*100) : 0}%). ${monthJournal > 0 ? `${monthJournal} journal entries written.` : ''} You're growing.` });
        // Habit consistency
        const lsh = habits.filter(h => { const ci = this._habits[h.id] || []; let s = 0; const d = new Date(); while (ci.includes(d.toDateString())) { s++; d.setDate(d.getDate() - 1); } return s < 3; }).length;
        if (habits.length > 0 && lsh / habits.length > 0.6) insights.push({ t: 'i', m: `${lsh}/${habits.length} habits have streaks < 3 days. Consistency opportunity.` });
        if (!insights.length) insights.push({ t: 'i', m: 'All systems optimal.' });
        const ic = { w: 'var(--warn)', d: 'var(--danger)', i: 'var(--info)' };
        this._shadow.getElementById('insights').innerHTML = insights.map(i => `<div style="padding:0.625rem 0;border-bottom:1px solid var(--bdr);font-size:0.8rem"><span style="color:${ic[i.t]};font-weight:600">● </span>${i.m}</div>`).join('');
    }

    /* ── Render: Companion ── */
    _renderCompanion() {
        const msgs = this._shadow.getElementById('chat-msgs');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    /* ── Render: Peer Chat ── */
    async _renderChat() {
        try {
            const { getAllConversations, getAllContacts } = await import('../core/chat-db.js');
            const convs = await getAllConversations();
            const contacts = await getAllContacts();

            // Always show conversation list
            const convList = this._shadow.getElementById('chat-conversations');
            if (convList) convList.parentElement.style.display = 'block';

            // Hide message view unless actively in a conversation
            const msgView = this._shadow.getElementById('chat-message-view');
            if (msgView && !this._currentChatConv) msgView.style.display = 'none';

            if (!convList) return;

            if (!convs.length) {
                convList.innerHTML = '<div class="empty"><div class="ei">💬</div><div>No conversations yet</div><div style="font-size:0.75rem;color:var(--t2);margin-top:0.5rem">Start a chat with a contact</div></div>';
                return;
            }

            convList.innerHTML = convs.map(c => {
                const lastMsg = c.lastMessage || 'No messages yet';
                const time = c.lastActivity ? new Date(c.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return `<div class="ic" data-chat-conv="${c.id}">
                    <div class="ib">
                        <div class="it">${this._esc(c.name || 'Unknown')}</div>
                        <div class="im"><span>${this._esc(lastMsg)}</span><span>${time}</span></div>
                    </div>
                    <button class="ab del" data-chat-del-conv="${c.id}" title="Delete conversation">✕</button>
                </div>`;
            }).join('');
        } catch (err) { this._log('warn', 'Chat render failed:', err); }
    }

    /* ── Render: Settings ── */
    _renderSettings() {
        const el = this._shadow.getElementById('item-count');
        if (el) el.textContent = `${this._items.length} vessels`;
        const h = this._shadow.getElementById('set-history');
        const r = this._shadow.getElementById('set-retention');
        const a = this._shadow.getElementById('set-archive');
        if (h) h.value = this._settings.historyLimit;
        if (r) r.value = this._settings.retentionDays;
        if (a) a.classList.toggle('on', this._settings.autoArchive);
    }

    /* ── Chat ── */
    _addChat(type, text) {
        const c = this._shadow.getElementById('chat-msgs');
        if (!c) return;
        const d = document.createElement('div');
        d.className = 'cm';
        d.innerHTML = `<div class="c${type === 'bot' ? 'b' : 'u'}">[${type === 'bot' ? 'Companion' : 'You'}]</div><div class="ct">${this._esc(text)}</div>`;
        c.appendChild(d); c.scrollTop = c.scrollHeight;
    }

    async _handleChat(text) {
        this._addChat('user', text);
        const p = this._personalityInstance?.get() || null;

        // Check for mood selection
        const moodMatch = text.match(/😊|😐|😔|😤|good|okay|not great|stressed|great|fine|tough|frustrating/i);
        if (moodMatch && this._companion) {
            const moodMap = { '😊': 'good', '😐': 'okay', '😔': 'sad', '😤': 'stressed', 'good': 'good', 'okay': 'okay', 'ok': 'okay', 'not great': 'sad', 'stressed': 'stressed', 'great': 'good', 'fine': 'okay', 'tough': 'sad', 'frustrating': 'stressed' };
            const mood = Object.entries(moodMap).find(([k]) => text.toLowerCase().includes(k.toLowerCase()));
            if (mood) {
                this._companion.logMood(mood[1], text);
                const responses = {
                    good: p?.companion('celebrate') || "That's wonderful! I'm glad you're doing well. 🌟",
                    okay: "Okay is a perfectly fine place to be. Some days are just steady days.",
                    sad: "I'm sorry you're feeling down. It's okay to not be okay. I'm here with you. 💚",
                    stressed: "Take a breath. You don't have to figure it all out right now. Want to talk about what's weighing on you?"
                };
                this._addChat('bot', responses[mood[1]] || "Thank you for sharing. I'm here.");
                return;
            }
        }

        // Check for personality change
        const personalityMatch = text.match(/zen|focus|playful|professional|energy/i);
        if (personalityMatch && text.toLowerCase().includes('mood') || text.toLowerCase().includes('personality') || text.toLowerCase().includes('tone')) {
            const { PERSONALITIES, personality } = await import('../core/personality.js');
            const match = Object.keys(PERSONALITIES).find(k => text.toLowerCase().includes(k));
            if (match) {
                this._personality = match;
                personality.set(match);
                this._personalityInstance = personality;
                localStorage.setItem('sovereign-personality', match);
                this.style.setProperty('--personality-accent', personality.get().accent);
                this._addChat('bot', personality.greeting());
                return;
            }
        }

        // Check for emotional conversation (not a command)
        if (this._companion && !text.match(/^(task|note|habit|expense|spent|log|spend|security|audit)/i)) {
            const response = this._companion.respond(text, this._items, p || {});
            this._addChat('bot', response);
            return;
        }

        // Process as commands
        try {
            const { parseSovereignIntent, performSecurityAudit } = await import('../core/companion.js');
            const commands = text.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
            let count = 0;
            for (const cmd of commands) {
                const { intent, payload } = await parseSovereignIntent(cmd);
                count++;
                if (intent === 'CREATE_TASK') { await this._seal('task', { title: payload, completed: false, createdAt: Date.now() }); this._addChat('bot', p?.companion('success') || `Task: "${payload}" ✓`); }
                else if (intent === 'CREATE_NOTE') { await this._seal('note', { title: 'Note', content: payload, createdAt: Date.now() }); this._addChat('bot', p?.companion('success') || 'Note sealed 📝'); }
                else if (intent === 'CREATE_HABIT') { await this._seal('habit', { title: payload, createdAt: Date.now() }); this._addChat('bot', p?.companion('success') || `Habit: "${payload}" 🔄`); }
                else if (intent === 'LOG_EXPENSE') { await this._seal('ledger', { desc: payload.desc, amount: -payload.amount, type: 'debit', category: 'general', classification: 'want', createdAt: Date.now() }); this._addChat('bot', `$${payload.amount} for ${payload.desc} 💰`); }
                else if (intent === 'SECURITY_AUDIT') { const a = await performSecurityAudit(); this._addChat('bot', `Vault: ${a.status}. ${a.recommendation}`); }
                else this._addChat('bot', payload);
            }
            if (count > 1) this._addChat('bot', `Processed ${count} commands.`);
        } catch (err) { this._log('error', 'Chat failed:', err); this._addChat('bot', p?.companion('error') || 'Error processing command.'); }
    }

    /* ── Edit Modal ── */
    _openEditModal(id) {
        const item = this._items.find(i => i.id === id);
        if (!item) return;
        const overlay = this._shadow.getElementById('edit-modal-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        const type = item.type;
        const d = item.data;

        // Populate modal based on type
        this._shadow.getElementById('edit-modal-title').textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        let html = '';
        if (type === 'task') {
            html = `
                <div class="emg"><label class="eml">Title</label><input type="text" id="edit-title" class="fi" value="${this._esc(d.title || '')}"></div>
                <div class="emg"><label class="eml">Content</label><textarea id="edit-content" class="ft" rows="4">${this._esc(d.content || '')}</textarea></div>
                <div class="emr"><div class="emg"><label class="eml">Priority</label><select id="edit-priority" class="fs"><option value="low" ${d.priority === 'low' ? 'selected' : ''}>Low</option><option value="medium" ${d.priority === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${d.priority === 'high' ? 'selected' : ''}>High</option><option value="critical" ${d.priority === 'critical' ? 'selected' : ''}>Critical</option></select></div>
                <div class="emg"><label class="eml">Due Date</label><input type="datetime-local" id="edit-due" class="fi" value="${d.dueDate || ''}"></div></div>
                <div class="emr"><div class="emg"><label class="eml">Color</label><select id="edit-color" class="fs"><option value="none" ${d.color === 'none' ? 'selected' : ''}>None</option><option value="red" ${d.color === 'red' ? 'selected' : ''}>Red</option><option value="orange" ${d.color === 'orange' ? 'selected' : ''}>Orange</option><option value="yellow" ${d.color === 'yellow' ? 'selected' : ''}>Yellow</option><option value="green" ${d.color === 'green' ? 'selected' : ''}>Green</option><option value="blue" ${d.color === 'blue' ? 'selected' : ''}>Blue</option><option value="purple" ${d.color === 'purple' ? 'selected' : ''}>Purple</option></select></div>
                <div class="emg"><label class="eml">Tags (comma sep)</label><input type="text" id="edit-tags" class="fi" value="${(item.tags || []).join(', ')}"></div></div>
                <div class="emg" style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="edit-flagged" ${item.isFlagged ? 'checked' : ''}><label for="edit-flagged" style="font-size:0.8rem">Flagged</label></div>`;
        } else if (type === 'note') {
            html = `
                <div class="emg"><label class="eml">Title</label><input type="text" id="edit-title" class="fi" value="${this._esc(d.title || '')}"></div>
                <div class="emg"><label class="eml">Content</label><textarea id="edit-content" class="ft" rows="8">${this._esc(d.content || '')}</textarea></div>
                <div class="emr"><div class="emg"><label class="eml">Priority</label><select id="edit-priority" class="fs"><option value="low" ${d.priority === 'low' ? 'selected' : ''}>Low</option><option value="medium" ${d.priority === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${d.priority === 'high' ? 'selected' : ''}>High</option></select></div>
                <div class="emg"><label class="eml">Color</label><select id="edit-color" class="fs"><option value="none" ${d.color === 'none' ? 'selected' : ''}>None</option><option value="red" ${d.color === 'red' ? 'selected' : ''}>Red</option><option value="blue" ${d.color === 'blue' ? 'selected' : ''}>Blue</option><option value="purple" ${d.color === 'purple' ? 'selected' : ''}>Purple</option></select></div></div>
                <div class="emg"><label class="eml">Tags (comma sep)</label><input type="text" id="edit-tags" class="fi" value="${(item.tags || []).join(', ')}"></div>
                <div class="emg" style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="edit-flagged" ${item.isFlagged ? 'checked' : ''}><label for="edit-flagged" style="font-size:0.8rem">Flagged</label></div>`;
        } else if (type === 'habit') {
            html = `
                <div class="emg"><label class="eml">Title</label><input type="text" id="edit-title" class="fi" value="${this._esc(d.title || '')}"></div>
                <div class="emr"><div class="emg"><label class="eml">Priority</label><select id="edit-priority" class="fs"><option value="low" ${d.priority === 'low' ? 'selected' : ''}>Low</option><option value="medium" ${d.priority === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${d.priority === 'high' ? 'selected' : ''}>High</option></select></div>
                <div class="emg"><label class="eml">Color</label><select id="edit-color" class="fs"><option value="none" ${d.color === 'none' ? 'selected' : ''}>None</option><option value="orange" ${d.color === 'orange' ? 'selected' : ''}>Orange</option><option value="green" ${d.color === 'green' ? 'selected' : ''}>Green</option></select></div></div>
                <div class="emg"><label class="eml">Tags (comma sep)</label><input type="text" id="edit-tags" class="fi" value="${(item.tags || []).join(', ')}"></div>
                <div class="emg" style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="edit-flagged" ${item.isFlagged ? 'checked' : ''}><label for="edit-flagged" style="font-size:0.8rem">Flagged</label></div>`;
        } else if (type === 'journal') {
            const moods = ['good','okay','sad','stressed','grateful','hopeful','peaceful','great','tired','anxious'];
            const moodOptions = moods.map(m => `<option value="${m}" ${d.mood === m ? 'selected' : ''}>${this._moodEmoji(m)} ${m}</option>`).join('');
            html = `
                <div class="emg"><label class="eml">Title</label><input type="text" id="edit-title" class="fi" value="${this._esc(d.title || '')}"></div>
                <div class="emg"><label class="eml">Content</label><textarea id="edit-content" class="ft" rows="10">${this._esc(d.content || '')}</textarea></div>
                <div class="emr"><div class="emg"><label class="eml">Mood</label><select id="edit-mood" class="fs"><option value="">—</option>${moodOptions}</select></div>
                <div class="emg"><label class="eml">Tags (comma sep)</label><input type="text" id="edit-tags" class="fi" value="${(item.tags || []).join(', ')}"></div></div>
                <div class="emg" style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox" id="edit-flagged" ${item.isFlagged ? 'checked' : ''}><label for="edit-flagged" style="font-size:0.8rem">Flagged</label></div>`;
        }
        this._shadow.getElementById('edit-modal-body').innerHTML = html;
        this._shadow.getElementById('edit-modal-save').onclick = () => this._saveEdit(id);
        this._shadow.getElementById('edit-modal-cancel').onclick = () => this._closeEditModal();
    }

    async _saveEdit(id) {
        const item = this._items.find(i => i.id === id);
        if (!item) return;
        const titleEl = this._shadow.getElementById('edit-title');
        const contentEl = this._shadow.getElementById('edit-content');
        const priorityEl = this._shadow.getElementById('edit-priority');
        const dueEl = this._shadow.getElementById('edit-due');
        const colorEl = this._shadow.getElementById('edit-color');
        const tagsEl = this._shadow.getElementById('edit-tags');
        const flaggedEl = this._shadow.getElementById('edit-flagged');
        const moodEl = this._shadow.getElementById('edit-mood');

        const payload = { ...item.data };
        if (titleEl) payload.title = titleEl.value.trim() || payload.title;
        if (contentEl) payload.content = contentEl.value.trim();
        if (dueEl) payload.dueDate = dueEl.value || null;
        if (moodEl) payload.mood = moodEl.value || null;
        const tags = tagsEl ? tagsEl.value.split(',').map(x => x.trim()).filter(Boolean) : item.tags;
        const priority = priorityEl ? priorityEl.value : item.priority;
        const color = colorEl ? colorEl.value : item.color;
        const isFlagged = flaggedEl ? flaggedEl.checked : item.isFlagged;

        await this._update(id, payload, tags, priority, color, isFlagged);
        this._closeEditModal();
    }

    _closeEditModal() {
        const overlay = this._shadow.getElementById('edit-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /* ── Export/Import ── */
    _download(content, name, type) {
        const b = new Blob([content], { type });
        const u = URL.createObjectURL(b);
        const a = document.createElement('a'); a.href = u; a.download = name;
        this._shadow.host.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(u);
    }

    _exportJSON() {
        const data = this._items.map(i => ({ id: i.id, type: i.type, data: i.data, tags: i.tags, priority: i.priority, color: i.color, isFlagged: i.isFlagged, timestamp: i.timestamp }));
        this._download(JSON.stringify(data, null, 2), `vault-${Date.now()}.json`, 'application/json');
    }

    _exportCSV() {
        const h = ['Type', 'Timestamp', 'Priority', 'Color', 'Flagged', 'Tags', 'Payload'];
        const r = this._items.map(i => [i.type, new Date(i.timestamp).toISOString(), i.priority, i.color, i.isFlagged, (i.tags || []).join(';'), JSON.stringify(i.data).replace(/"/g, '""')]);
        this._download([h, ...r].map(x => x.map(c => `"${c}"`).join(',')).join('\n'), `vault-${Date.now()}.csv`, 'text/csv');
    }

    _exportTXT() {
        const lines = this._items.map(i => { const t = i.data?.title || i.data?.desc || i.data?.content?.substring(0, 50) || i.type; return `[${i.type.toUpperCase()}] ${t}\n  Date: ${new Date(i.timestamp).toLocaleString()}\n  Priority: ${i.priority}\n  Tags: ${(i.tags || []).join(', ')}\n`; }).join('\n');
        this._download(lines, `vault-${Date.now()}.txt`, 'text/plain');
    }

    async _importJSON(file) {
        try {
            const { createVessel } = await import('../core/crypto.js');
            const { saveVessel } = await import('../core/db.js');
            const data = JSON.parse(await file.text());
            const items = Array.isArray(data) ? data : [data];
            let c = 0;
            for (const it of items) {
                const v = await createVessel(this._key, it.type || 'note', it.data || it.payload || {}, it.tags || [], it.priority || 'medium', it.color || 'none');
                await saveVessel(it.id || `${it.type || 'note'}_${crypto.randomUUID()}`, v.ciphertext, v.iv, it.type || 'note', it.tags || [], it.priority || 'medium', it.color || 'none', it.isFlagged || false);
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
        } catch (e) { this._log('error', 'JSON import failed:', e); alert('Import failed: ' + e.message); }
    }

    async _importCSV(file) {
        try {
            const { createVessel } = await import('../core/crypto.js');
            const { saveVessel } = await import('../core/db.js');
            const lines = (await file.text()).split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
            let c = 0;
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
                const row = {}; headers.forEach((h, idx) => row[h] = vals[idx] || '');
                const type = row.type || 'note';
                let payload = {};
                try { Object.assign(payload, JSON.parse(row.payload || '{}')); } catch (e) { this._log('warn', 'CSV payload parse failed:', e); }
                const tags = row.tags ? row.tags.split(';').filter(Boolean) : [];
                const v = await createVessel(this._key, type, payload, tags, row.priority || 'medium', row.color || 'none');
                await saveVessel(`${type}_${crypto.randomUUID()}`, v.ciphertext, v.iv, type, tags, row.priority || 'medium', row.color || 'none', row.flagged === 'true');
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
        } catch (e) { this._log('error', 'CSV import failed:', e); alert('Import failed: ' + e.message); }
    }

    async _importICS(file) {
        try {
            const { createVessel } = await import('../core/crypto.js');
            const { saveVessel } = await import('../core/db.js');
            const text = await file.text();
            const events = text.split('BEGIN:VEVENT').slice(1);
            let c = 0;
            for (const ev of events) {
                const summary = ev.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Event';
                const desc = ev.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || '';
                const dt = ev.match(/DTSTART[:;]?(.*)/)?.[1]?.trim();
                const due = dt ? new Date(dt.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toISOString() : null;
                const v = await createVessel(this._key, 'task', { title: summary, content: desc, dueDate: due, completed: false, createdAt: Date.now() }, ['imported-ics']);
                await saveVessel(`task_${crypto.randomUUID()}`, v.ciphertext, v.iv, 'task', ['imported-ics']);
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
        } catch (e) { this._log('error', 'ICS import failed:', e); alert('Import failed: ' + e.message); }
    }

    _exportLedgerCSV() {
        const items = this._items.filter(i => i.type === 'ledger').sort((a, b) => a.timestamp - b.timestamp);
        const h = ['Date', 'Description', 'Type', 'Category', 'Classification', 'Amount', 'Notes'];
        const r = items.map(l => [new Date(l.timestamp).toLocaleDateString(), l.data.desc || '', l.data.type || 'debit', l.data.category || 'general', l.data.classification || 'need', l.data.amount || 0, l.data.notes || '']);
        this._download([h, ...r].map(x => x.map(c => `"${c}"`).join(',')).join('\n'), `ledger-${Date.now()}.csv`, 'text/csv');
    }

    async _importLedgerCSV(file) {
        try {
            const { createVessel } = await import('../core/crypto.js');
            const { saveVessel } = await import('../core/db.js');
            const lines = (await file.text()).split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
            let c = 0;
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
                const row = {}; headers.forEach((h, idx) => row[h] = vals[idx] || '');
                const amt = parseFloat(row.amount) || 0;
                const type = row.type === 'credit' ? 'credit' : 'debit';
                const v = await createVessel(this._key, 'ledger', { desc: row.description || row.desc || '', amount: type === 'debit' ? -Math.abs(amt) : Math.abs(amt), type, category: row.category || 'general', classification: row.classification || 'need', notes: row.notes || '', createdAt: Date.now() });
                await saveVessel(`ledger_${crypto.randomUUID()}`, v.ciphertext, v.iv, 'ledger');
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
        } catch (e) { this._log('error', 'Ledger CSV import failed:', e); alert('Import failed: ' + e.message); }
    }

    /* ── Journal Export ── */
    _exportJournalMD() {
        const entries = this._items.filter(i => i.type === 'journal').sort((a, b) => a.timestamp - b.timestamp);
        if (!entries.length) return;
        let md = `# Journal — ${this._vaultName}\n\n`;
        let currentDate = '';
        for (const e of entries) {
            const date = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (date !== currentDate) { md += `\n---\n\n## ${date}\n\n`; currentDate = date; }
            const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const mood = e.data.mood ? ` *(${e.data.mood})*` : '';
            md += `### ${time} — ${this._esc(e.data.title || 'Untitled')}${mood}\n\n`;
            if (e.data.content) md += `${e.data.content}\n\n`;
            if (e.tags && e.tags.length) md += `*Tags: ${e.tags.join(', ')}*\n\n`;
        }
        this._download(md, `journal-${Date.now()}.md`, 'text/markdown');
    }

    _exportJournalTXT() {
        const entries = this._items.filter(i => i.type === 'journal').sort((a, b) => a.timestamp - b.timestamp);
        if (!entries.length) return;
        let txt = `JOURNAL — ${this._vaultName}\n${'='.repeat(50)}\n\n`;
        for (const e of entries) {
            const date = new Date(e.timestamp).toLocaleString();
            const mood = e.data.mood ? ` [${e.data.mood}]` : '';
            txt += `${date}${mood}\n${e.data.title || 'Untitled'}\n${'-'.repeat(30)}\n`;
            if (e.data.content) txt += `${e.data.content}\n`;
            if (e.tags && e.tags.length) txt += `Tags: ${e.tags.join(', ')}\n`;
            txt += '\n\n';
        }
        this._download(txt, `journal-${Date.now()}.txt`, 'text/plain');
    }

    _exportJournalJSON() {
        const entries = this._items.filter(i => i.type === 'journal').map(e => ({
            id: e.id, title: e.data.title, content: e.data.content,
            mood: e.data.mood, date: e.data.date, tags: e.tags,
            timestamp: e.timestamp
        }));
        this._download(JSON.stringify(entries, null, 2), `journal-${Date.now()}.json`, 'application/json');
    }

    /* ── Peer Chat Methods ── */
    async _chatNewContact() {
        try {
            const { saveContact, generateKeyPair, exportPublicKey } = await import('../core/chat-db.js');
            const name = prompt('Contact name:');
            if (!name) return;
            const id = 'contact_' + crypto.randomUUID();
            const keyPair = await generateKeyPair();
            const pubKey = await exportPublicKey(keyPair);
            await saveContact({ id, name, publicKey: Array.from(new Uint8Array(pubKey)), createdAt: Date.now() });
            this._renderChat();
        } catch (err) { this._log('error', 'New contact failed:', err); }
    }

    async _chatNewConversation() {
        try {
            const { saveConversation, getAllContacts } = await import('../core/chat-db.js');
            const contacts = await getAllContacts();
            if (!contacts.length) {
                alert('No contacts yet. Add a contact first.');
                return;
            }
            const contactNames = contacts.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
            const choice = prompt(`Select contact:\n${contactNames}\n\nEnter number:`);
            const idx = parseInt(choice) - 1;
            if (isNaN(idx) || idx < 0 || idx >= contacts.length) return;
            const contact = contacts[idx];
            const id = 'conv_' + crypto.randomUUID();
            await saveConversation({ id, name: contact.name, contactId: contact.id, lastActivity: Date.now() });
            this._renderChat();
        } catch (err) { this._log('error', 'New conversation failed:', err); }
    }

    async _chatOpenConversation(convId) {
        try {
            const { getConversation, getMessages, decryptData } = await import('../core/chat-db.js');
            const conv = await getConversation(convId);
            if (!conv) return;
            this._currentChatConv = convId;
            const convList = this._shadow.getElementById('chat-conversations');
            if (convList) convList.closest('.card').style.display = 'none';
            const msgView = this._shadow.getElementById('chat-message-view');
            if (msgView) msgView.style.display = 'block';
            const titleEl = this._shadow.getElementById('chat-conv-title');
            if (titleEl) titleEl.textContent = conv.name;
            const msgs = await getMessages(convId);
            const msgList = this._shadow.getElementById('chat-msg-list');
            if (msgList) {
                // Decrypt messages
                const chatKey = this._chatKey || this._key;
                const decryptedMsgs = [];
                for (const m of msgs) {
                    let content = m.content || '[encrypted]';
                    if (m.ciphertext && m.iv && chatKey) {
                        try {
                            content = await decryptData(chatKey, new Uint8Array(m.ciphertext), new Uint8Array(m.iv));
                        } catch { content = '[decrypt failed]'; }
                    }
                    decryptedMsgs.push({ ...m, content });
                }
                msgList.innerHTML = decryptedMsgs.reverse().map(m => {
                    const isMine = m.sender === 'me';
                    return `<div style="text-align:${isMine ? 'right' : 'left'};margin-bottom:0.5rem">
                        <div style="display:inline-block;max-width:80%;padding:0.5rem 0.75rem;border-radius:0.75rem;background:${isMine ? 'var(--primary)' : 'var(--s2)'};color:${isMine ? '#000' : 'var(--t1)'};font-size:0.8rem">
                            ${this._esc(m.content || '')}
                        </div>
                        <div style="font-size:0.6rem;color:var(--t2);margin-top:0.125rem">${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>`;
                }).join('');
                msgList.scrollTop = msgList.scrollHeight;
            }
        } catch (err) { this._log('error', 'Open conversation failed:', err); }
    }

    async _chatBackToList() {
        this._currentChatConv = null;
        const convList = this._shadow.getElementById('chat-conversations');
        if (convList) convList.closest('.card').style.display = 'block';
        const msgView = this._shadow.getElementById('chat-message-view');
        if (msgView) msgView.style.display = 'none';
        this._renderChat();
    }

    async _chatSendMessage() {
        if (!this._currentChatConv) return;
        const input = this._shadow.getElementById('chat-msg-input');
        if (!input || !input.value.trim()) return;
        try {
            const { saveMessage, encryptData } = await import('../core/chat-db.js');
            const content = input.value.trim();
            // Encrypt message content before storing in chat DB
            const chatKey = this._chatKey || this._key; // Use vault key as fallback for self-chat
            const { ciphertext, iv } = await encryptData(chatKey, content);
            await saveMessage({
                id: 'msg_' + crypto.randomUUID(),
                conversationId: this._currentChatConv,
                sender: 'me',
                ciphertext: Array.from(new Uint8Array(ciphertext)),
                iv: Array.from(iv),
                mimeType: 'text/plain',
                timestamp: Date.now()
            });
            input.value = '';
            this._chatOpenConversation(this._currentChatConv);
        } catch (err) { this._log('error', 'Send message failed:', err); }
    }

    /* ── Bind Events ── */
    async _bind() {
        // Auth
        const pwEl = this._shadow.getElementById('auth-pw');
        if (pwEl) pwEl.addEventListener('keydown', e => { if (e.key === 'Enter') this._handleAuth(); });
        const submitEl = this._shadow.getElementById('auth-submit');
        if (submitEl) submitEl.onclick = () => this._handleAuth();
        const clEl = this._shadow.getElementById('create-link');
        if (clEl) clEl.onclick = (e) => { e.preventDefault(); this._setAuthMode('create'); };
        const blEl = this._shadow.getElementById('back-link');
        if (blEl) blEl.onclick = (e) => { e.preventDefault(); this._setAuthMode('unlock'); };
        const dlEl = this._shadow.getElementById('delete-link');
        if (dlEl) dlEl.onclick = (e) => { e.preventDefault(); this._setAuthMode('delete'); };

        // Nav
        this._shadow.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => this._nav(b.dataset.tab));

        // Task add
        const addTask = this._shadow.getElementById('add-task');
        if (addTask) addTask.onclick = () => {
            const t = this._shadow.getElementById('task-in')?.value.trim();
            if (!t) return;
            const due = this._shadow.getElementById('task-due')?.value || null;
            const pri = this._shadow.getElementById('task-pri')?.value;
            const tags = (this._shadow.getElementById('task-tags')?.value || '').split(',').map(x => x.trim()).filter(Boolean);
            this._seal('task', { title: t, completed: false, dueDate: due, createdAt: Date.now() }, tags, pri);
            const ti = this._shadow.getElementById('task-in'); if (ti) ti.value = '';
            const td = this._shadow.getElementById('task-due'); if (td) td.value = '';
            const tt = this._shadow.getElementById('task-tags'); if (tt) tt.value = '';
        };

        // Note add
        const addNote = this._shadow.getElementById('add-note');
        if (addNote) addNote.onclick = () => {
            const t = this._shadow.getElementById('note-title')?.value.trim();
            const c = this._shadow.getElementById('note-body')?.value.trim();
            if (!c && !t) return;
            const tags = (this._shadow.getElementById('note-tags')?.value || '').split(',').map(x => x.trim()).filter(Boolean);
            this._seal('note', { title: t || 'Untitled', content: c, createdAt: Date.now() }, tags);
            const nt = this._shadow.getElementById('note-title'); if (nt) nt.value = '';
            const nb = this._shadow.getElementById('note-body'); if (nb) nb.value = '';
            const ntags = this._shadow.getElementById('note-tags'); if (ntags) ntags.value = '';
        };

        // Habit add
        const addHabit = this._shadow.getElementById('add-habit');
        if (addHabit) addHabit.onclick = () => {
            const t = this._shadow.getElementById('habit-in')?.value.trim();
            if (!t) return;
            this._seal('habit', { title: t, createdAt: Date.now() }, [], this._shadow.getElementById('habit-pri')?.value);
            const hi = this._shadow.getElementById('habit-in'); if (hi) hi.value = '';
        };

        // Ledger add
        const addLedger = this._shadow.getElementById('add-ledger');
        if (addLedger) addLedger.onclick = () => {
            const desc = this._shadow.getElementById('ledger-desc')?.value.trim();
            const amt = parseFloat(this._shadow.getElementById('ledger-amt')?.value);
            const type = this._shadow.getElementById('ledger-type')?.value;
            const cat = this._shadow.getElementById('ledger-cat')?.value;
            const cls = this._shadow.getElementById('ledger-cls')?.value;
            const notes = this._shadow.getElementById('ledger-notes')?.value.trim();
            if (!desc || isNaN(amt)) return;
            this._seal('ledger', { desc, amount: type === 'debit' ? -Math.abs(amt) : Math.abs(amt), type, category: cat, classification: cls, notes, createdAt: Date.now() });
            const ld = this._shadow.getElementById('ledger-desc'); if (ld) ld.value = '';
            const la = this._shadow.getElementById('ledger-amt'); if (la) la.value = '';
            const ln = this._shadow.getElementById('ledger-notes'); if (ln) ln.value = '';
        };

        // Journal
        this._journalMood = '';
        this._shadow.querySelectorAll('.mood-btn').forEach(btn => {
            btn.onclick = () => {
                this._shadow.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._journalMood = btn.dataset.mood;
            };
        });
        const addJournal = this._shadow.getElementById('add-journal');
        if (addJournal) addJournal.onclick = () => {
            const title = this._shadow.getElementById('journal-title')?.value.trim();
            const content = this._shadow.getElementById('journal-body')?.value.trim();
            if (!content && !title) return;
            const tags = (this._shadow.getElementById('journal-tags')?.value || '').split(',').map(x => x.trim()).filter(Boolean);
            this._seal('journal', { title: title || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), content, mood: this._journalMood, date: new Date().toISOString(), createdAt: Date.now() }, tags);
            const jt = this._shadow.getElementById('journal-title'); if (jt) jt.value = '';
            const jb = this._shadow.getElementById('journal-body'); if (jb) jb.value = '';
            const jtags = this._shadow.getElementById('journal-tags'); if (jtags) jtags.value = '';
            this._journalMood = '';
            this._shadow.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        };

        // Journal export
        const expJournalMd = this._shadow.getElementById('exp-journal-md');
        if (expJournalMd) expJournalMd.onclick = () => this._exportJournalMD();
        const expJournalTxt = this._shadow.getElementById('exp-journal-txt');
        if (expJournalTxt) expJournalTxt.onclick = () => this._exportJournalTXT();
        const expJournalJson = this._shadow.getElementById('exp-journal-json');
        if (expJournalJson) expJournalJson.onclick = () => this._exportJournalJSON();
        const impJournal = this._shadow.getElementById('imp-journal');
        if (impJournal) impJournal.onclick = () => this._shadow.getElementById('fi-journal')?.click();

        // Voice input for journal
        this._journalVoiceActive = false;
        const journalVoice = this._shadow.getElementById('journal-voice');
        if (journalVoice) {
            journalVoice.onclick = () => {
                if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                    alert('Voice input not supported in this browser.');
                    return;
                }
                if (this._journalVoiceActive) {
                    this._journalVoiceRecognition?.stop();
                    this._journalVoiceActive = false;
                    journalVoice.classList.remove('recording');
                    journalVoice.textContent = '🎤 Speak';
                    return;
                }
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                this._journalVoiceRecognition = new SR();
                this._journalVoiceRecognition.continuous = true;
                this._journalVoiceRecognition.interimResults = true;
                this._journalVoiceRecognition.lang = 'en-US';
                this._journalVoiceRecognition.onresult = (e) => {
                    let transcript = '';
                    for (let i = 0; i < e.results.length; i++) {
                        transcript += e.results[i][0].transcript;
                    }
                    const body = this._shadow.getElementById('journal-body');
                    if (body) body.value = transcript;
                };
                this._journalVoiceRecognition.onend = () => {
                    this._journalVoiceActive = false;
                    journalVoice.classList.remove('recording');
                    journalVoice.textContent = '🎤 Speak';
                };
                this._journalVoiceRecognition.start();
                this._journalVoiceActive = true;
                journalVoice.classList.add('recording');
                journalVoice.textContent = '⏹ Stop';
            };
        }

        // Read aloud last journal entry
        const journalRead = this._shadow.getElementById('journal-read');
        if (journalRead) {
            journalRead.onclick = () => {
                if (!('speechSynthesis' in window)) {
                    alert('Text-to-speech not supported.');
                    return;
                }
                const entries = this._items.filter(i => i.type === 'journal').sort((a, b) => b.timestamp - a.timestamp);
                if (!entries.length) { alert('No journal entries to read.'); return; }
                const last = entries[0];
                const text = `${last.data.title || 'Untitled'}. ${last.data.content || ''}`;
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(text);
                utter.rate = 0.9;
                window.speechSynthesis.speak(utter);
            };
        }

        // Journal import
        const fiJournal = this._shadow.getElementById('fi-journal');
        if (fiJournal) fiJournal.onchange = async e => {
            if (!e.target.files[0]) return;
            try {
                const { createVessel } = await import('../core/crypto.js');
                const { saveVessel } = await import('../core/db.js');
                const data = JSON.parse(await e.target.files[0].text());
                const entries = Array.isArray(data) ? data : [data];
                let count = 0;
                for (const entry of entries) {
                    const vessel = await createVessel(this._key, 'journal', entry, entry.tags || [], 'medium', 'none');
                    const id = entry.id || `journal_${crypto.randomUUID()}`;
                    await saveVessel(id, vessel.ciphertext, vessel.iv, 'journal', entry.tags || []);
                    count++;
                }
                await this._loadItems();
                this._nav(this._tab);
                alert(`Imported ${count} journal entries`);
            } catch (err) { this._log('error', 'Journal import failed:', err); alert('Import failed: ' + err.message); }
            e.target.value = '';
        };

        // Help modal
        const helpBtn = this._shadow.getElementById('help-btn');
        if (helpBtn) helpBtn.onclick = () => this._shadow.getElementById('help-modal').classList.add('show');
        const helpClose = this._shadow.getElementById('help-close');
        if (helpClose) helpClose.onclick = () => this._shadow.getElementById('help-modal').classList.remove('show');
        const helpOverlay = this._shadow.getElementById('help-modal');
        if (helpOverlay) helpOverlay.onclick = (e) => { if (e.target === helpOverlay) helpOverlay.classList.remove('show'); };

        // Peer Chat (isolated from vault data)
        this._currentChatConv = null;
        const chatNewContact = this._shadow.getElementById('chat-new-contact');
        if (chatNewContact) chatNewContact.onclick = () => this._chatNewContact();
        const chatNewConv = this._shadow.getElementById('chat-new-conv');
        if (chatNewConv) chatNewConv.onclick = () => this._chatNewConversation();
        const chatBack = this._shadow.getElementById('chat-back');
        if (chatBack) chatBack.onclick = () => this._chatBackToList();
        const chatMsgSend = this._shadow.getElementById('chat-msg-send');
        if (chatMsgSend) chatMsgSend.onclick = () => this._chatSendMessage();
        const chatMsgInput = this._shadow.getElementById('chat-msg-input');
        if (chatMsgInput) chatMsgInput.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { this._chatSendMessage(); e.target.value = ''; } });

        // Calendar
        const calPrev = this._shadow.getElementById('cal-prev');
        if (calPrev) calPrev.onclick = () => {
            if (this._calView === 'month') this._calDate.setMonth(this._calDate.getMonth() - 1);
            else if (this._calView === 'week' || this._calView === 'workweek') this._calDate.setDate(this._calDate.getDate() - 7);
            else this._calDate.setDate(this._calDate.getDate() - 1);
            this._renderCalendar();
        };
        const calNext = this._shadow.getElementById('cal-next');
        if (calNext) calNext.onclick = () => {
            if (this._calView === 'month') this._calDate.setMonth(this._calDate.getMonth() + 1);
            else if (this._calView === 'week' || this._calView === 'workweek') this._calDate.setDate(this._calDate.getDate() + 7);
            else this._calDate.setDate(this._calDate.getDate() + 1);
            this._renderCalendar();
        };
        const calToday = this._shadow.getElementById('cal-today');
        if (calToday) calToday.onclick = () => { this._calDate = new Date(); this._renderCalendar(); };
        this._shadow.querySelectorAll('.cv-btn').forEach(b => b.onclick = () => {
            this._calView = b.dataset.cv;
            this._shadow.querySelectorAll('.cv-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            this._renderCalendar();
        });
        const calFilter = this._shadow.getElementById('cal-filter');
        if (calFilter) calFilter.onchange = () => { this._calFilter = calFilter.value; this._renderCalendar(); };

        // Chat
        const chatSend = this._shadow.getElementById('chat-send');
        if (chatSend) chatSend.onclick = () => {
            const inp = this._shadow.getElementById('chat-in');
            if (!inp || !inp.value.trim()) return;
            this._handleChat(inp.value.trim());
            inp.value = '';
        };
        const chatIn = this._shadow.getElementById('chat-in');
        if (chatIn) chatIn.addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.target.value.trim()) { this._handleChat(e.target.value.trim()); e.target.value = ''; }
        });

        // Theme
        const themeBtn = this._shadow.getElementById('theme-btn');
        if (themeBtn) themeBtn.onclick = () => {
            this._themeIdx = (this._themeIdx + 1) % 5;
            this._applyTheme(this._themeIdx);
        };

        // Lock & Delete vault
        const lockBtn = this._shadow.getElementById('lock-btn');
        if (lockBtn) lockBtn.onclick = () => {
            this._key = null; this._salt = null; this._items = [];
            const authScreen = this._shadow.getElementById('auth-screen');
            const appEl = this._shadow.getElementById('app');
            if (authScreen) authScreen.style.display = 'flex';
            if (appEl) appEl.style.display = 'none';
            const pw = this._shadow.getElementById('auth-pw'); if (pw) pw.value = '';
            this._authErr('');
            this._setAuthMode('unlock');
            this._loadVaultList();
        };
        const delVaultBtn = this._shadow.getElementById('delete-vault-btn');
        if (delVaultBtn) delVaultBtn.onclick = () => {
            this._key = null; this._salt = null; this._items = [];
            const authScreen = this._shadow.getElementById('auth-screen');
            const appEl = this._shadow.getElementById('app');
            if (authScreen) authScreen.style.display = 'flex';
            if (appEl) appEl.style.display = 'none';
            this._setAuthMode('delete');
            this._loadVaultList();
        };

        // Export/Import
        const bindBtn = (id, fn) => { const el = this._shadow.getElementById(id); if (el) el.onclick = fn; };
        bindBtn('exp-json', () => this._exportJSON());
        bindBtn('imp-json', () => this._shadow.getElementById('fi-json')?.click());
        bindBtn('imp-csv', () => this._shadow.getElementById('fi-csv')?.click());
        bindBtn('imp-ics', () => this._shadow.getElementById('fi-ics')?.click());
        bindBtn('exp-ledger', () => this._exportLedgerCSV());
        bindBtn('imp-ledger', () => this._shadow.getElementById('fi-ledger')?.click());
        bindBtn('exp-json2', () => this._exportJSON());
        bindBtn('exp-csv2', () => this._exportCSV());
        bindBtn('exp-txt2', () => this._exportTXT());
        bindBtn('imp-json2', () => this._shadow.getElementById('fi-json')?.click());
        bindBtn('imp-csv2', () => this._shadow.getElementById('fi-csv')?.click());
        bindBtn('imp-ics2', () => this._shadow.getElementById('fi-ics')?.click());

        const bindFile = (id, fn) => { const el = this._shadow.getElementById(id); if (el) el.onchange = e => { if (e.target.files[0]) fn(e.target.files[0]); e.target.value = ''; }; };
        bindFile('fi-json', f => this._importJSON(f));
        bindFile('fi-csv', f => this._importCSV(f));
        bindFile('fi-ics', f => this._importICS(f));
        bindFile('fi-ledger', f => this._importLedgerCSV(f));

        // Settings
        const setHist = this._shadow.getElementById('set-history');
        if (setHist) setHist.onchange = async e => {
            this._settings.historyLimit = parseInt(e.target.value) || 5;
            try { const { setSetting } = await import('../core/db.js'); await setSetting('historyLimit', this._settings.historyLimit); } catch (err) { this._log('error', 'Save setting failed:', err); }
        };
        const setRet = this._shadow.getElementById('set-retention');
        if (setRet) setRet.onchange = async e => {
            this._settings.retentionDays = parseInt(e.target.value) || 30;
            try { const { setSetting } = await import('../core/db.js'); await setSetting('retentionDays', this._settings.retentionDays); } catch (err) { this._log('error', 'Save setting failed:', err); }
        };
        const setArch = this._shadow.getElementById('set-archive');
        if (setArch) setArch.onclick = async function() {
            this.classList.toggle('on');
            try { const { setSetting } = await import('../core/db.js'); await setSetting('autoArchive', this.classList.contains('on')); } catch (err) { this._log('error', 'Save setting failed:', err); }
        };

        // Personality selector
        this._shadow.querySelectorAll('.pbtn').forEach(btn => {
            btn.onclick = async () => {
                const { PERSONALITIES, personality } = await import('../core/personality.js');
                const p = btn.dataset.p;
                if (!PERSONALITIES[p]) return;
                this._personality = p;
                personality.set(p);
                this._personalityInstance = personality;
                localStorage.setItem('sovereign-personality', p);
                this.style.setProperty('--personality-accent', personality.get().accent);
                this._shadow.querySelectorAll('.pbtn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const desc = this._shadow.getElementById('personality-desc');
                if (desc) desc.textContent = personality.get().description;
                // Update greeting
                if (this._companion) {
                    this._addChat('bot', personality.greeting());
                }
            };
        });

        // Set initial personality button state
        const activePBtn = this._shadow.querySelector(`.pbtn[data-p="${this._personality}"]`);
        if (activePBtn) {
            activePBtn.classList.add('active');
            const desc = this._shadow.getElementById('personality-desc');
            if (desc) {
                const { PERSONALITIES } = await import('../core/personality.js');
                desc.textContent = PERSONALITIES[this._personality]?.description || '';
            }
        }

        // Delegated: task toggle, edit, delete, habit check, modal close
        this._shadow.addEventListener('click', async e => {
            const chk = e.target.closest('.chk');
            if (chk) {
                const item = this._items.find(i => i.id === chk.dataset.id);
                if (item) { item.data.completed = !item.data.completed; await this._update(item.id, item.data, item.tags, item.priority, item.color, item.isFlagged); }
                return;
            }
            const editBtn = e.target.closest('[data-edit]');
            if (editBtn && !e.target.classList.contains('chk')) { this._openEditModal(editBtn.dataset.edit); return; }
            const del = e.target.closest('[data-del]');
            if (del) { this._delete(del.dataset.del); return; }
            const hcb = e.target.closest('.hcb');
            if (hcb) {
                const today = new Date().toDateString();
                if (!this._habits[hcb.dataset.hid]) this._habits[hcb.dataset.hid] = [];
                const idx = this._habits[hcb.dataset.hid].indexOf(today);
                if (idx >= 0) this._habits[hcb.dataset.hid].splice(idx, 1);
                else this._habits[hcb.dataset.hid].push(today);
                try {
                    const { setSetting } = await import('../core/db.js');
                    const { encryptData } = await import('../core/crypto.js');
                    const { ciphertext, iv } = await encryptData(this._key, JSON.stringify(this._habits));
                    await setSetting('habitCheckins', { ciphertext: Array.from(new Uint8Array(ciphertext)), iv: Array.from(iv) });
                } catch (err) { this._log('error', 'Save habit failed:', err); }
                this._renderHabits();
            }
            const modalCancel = e.target.closest('#edit-modal-cancel');
            if (modalCancel) { this._closeEditModal(); return; }
            const modalOverlay = e.target.closest('#edit-modal-overlay');
            if (modalOverlay && e.target === modalOverlay) { this._closeEditModal(); return; }
            // Chat conversation click
            const chatConv = e.target.closest('[data-chat-conv]');
            if (chatConv) { this._chatOpenConversation(chatConv.dataset.chatConv); return; }
            // Chat conversation delete
            const chatDelConv = e.target.closest('[data-chat-del-conv]');
            if (chatDelConv) {
                try {
                    const { deleteConversation } = await import('../core/chat-db.js');
                    await deleteConversation(chatDelConv.dataset.chatDelConv);
                    this._renderChat();
                } catch (err) { this._log('error', 'Delete conversation failed:', err); }
                return;
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            // Ctrl/Cmd + K = Search (navigate to tasks)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this._nav('tasks');
                setTimeout(() => this._shadow.getElementById('task-in')?.focus(), 100);
            }
            // Ctrl/Cmd + N = New task
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this._nav('tasks');
                setTimeout(() => this._shadow.getElementById('task-in')?.focus(), 100);
            }
            // Ctrl/Cmd + J = Journal
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                this._nav('journal');
            }
            // Ctrl/Cmd + L = Ledger
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this._nav('ledger');
            }
            // Ctrl/Cmd + C = Calendar
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
                e.preventDefault();
                this._nav('calendar');
            }
            // Escape = Close modal
            if (e.key === 'Escape') {
                this._closeEditModal();
            }
        });
    }

    /* ── Render Template ── */
    _render() {
        this._applyTheme(0);
        this._shadow.innerHTML = `
        <style>
        :host{display:block;--bg:#0a0a0a;--s1:rgba(20,20,20,0.6);--s2:rgba(30,30,30,0.8);--t1:#e5e5e5;--t2:#a3a3a3;--primary:#10b981;--primary-h:#0d9f6e;--danger:#ef4444;--warn:#f59e0b;--info:#3b82f6;--purple:#8b5cf6;--bdr:rgba(255,255,255,0.08);--r:1rem;--rl:1.25rem;--shadow-glass:0 8px 32px 0 rgba(0,0,0,0.37);--blur:backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}
        *{margin:0;padding:0;box-sizing:border-box}
        :host{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--t1);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;}
        .card{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--rl);padding:1.5rem;box-shadow:var(--shadow-glass);var(--blur);transition:transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s;will-change:transform;}
        .card:hover{transform:translateY(-2px);box-shadow:0 12px 40px 0 rgba(0,0,0,0.45);}
        button{cursor:pointer;transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1);}
        button:active{transform:scale(0.96);}
        input,textarea,select{transition:border-color 0.2s, box-shadow 0.2s;}
        input:focus,textarea:focus,select:focus{box-shadow:0 0 0 3px rgba(16,185,129,0.2);outline:none;}
        #auth-screen{position:fixed;inset:0;background:linear-gradient(135deg,#0a0a0a,#111827);display:flex;align-items:center;justify-content:center;z-index:10000}
        .abox{background:var(--s1);border:1px solid var(--bdr);border-radius:1.5rem;padding:2rem;width:400px;max-width:90%;text-align:center}
        .auth-icon{margin-bottom:0.5rem}
        .alogo{font-size:1.5rem;font-weight:800;letter-spacing:-0.02em;margin-top:0.75rem}
        .adot{width:16px;height:16px;border-radius:50%;background:var(--primary);box-shadow:0 0 10px var(--primary)}
        .asub{color:var(--t2);font-size:0.75rem;margin-top:0.25rem}
        .aversion{color:var(--t2);opacity:0.4;font-size:0.6rem;font-family:monospace;margin-top:0.25rem;letter-spacing:0.05em}
        .ainp{background:rgba(0,0,0,0.4);border:1px solid #333;padding:0.75rem;border-radius:var(--r);font-size:0.85rem;width:100%;color:var(--t1);margin-bottom:0.5rem;text-align:center}
        .ainp:focus{outline:none;border-color:var(--primary)}
        .abtn{background:var(--primary);color:#000;border:none;padding:0.75rem;border-radius:var(--r);font-size:0.85rem;font-weight:600;cursor:pointer;width:100%;margin-top:0.5rem}
        .abtn:hover{background:var(--primary-h)}
        .aerr{color:var(--danger);font-size:0.7rem;margin-top:0.5rem;min-height:1rem}
        .ahint{font-size:0.6rem;opacity:0.4;margin-top:0.75rem;line-height:1.5}
        .mode-tabs{display:flex;gap:0.25rem;margin-bottom:1rem;background:rgba(0,0,0,0.2);border-radius:var(--r);padding:0.25rem}
        .mode-tab{flex:1;padding:0.5rem;border-radius:calc(var(--r) - 0.125rem);font-size:0.8rem;font-weight:500;cursor:pointer;border:none;background:none;color:var(--t2);transition:all 0.15s}
        .mode-tab:hover{color:var(--t1)}
        .mode-tab.active{background:var(--primary);color:#000}
        #app{display:none;height:100vh}
        #app.on{display:flex}
        .side{width:200px;background:var(--s1);border-right:1px solid var(--bdr);display:flex;flex-direction:column;flex-shrink:0}
        .sh{padding:0.75rem 1rem;border-bottom:1px solid var(--bdr)}
        .slogo{font-size:0.85rem;font-weight:800;display:flex;align-items:center;gap:0.3rem}
        .svl{font-size:0.6rem;color:var(--t2);margin-top:0.125rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sn{flex:1;padding:0.375rem;overflow-y:auto}
        .tab-btn{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.625rem;border-radius:var(--r);cursor:pointer;font-size:0.8rem;font-weight:500;color:var(--t2);border:none;background:none;width:100%;text-align:left}
        .tab-btn:hover{background:rgba(255,255,255,0.05);color:var(--t1)}
        .tab-btn.active{background:rgba(16,185,129,0.1);color:var(--primary)}
        .ti{width:16px;text-align:center}
        .nsec{font-size:0.55rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--t2);opacity:0.5;padding:0.75rem 0.625rem 0.25rem}
        .sf{padding:0.5rem 0.75rem;border-top:1px solid var(--bdr);display:flex;flex-direction:column;gap:0.25rem}
        .sfb{display:flex;align-items:center;gap:0.375rem;padding:0.375rem 0.5rem;border-radius:var(--r);cursor:pointer;font-size:0.7rem;color:var(--t2);border:none;background:none;width:100%;text-align:left}
        .sfb:hover{background:rgba(255,255,255,0.05)}
        .sfb.dng{color:var(--danger)}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .top{height:44px;background:var(--s1);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;padding:0 1rem;flex-shrink:0}
        .tt{font-size:0.85rem;font-weight:600}
        .ta{display:flex;align-items:center;gap:0.375rem}
        .tb{background:none;border:1px solid var(--bdr);color:var(--t2);padding:0.25rem 0.5rem;border-radius:var(--r);cursor:pointer;font-size:0.7rem}
        .tb:hover{background:rgba(255,255,255,0.05);color:var(--t1)}
        .content{flex:1;overflow-y:auto;padding:1rem}
        .mod{display:none}
        .mod.active{display:block}
        .card{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--rl);padding:1rem;margin-bottom:0.75rem}
        .sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.5rem;margin-bottom:1rem}
        .sc{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--r);padding:0.75rem}
        .sl{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--t2);margin-bottom:0.125rem}
        .sv{font-size:1.25rem;font-weight:700}
        .ss{font-size:0.65rem;color:var(--t2);margin-top:0.125rem}
        .pos{color:var(--primary)}.neg{color:var(--danger)}
        .fg{margin-bottom:0.5rem}
        .fl{display:block;font-size:0.7rem;font-weight:500;margin-bottom:0.125rem;color:var(--t2);text-align:left}
        .fi,.fs,.ft{background:rgba(0,0,0,0.3);border:1px solid var(--bdr);padding:0.5rem 0.625rem;border-radius:var(--r);font-size:0.8rem;color:var(--t1);width:100%}
        .fi:focus,.fs:focus,.ft:focus{outline:none;border-color:var(--primary)}
        .ft{resize:vertical;min-height:60px;font-family:inherit}
        .fr{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem}
        .btn{padding:0.375rem 0.75rem;border-radius:var(--r);font-size:0.75rem;font-weight:500;cursor:pointer;border:1px solid var(--bdr);background:var(--s2);color:var(--t1);display:inline-flex;align-items:center;gap:0.25rem}
        .btn:hover{background:rgba(255,255,255,0.08)}
        .bp{background:var(--primary);color:#000;border-color:var(--primary)}
        .bp:hover{background:var(--primary-h)}
        .bs{padding:0.25rem 0.5rem;font-size:0.65rem}
        .tg{display:inline-block;padding:0.0625rem 0.375rem;border-radius:999px;font-size:0.6rem;background:rgba(255,255,255,0.08);color:var(--t2);margin-right:0.125rem}
        .pb{display:inline-block;padding:0.0625rem 0.25rem;border-radius:999px;font-size:0.55rem;font-weight:600}
        .p-low{background:rgba(59,130,246,0.2);color:#60a5fa}
        .p-medium{background:rgba(245,158,11,0.2);color:#fbbf24}
        .p-high{background:rgba(249,115,22,0.2);color:#fb923c}
        .p-critical{background:rgba(239,68,68,0.2);color:#f87171}
        .il{display:flex;flex-direction:column;gap:0.375rem}
        .ic{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--r);padding:0.625rem 0.75rem;display:flex;align-items:flex-start;gap:0.5rem}
        .ic:hover{border-color:rgba(255,255,255,0.15)}
        .ic.flagged{border-left:3px solid var(--warn)}
        .chk{width:16px;height:16px;border-radius:50%;border:2px solid var(--bdr);cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;background:none;color:transparent;font-size:0.55rem}
        .chk.on{background:var(--primary);border-color:var(--primary);color:#000}
        .ib{flex:1;min-width:0}
        .it{font-size:0.8rem;font-weight:500;margin-bottom:0.125rem;cursor:pointer}
        .it:hover{color:var(--primary)}
        .it.done{text-decoration:line-through;opacity:0.5}
        .im{font-size:0.65rem;color:var(--t2);display:flex;align-items:center;gap:0.375rem;flex-wrap:wrap}
        .ab{background:none;border:none;color:var(--t2);cursor:pointer;padding:0.125rem;font-size:0.7rem;border-radius:0.25rem}
        .ab:hover{background:rgba(255,255,255,0.08);color:var(--t1)}
        .ab.del:hover{color:var(--danger)}
        .empty{text-align:center;padding:2rem 1rem;color:var(--t2)}
        .ei{font-size:2rem;margin-bottom:0.5rem;opacity:0.3}
        .lt{width:100%;border-collapse:collapse;font-size:0.75rem}
        .lt th{text-align:left;padding:0.5rem;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--t2);border-bottom:1px solid var(--bdr);font-weight:600}
        .lt td{padding:0.5rem;border-bottom:1px solid var(--bdr);vertical-align:middle}
        .lt tr:hover td{background:rgba(255,255,255,0.02)}
        .amtc{color:var(--primary);font-weight:600}
        .amtd{color:var(--danger);font-weight:600}
        .chd{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem}
        .cn{display:flex;align-items:center;gap:0.375rem}
        .ctitle{font-size:0.85rem;font-weight:600}
        .cv{display:flex;gap:0.125rem}
        .cv-btn{padding:0.25rem 0.5rem;border-radius:var(--r);font-size:0.65rem;cursor:pointer;border:1px solid var(--bdr);background:none;color:var(--t2)}
        .cv-btn.active{background:var(--primary);color:#000;border-color:var(--primary)}
        .cf{padding:0.25rem 0.5rem;border-radius:var(--r);font-size:0.65rem;cursor:pointer;border:1px solid var(--bdr);background:none;color:var(--t2);margin-left:0.5rem}
        .cg{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--bdr);border-radius:var(--r);overflow:hidden}
        .ch{background:var(--s2);padding:0.375rem;text-align:center;font-size:0.6rem;font-weight:600;text-transform:uppercase;color:var(--t2)}
        .cd{background:var(--s1);padding:0.25rem;min-height:70px;cursor:pointer}
        .cd:hover{background:rgba(255,255,255,0.03)}
        .cd.om{opacity:0.3}
        .cd.td{background:rgba(16,185,129,0.08)}
        .cdn{font-size:0.7rem;font-weight:500;margin-bottom:0.125rem}
        .cd.td .cdn{color:var(--primary);font-weight:700}
        .ci{font-size:0.55rem;padding:0.0625rem 0.125rem;border-radius:0.125rem;margin-bottom:0.125rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ci.task{background:rgba(16,185,129,0.2);color:#34d399}
        .ci.note{background:rgba(59,130,246,0.2);color:#60a5fa}
        .ci.habit{background:rgba(245,158,11,0.2);color:#fbbf24}
        .ci.ledger{background:rgba(139,92,246,0.2);color:#a78bfa}
        .cm{font-size:0.55rem;color:var(--t2);padding-left:0.125rem}
        .dh{display:flex;gap:0.5rem;padding:0.375rem 0;border-bottom:1px solid var(--bdr);min-height:40px}
        .dhl{width:45px;font-size:0.65rem;color:var(--t2);flex-shrink:0;text-align:right;padding-right:0.375rem}
        .dhc{flex:1}
        .cb{display:flex;align-items:end;gap:0.375rem;height:100px;padding:0 0.375rem}
        .cbi{flex:1;display:flex;flex-direction:column;align-items:center}
        .cbf{width:100%;border-radius:0.25rem 0.25rem 0 0;min-height:3px}
        .cbv{font-size:0.6rem;font-weight:600;margin-bottom:0.125rem}
        .cbl{font-size:0.55rem;color:var(--t2);margin-top:0.25rem;text-align:center}
        .prb{height:5px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;margin-top:0.25rem}
        .prf{height:100%;border-radius:999px}
        .hg{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0.5rem}
        .hc{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--rl);padding:0.75rem}
        .hc.flagged{border-left:3px solid var(--warn)}
        .hh{display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem}
        .ht{font-size:0.8rem;font-weight:600}
        .hs{font-size:0.7rem;color:var(--warn)}
        .hcb{width:32px;height:32px;border-radius:50%;border:2px solid var(--bdr);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;color:transparent}
        .hcb.on{background:var(--primary);border-color:var(--primary);color:#000}
        .cc{display:flex;flex-direction:column;height:calc(100vh - 160px)}
        .cms{flex:1;overflow-y:auto;padding:0.5rem}
        .cm{margin-bottom:0.5rem}
        .cb2{color:var(--primary);font-size:0.65rem;font-weight:600}
        .cu{color:var(--t2);font-size:0.65rem;font-weight:600}
        .ct{font-size:0.75rem;margin-top:0.125rem;line-height:1.4}
        .cir{display:flex;gap:0.375rem;padding:0.5rem;border-top:1px solid var(--bdr)}
        .ci2{flex:1;background:rgba(0,0,0,0.3);border:1px solid var(--bdr);padding:0.375rem 0.5rem;border-radius:var(--r);font-size:0.75rem;color:var(--t1)}
        .ci2:focus{outline:none;border-color:var(--primary)}
        .sr{display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--bdr)}
        .srl{font-size:0.8rem}
        .srd{font-size:0.65rem;color:var(--t2);margin-top:0.125rem}
        .tog{width:36px;height:20px;border-radius:999px;background:rgba(255,255,255,0.15);cursor:pointer;position:relative;border:none}
        .tog.on{background:var(--primary)}
        .tog::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform 0.2s}
        .tog.on::after{transform:translateX(16px)}
        .pbtn{padding:0.5rem 0.75rem;border-radius:var(--r);font-size:0.75rem;cursor:pointer;border:1px solid var(--bdr);background:var(--s2);color:var(--t2);transition:all 0.2s}
        .pbtn:hover{background:rgba(255,255,255,0.08);color:var(--t1)}
        .pbtn.active{border-color:var(--personality-accent,var(--primary));color:var(--personality-accent,var(--primary));background:rgba(16,185,129,0.1)}
        .prompt{display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:var(--r);padding:0.5rem 0.75rem;margin-bottom:0.5rem;font-size:0.75rem;color:var(--t1)}
        .prompt.nudge{background:rgba(59,130,246,0.08);border-color:rgba(59,130,246,0.2)}
        .prompt.reminder{background:rgba(245,158,11,0.08);border-color:rgba(245,158,11,0.2)}
        .prompt-dismiss{background:none;border:none;color:var(--t2);cursor:pointer;padding:0.125rem;font-size:0.7rem}
        .prompt-dismiss:hover{color:var(--danger)}
        .mood-btns{display:flex;gap:0.375rem;margin-top:0.5rem;flex-wrap:wrap}
        .mood-btn{padding:0.375rem 0.625rem;border-radius:var(--r);font-size:0.75rem;cursor:pointer;border:1px solid var(--bdr);background:var(--s2);color:var(--t1);transition:all 0.15s}
        .mood-btn:hover{background:rgba(255,255,255,0.08);border-color:var(--primary)}
        .mood-btn.active{border-color:var(--primary);background:rgba(16,185,129,0.15);color:var(--primary)}
        .mood-legend{font-size:0.6rem;color:var(--t2);margin-top:0.375rem;line-height:1.6}
        .help-modal{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9999}
        .help-modal.show{display:flex}
        .help-content{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--rl);padding:1.5rem;width:560px;max-width:90%;max-height:80vh;overflow-y:auto}
        .help-content h3{font-size:0.9rem;margin:1rem 0 0.5rem;color:var(--primary)}
        .help-content p{font-size:0.8rem;color:var(--t2);margin-bottom:0.5rem;line-height:1.5}
        .help-content ul{margin-left:1.25rem;margin-bottom:0.5rem}
        .help-content li{font-size:0.75rem;color:var(--t2);margin-bottom:0.25rem}
        .voice-btn{background:none;border:1px solid var(--bdr);color:var(--t2);padding:0.25rem 0.5rem;border-radius:var(--r);cursor:pointer;font-size:0.7rem}
        .voice-btn:hover{background:rgba(255,255,255,0.08);color:var(--t1)}
        .voice-btn.recording{border-color:var(--danger);color:var(--danger);animation:pulse 1.5s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .read-btn{background:none;border:1px solid var(--bdr);color:var(--t2);padding:0.25rem 0.5rem;border-radius:var(--r);cursor:pointer;font-size:0.7rem}
        .read-btn:hover{background:rgba(255,255,255,0.08);color:var(--t1)}
        .mnav{display:none}
        @media (max-width:768px) {.side{display:none}.mnav{display:flex!important;position:fixed;bottom:0;left:0;right:0;background:var(--s1);border-top:1px solid var(--bdr);padding:0.375rem;gap:0.125rem;overflow-x:auto;z-index:100;padding-bottom:calc(0.375rem + env(safe-area-inset-bottom))}.mtb{flex-shrink:0;padding:0.375rem 0.5rem;border-radius:var(--r);font-size:0.6rem;color:var(--t2);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:0.125rem;background:none;border:none}.mtb.active{color:var(--primary);background:rgba(16,185,129,0.1)}.mti{font-size:1rem}.content{padding-bottom:70px}.fr{grid-template-columns:1fr}.sg{grid-template-columns:repeat(2,1fr)}}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:999px}

        /* Edit Modal */
        .emo{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9999}
        .emo.show{display:flex}
        .em{background:var(--s1);border:1px solid var(--bdr);border-radius:var(--rl);padding:1.5rem;width:480px;max-width:90%;max-height:80vh;overflow-y:auto}
        .emt{font-size:1rem;font-weight:600;margin-bottom:1rem}
        .emg{margin-bottom:0.75rem}
        .eml{display:block;font-size:0.7rem;font-weight:500;margin-bottom:0.25rem;color:var(--t2)}
        .emr{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem}
        .ema{display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem}
        </style>

        <!-- Auth -->
        <div id="auth-screen">
            <div class="abox">
                <div class="auth-icon"><div class="adot" style="width:32px;height:32px;border-radius:50%;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center"><div class="adot" style="width:16px;height:16px"></div></div></div>
                <div class="alogo" style="font-size:1.5rem;margin-top:0.75rem">Vault Tracker</div>
                <div class="asub">Zero-Trust Encrypted Workspace</div>
                <div class="aversion">v2.0 Sovereign Edition</div>
                <div id="auth-mode" data-mode="unlock">
                    <!-- Mode Tabs -->
                    <div class="mode-tabs">
                        <button class="mode-tab active" data-mode="unlock" onclick="this.getRootNode().host._setAuthMode('unlock')">Unlock</button>
                        <button class="mode-tab" data-mode="create" onclick="this.getRootNode().host._setAuthMode('create')">Create</button>
                        <button class="mode-tab" data-mode="delete" onclick="this.getRootNode().host._setAuthMode('delete')">Delete</button>
                    </div>
                    <!-- Vault Selector (unlock/delete) -->
                    <div id="vault-select-group">
                        <label class="fl">Select Vault</label>
                        <select id="vault-select" class="fi" style="font-size:0.8rem;margin-bottom:0.5rem"></select>
                    </div>
                    <!-- Vault Name (create) -->
                    <div id="vault-name-group" style="display:none">
                        <label class="fl">Vault Name</label>
                        <input type="text" id="vault-name-input" class="fi" style="font-size:0.8rem;margin-bottom:0.5rem" placeholder="e.g. Personal">
                    </div>
                    <!-- Password -->
                    <label class="fl" id="auth-pw-label">Master Password</label>
                    <input type="password" id="auth-pw" class="ainp" placeholder="Enter your master password" autofocus>
                    <!-- Biometrics (future) -->
                    <div class="bio-row" id="bio-row" style="display:none">
                        <input type="checkbox" id="enable-bio"> <label for="enable-bio" style="font-size:0.75rem;color:var(--t2)">Enable biometric login (future)</label>
                    </div>
                    <!-- Submit -->
                    <button id="auth-submit" class="abtn">Unlock Vault</button>
                </div>
                <div id="vault-dna" style="margin-top:0.75rem"></div>
                <div id="auth-err" class="aerr"></div>
                <div class="ahint">Encryption happens locally. No data leaves your device.<br>No password recovery possible.</div>
            </div>
        </div>

        <!-- App -->
        <div id="app">
            <aside class="side">
                <div class="sh"><div class="slogo"><div class="adot" style="width:6px;height:6px"></div> SOVEREIGN</div><div class="svl" id="vault-label">Vault</div></div>
                <nav class="sn">
                    <button class="tab-btn" data-tab="tasks"><span class="ti">✓</span>Tasks</button>
                    <button class="tab-btn" data-tab="notes"><span class="ti">📝</span>Notes</button>
                    <button class="tab-btn" data-tab="habits"><span class="ti">🔄</span>Habits</button>
                    <button class="tab-btn" data-tab="ledger"><span class="ti">💰</span>Ledger</button>
                    <button class="tab-btn" data-tab="journal"><span class="ti">📔</span>Journal</button>
                    <div class="nsec">Views</div>
                    <button class="tab-btn" data-tab="calendar"><span class="ti">📅</span>Calendar</button>
                    <button class="tab-btn" data-tab="analytics"><span class="ti">📊</span>Analytics</button>
                    <div class="nsec">System</div>
                    <button class="tab-btn" data-tab="chat"><span class="ti">💬</span>Chat</button>
                    <button class="tab-btn" data-tab="companion"><span class="ti">🤖</span>Companion</button>
                    <button class="tab-btn" data-tab="settings"><span class="ti">⚙️</span>Settings</button>
                </nav>
                <div class="sf">
                    <button class="sfb" id="exp-json" title="Export all vault data as JSON">📤 Export JSON</button>
                    <button class="sfb" id="imp-json" title="Import vault data from JSON file">📥 Import JSON</button>
                    <button class="sfb" id="imp-csv" title="Import vault data from CSV file">📥 Import CSV</button>
                    <button class="sfb" id="imp-ics" title="Import calendar events from ICS file">📥 Import ICS</button>
                    <button class="sfb" id="exp-ledger" title="Export ledger transactions as CSV">📤 Ledger CSV</button>
                    <button class="sfb" id="imp-ledger" title="Import ledger transactions from CSV">📥 Ledger CSV</button>
                    <button class="sfb dng" id="lock-btn" title="Lock vault — requires password to unlock">🔒 Lock</button>
                    <button class="sfb dng" id="delete-vault-btn" title="Permanently delete a vault and all its data">🗑️ Delete Vault</button>
                </div>
            </aside>
            <div class="main">
                <header class="top"><div class="tt" id="title">Tasks</div><div class="ta"><button class="tb" id="help-btn" title="Help & Documentation">❓</button><button class="tb" id="theme-btn" title="Cycle through 5 themes">🎨</button></div></header>
                <div class="content">
                    <!-- Tasks -->
                    <div class="mod active" data-mod="tasks">
                        <div class="card">
                            <div class="fg"><input type="text" id="task-in" class="fi" placeholder="New task..."></div>
                            <div class="fr"><div class="fg"><label class="fl">Due</label><input type="datetime-local" id="task-due" class="fi"></div><div class="fg"><label class="fl">Priority</label><select id="task-pri" class="fs"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div></div>
                            <div class="fg"><input type="text" id="task-tags" class="fi" placeholder="Tags (comma sep)"></div>
                            <button class="btn bp" id="add-task" title="Add a new task">+ Add Task</button>
                        </div>
                        <div class="sg" id="task-stats"></div>
                        <div class="il" id="task-list"></div>
                    </div>
                    <!-- Notes -->
                    <div class="mod" data-mod="notes">
                        <div class="card">
                            <div class="fg"><input type="text" id="note-title" class="fi" placeholder="Note title..."></div>
                            <div class="fg"><textarea id="note-body" class="ft" rows="5" placeholder="Write..."></textarea></div>
                            <div class="fg"><input type="text" id="note-tags" class="fi" placeholder="Tags (comma sep)"></div>
                            <button class="btn bp" id="add-note" title="Save a new note">+ Save Note</button>
                        </div>
                        <div class="il" id="note-list"></div>
                    </div>
                    <!-- Habits -->
                    <div class="mod" data-mod="habits">
                        <div class="card">
                            <div class="fg"><input type="text" id="habit-in" class="fi" placeholder="New habit..."></div>
                            <div class="fg"><select id="habit-pri" class="fs"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
                            <button class="btn bp" id="add-habit" title="Track a new habit">+ Add Habit</button>
                        </div>
                        <div id="habit-list"></div>
                    </div>
                    <!-- Ledger -->
                    <div class="mod" data-mod="ledger">
                        <div class="sg" id="ledger-stats"></div>
                        <div class="card">
                            <div class="fg"><input type="text" id="ledger-desc" class="fi" placeholder="Description..."></div>
                            <div class="fr"><div class="fg"><label class="fl">Amount</label><input type="number" id="ledger-amt" class="fi" placeholder="0.00" step="0.01"></div><div class="fg"><label class="fl">Type</label><select id="ledger-type" class="fs"><option value="credit">Credit (Income)</option><option value="debit">Debit (Expense)</option></select></div></div>
                            <div class="fr"><div class="fg"><label class="fl">Category</label><select id="ledger-cat" class="fs"><option value="general">General</option><option value="food">Food</option><option value="transport">Transport</option><option value="housing">Housing</option><option value="utilities">Utilities</option><option value="health">Health</option><option value="entertainment">Entertainment</option><option value="shopping">Shopping</option><option value="education">Education</option><option value="salary">Salary</option><option value="investment">Investment</option></select></div><div class="fg"><label class="fl">Classification</label><select id="ledger-cls" class="fs"><option value="need">Need</option><option value="want">Want</option></select></div></div>
                            <div class="fg"><input type="text" id="ledger-notes" class="fi" placeholder="Notes..."></div>
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap"><button class="btn bp" id="add-ledger" title="Add a new transaction">+ Add</button><button class="btn bs" id="exp-ledger" title="Export ledger as CSV">📤 Export CSV</button><button class="btn bs" id="imp-ledger" title="Import ledger from CSV">📥 Import CSV</button></div>
                        </div>
                     <div style="overflow-x:auto"><table class="lt"><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th><th></th></tr></thead><tbody id="ledger-tbody"></tbody></table></div>
                     </div>
                     <!-- Journal -->
                     <div class="mod" data-mod="journal">
                         <div class="card">
                             <div style="font-size:0.75rem;color:var(--t2);margin-bottom:0.5rem" id="journal-prompt">"How are you feeling today?"</div>
                              <div class="fg"><input type="text" id="journal-title" class="fi" placeholder="Entry title (optional)..."></div>
                              <div class="fg"><textarea id="journal-body" class="ft" rows="6" placeholder="Write freely... This is your private space."></textarea></div>
                              <div class="fg">
                                  <label class="fl">How are you feeling?</label>
                                  <div class="mood-btns" id="journal-mood-selector">
                                      <button class="mood-btn" data-mood="good" title="Feeling positive and happy">😊 Good</button>
                                      <button class="mood-btn" data-mood="okay" title="Neutral, neither great nor bad">😐 Okay</button>
                                      <button class="mood-btn" data-mood="sad" title="Feeling down or low">😔 Sad</button>
                                      <button class="mood-btn" data-mood="stressed" title="Overwhelmed or anxious">😤 Stressed</button>
                                      <button class="mood-btn" data-mood="grateful" title="Thankful for something">🙏 Grateful</button>
                                      <button class="mood-btn" data-mood="hopeful" title="Optimistic about the future">🌟 Hopeful</button>
                                      <button class="mood-btn" data-mood="peaceful" title="Calm and at ease">🧘 Peaceful</button>
                                  </div>
                                  <div class="mood-legend">💡 Tap a mood to tag this entry. You can change it anytime. Moods help track your emotional patterns over time.</div>
                              </div>
                              <div class="fg"><input type="text" id="journal-tags" class="fi" placeholder="Tags (comma sep)"></div>
                              <div style="display:flex;gap:0.375rem;flex-wrap:wrap">
                                  <button class="btn bp" id="add-journal" title="Save this journal entry">+ Save Entry</button>
                                  <button class="voice-btn" id="journal-voice" title="Speak to journal — voice input">🎤 Speak</button>
                                  <button class="read-btn" id="journal-read" title="Read last entry aloud">🔊 Read</button>
                                  <button class="btn bs" id="exp-journal-md" title="Export journal as Markdown">📤 MD</button>
                                  <button class="btn bs" id="exp-journal-txt" title="Export journal as plain text">📤 TXT</button>
                                  <button class="btn bs" id="exp-journal-json" title="Export journal as JSON backup">📤 JSON</button>
                                  <button class="btn bs" id="imp-journal" title="Import journal entries from JSON">📥 Import</button>
                              </div>
                         </div>
                         <div class="sg" id="journal-stats"></div>
                         <div class="il" id="journal-list"></div>
                     </div>
                     <!-- Calendar -->
                    <div class="mod" data-mod="calendar">
                        <div class="chd"><div class="cn"><button class="btn bs" id="cal-prev" title="Previous">◀</button><button class="btn bs" id="cal-today" title="Go to today">Today</button><button class="btn bs" id="cal-next" title="Next">▶</button><span class="ctitle" id="cal-title"></span></div><div style="display:flex;align-items:center"><div class="cv"><button class="cv-btn active" data-cv="month" title="Month view">Month</button><button class="cv-btn" data-cv="week" title="Week view">Week</button><button class="cv-btn" data-cv="workweek" title="Work week (Mon-Fri)">Work Week</button><button class="cv-btn" data-cv="day" title="Day timeline">Day</button><button class="cv-btn" data-cv="schedule" title="Chronological list">Schedule</button></div><select id="cal-filter" class="cf" title="Filter by type"><option value="all">All</option><option value="task">Tasks</option><option value="note">Notes</option><option value="habit">Habits</option><option value="ledger">Ledger</option><option value="journal">Journal</option></select></div></div>
                        <div id="cal-view"></div>
                    </div>
                    <!-- Analytics -->
                    <div class="mod" data-mod="analytics">
                        <div class="sg" id="analytics-stats"></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Priority</div><div class="cb" id="chart-priority"></div></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Needs vs Wants</div><div id="chart-behavioral"></div></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Insights</div><div id="insights"></div></div>
                     </div>
                     <!-- Peer Chat -->
                     <div class="mod" data-mod="chat">
                         <div class="card">
                             <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                                 <div style="font-size:0.8rem;font-weight:600">💬 Peer Chat</div>
                                 <div style="display:flex;gap:0.375rem">
                                     <button class="btn bs" id="chat-new-contact">+ Contact</button>
                                     <button class="btn bs" id="chat-new-conv">+ Chat</button>
                                 </div>
                             </div>
                             <div class="il" id="chat-conversations"></div>
                         </div>
                         <div class="card" id="chat-message-view" style="display:none">
                             <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                                 <div style="font-size:0.8rem;font-weight:600" id="chat-conv-title"></div>
                                 <button class="btn bs" id="chat-back">← Back</button>
                             </div>
                             <div class="cms" id="chat-msg-list" style="max-height:300px;overflow-y:auto"></div>
                             <div class="cir">
                                 <input type="text" id="chat-msg-input" class="ci2" placeholder="Type a message...">
                                 <button class="btn bp bs" id="chat-msg-send">Send</button>
                                 <button class="btn bs" id="chat-msg-attach" title="Attach file">📎</button>
                             </div>
                         </div>
                     </div>
                     <!-- Companion -->
                    <div class="mod" data-mod="companion">
                        <div class="card cc">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem"><div style="font-size:0.8rem;font-weight:600;color:var(--primary)">🤖 Companion</div><div style="font-size:0.6rem;color:var(--t2)">● Online</div></div>
                            <div class="cms" id="chat-msgs"><div class="cm"><div class="cb2">[Companion]</div><div class="ct">I live 100% locally. Try: "Task buy groceries", "Expense 20 for lunch", "Security audit". Separate multiple commands with semicolons.</div></div></div>
                            <div class="cir"><input type="text" id="chat-in" class="ci2" placeholder="Type a command..."><button class="btn bp bs" id="chat-send" title="Send command to companion">Send</button></div>
                        </div>
                    </div>
                    <!-- Settings -->
                    <div class="mod" data-mod="settings">
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">🎭 Companion Personality</div>
                            <div style="display:flex;gap:0.5rem;flex-wrap:wrap" id="personality-selector">
                                <button class="pbtn" data-p="zen" title="Calm, minimal, focused">🧘 Zen</button>
                                <button class="pbtn active" data-p="focus" title="Sharp, direct, efficient">🎯 Focus</button>
                                <button class="pbtn" data-p="playful" title="Warm, fun, encouraging">🎉 Playful</button>
                                <button class="pbtn" data-p="professional" title="Clean, formal, precise">💼 Professional</button>
                                <button class="pbtn" data-p="energy" title="Bold, energetic, motivating">⚡ Energy</button>
                            </div>
                            <div style="font-size:0.65rem;color:var(--t2);margin-top:0.5rem" id="personality-desc">Sharp, direct, efficient. Blue tones. Zero fluff.</div>
                        </div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Data Retention</div>
                            <div class="sr"><div><div class="srl">History Limit</div><div class="srd">How many previous versions of each item to keep. Higher = more backup, more storage. Default: 5.</div></div><input type="number" id="set-history" class="fi" style="width:70px" value="5" min="1" max="50"></div>
                            <div class="sr"><div><div class="srl">Retention Days</div><div class="srd">How many days to keep old history entries. After this, old versions are purged. Default: 30 days.</div></div><input type="number" id="set-retention" class="fi" style="width:70px" value="30" min="1" max="365"></div>
                            <div class="sr"><div><div class="srl">Auto-Archive Completed</div><div class="srd">Automatically move completed tasks to archive after 30 days. They stay encrypted and restorable.</div></div><button class="tog" id="set-archive" title="Toggle auto-archive for completed tasks"></button></div>
                        </div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Export / Import</div>
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap"><button class="btn bs" id="exp-json2" title="Export all vault data as JSON">📤 JSON</button><button class="btn bs" id="exp-csv2" title="Export all vault data as CSV">📤 CSV</button><button class="btn bs" id="exp-txt2" title="Export all vault data as plain text">📤 TXT</button><button class="btn bs" id="imp-json2" title="Import vault data from JSON">📥 JSON</button><button class="btn bs" id="imp-csv2" title="Import vault data from CSV">📥 CSV</button><button class="btn bs" id="imp-ics2" title="Import calendar events from ICS">📥 ICS</button></div>
                        </div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Security</div>
                            <div class="sr"><div><div class="srl">Vault Items</div><div class="srd" id="item-count">0 vessels</div></div></div>
                            <div class="sr"><div><div class="srl">Encryption</div><div class="srd">AES-256-GCM / PBKDF2 600K</div></div><span style="color:var(--primary);font-size:0.7rem">● Active</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <nav class="mnav">
                <button class="mtb tab-btn" data-tab="tasks"><span class="mti">✓</span>Tasks</button>
                <button class="mtb tab-btn" data-tab="notes"><span class="mti">📝</span>Notes</button>
                <button class="mtb tab-btn" data-tab="habits"><span class="mti">🔄</span>Habits</button>
                <button class="mtb tab-btn" data-tab="ledger"><span class="mti">💰</span>Ledger</button>
                <button class="mtb tab-btn" data-tab="journal"><span class="mti">📔</span>Journal</button>
                <button class="mtb tab-btn" data-tab="calendar"><span class="mti">📅</span>Cal</button>
                <button class="mtb tab-btn" data-tab="analytics"><span class="mti">📊</span>Stats</button>
                <button class="mtb tab-btn" data-tab="companion"><span class="mti">🤖</span>Chat</button>
                <button class="mtb tab-btn" data-tab="chat"><span class="mti">💬</span>Chat</button>
                <button class="mtb tab-btn" data-tab="settings"><span class="mti">⚙️</span>Set</button>
            </nav>
        </div>

        <!-- Edit Modal -->
        <div class="emo" id="edit-modal-overlay">
            <div class="em">
                <div class="emt" id="edit-modal-title">Edit</div>
                <div id="edit-modal-body"></div>
                <div class="ema"><button class="btn" id="edit-modal-cancel">Cancel</button><button class="btn bp" id="edit-modal-save">Save</button></div>
            </div>
        </div>

        <input type="file" id="fi-json" accept=".json" style="display:none">
        <input type="file" id="fi-csv" accept=".csv" style="display:none">
        <input type="file" id="fi-ics" accept=".ics" style="display:none">
        <input type="file" id="fi-ledger" accept=".csv" style="display:none">
        <input type="file" id="fi-journal" accept=".json" style="display:none">

        <!-- Help Modal -->
        <div class="help-modal" id="help-modal">
            <div class="help-content">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
                    <div style="font-size:1rem;font-weight:600">📖 Sovereign Vault Help</div>
                    <button class="ab del" id="help-close" title="Close help">✕</button>
                </div>
                <h3>🔐 Vault</h3>
                <p>Your vault is encrypted with AES-256-GCM. Your password never leaves your device. No one — not even us — can read your data.</p>
                <ul><li><strong>Create Vault:</strong> Click "Create new vault" on the login screen</li><li><strong>Lock:</strong> Click 🔒 Lock in the sidebar — your key is wiped from memory</li><li><strong>Delete:</strong> Permanently removes a vault and all its encrypted data</li></ul>
                <h3>📋 Tasks</h3>
                <p>Track what needs to be done. Click ✎ to edit any field. Click ✓ to complete.</p>
                <h3>📝 Notes</h3>
                <p>Capture ideas, information, or thoughts. Fully encrypted and searchable.</p>
                <h3>🔄 Habits</h3>
                <p>Build consistency. Click ✓ daily to track streaks. The app tracks how many days in a row.</p>
                <h3>💰 Ledger</h3>
                <p>Track income and expenses. <strong>Credit</strong> = money in. <strong>Debit</strong> = money out. Running balance shows your net worth.</p>
                <h3>📔 Journal</h3>
                <p>Your private space for unstructured thoughts. Select a mood to track emotional patterns. Use 🎤 Speak for voice input. Use 🔊 Read to hear your last entry aloud.</p>
                <h3>📅 Calendar</h3>
                <p>See all your data on a timeline. Filter by type. All dates use UTC internally — no timezone bugs.</p>
                <h3>📊 Analytics</h3>
                <p>Monthly reflections, priority charts, spending patterns, and ecosystem insights.</p>
                <h3>💬 Peer Chat</h3>
                <p>End-to-end encrypted messaging. Completely isolated from your vault data. Add contacts, start conversations, share files.</p>
                <h3>⌨️ Keyboard Shortcuts</h3>
                <ul><li><strong>Ctrl+K</strong> — Search / Go to Tasks</li><li><strong>Ctrl+N</strong> — New Task</li><li><strong>Ctrl+J</strong> — Journal</li><li><strong>Ctrl+L</strong> — Ledger</li><li><strong>Ctrl+C</strong> — Calendar</li><li><strong>Escape</strong> — Close modal</li></ul>
                <h3>🎭 Personalities</h3>
                <p>Choose how the app speaks to you: Zen 🧘 (calm), Focus 🎯 (direct), Playful 🎉 (fun), Professional 💼 (formal), Energy ⚡ (motivating).</p>
                <h3>🔒 Security</h3>
                <p>600K PBKDF2 iterations. Non-extractable keys. OPFS sandboxed storage. Zero-knowledge by design.</p>
            </div>
        </div>
`;
    }
}

customElements.define('sovereign-app', SovereignApp);
