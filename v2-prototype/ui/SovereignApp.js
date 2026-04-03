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
        this._prompts = [];
        this._personality = 'focus';
        this._companion = null;
    }

    async connectedCallback() {
        this._render();
        this._bind();
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
        const vsg = this._shadow.getElementById('vault-select-group'); if (vsg) vsg.style.display = 'block';
        const vng = this._shadow.getElementById('vault-name-group'); if (vng) vng.style.display = mode === 'create' ? 'block' : 'none';
        const lbl = this._shadow.getElementById('auth-pw-label');
        if (lbl) lbl.textContent = mode === 'delete' ? 'Confirm Password to Delete' : 'Master Password';
        const btn = this._shadow.getElementById('auth-submit');
        if (btn) btn.textContent = mode === 'create' ? 'Create Vault' : mode === 'delete' ? 'Delete Vault' : 'Unlock Vault';
        const cl = this._shadow.getElementById('create-link'); if (cl) cl.style.display = mode === 'unlock' ? 'inline' : 'none';
        const bl = this._shadow.getElementById('back-link'); if (bl) bl.style.display = mode !== 'unlock' ? 'inline' : 'none';
        const dl = this._shadow.getElementById('delete-link'); if (dl) dl.style.display = mode === 'unlock' ? 'inline' : 'none';
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
                const salt = new Uint8Array(vault.salt);
                const valid = await verifyPassword(pw, salt, vault.verifier);
                if (!valid) return this._authErr('Wrong password');
                this._key = await deriveKey(pw, salt);
                this._vaultId = vault.id; this._vaultName = vault.name; this._salt = salt;
            } else if (mode === 'delete') {
                const vid = this._shadow.getElementById('vault-select')?.value;
                if (!vid) return this._authErr('Select a vault');
                const vaults = await getAllVaults();
                const vault = vaults.find(v => v.id === vid);
                if (!vault) return this._authErr('Vault not found');
                const salt = new Uint8Array(vault.salt);
                const valid = await verifyPassword(pw, salt, vault.verifier);
                if (!valid) return this._authErr('Wrong password');
                await deleteVault(vid);
                this._authErr('Vault "' + vault.name + '" permanently deleted');
                await this._loadVaultList();
                this._setAuthMode('unlock');
                return;
            }

            // Show vault DNA on auth success
            const dnaEl = this._shadow.getElementById('vault-dna');
            if (dnaEl) dnaEl.innerHTML = vaultDNA(this._vaultId);

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
            if (hd) this._habits = JSON.parse(hd);
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
        const fn = { tasks: '_renderTasks', notes: '_renderNotes', habits: '_renderHabits', ledger: '_renderLedger', calendar: '_renderCalendar', analytics: '_renderAnalytics', companion: '_renderCompanion', settings: '_renderSettings' }[this._tab];
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
            const y = this._calDate.getFullYear(), m = this._calDate.getMonth();
            title.textContent = new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const fd = new Date(y, m, 1), ld = new Date(y, m + 1, 0), sd = fd.getDay();
            const today = new Date();
            let h = '<div class="cg">';
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => h += `<div class="ch">${d}</div>`);
            const start = new Date(fd); start.setDate(start.getDate() - sd);
            for (let i = 0; i < 42; i++) {
                const d = new Date(start); d.setDate(d.getDate() + i);
                const other = d.getMonth() !== m, isToday = d.toDateString() === today.toDateString();
                const ds = d.toDateString();
                const di = filtered.filter(it => new Date(it.timestamp).toDateString() === ds);
                h += `<div class="cd ${other ? 'om' : ''} ${isToday ? 'td' : ''}"><div class="cdn">${d.getDate()}</div>${di.slice(0, 3).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 15) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}${di.length > 3 ? `<div class="cm">+${di.length - 3}</div>` : ''}</div>`;
                if (d > ld && i >= 34) break;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'week') {
            const sow = new Date(this._calDate); sow.setDate(sow.getDate() - sow.getDay());
            const eow = new Date(sow); eow.setDate(eow.getDate() + 6);
            title.textContent = `${sow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${eow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            let h = '<div class="cg">';
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => h += `<div class="ch">${d}</div>`);
            for (let i = 0; i < 7; i++) {
                const d = new Date(sow); d.setDate(d.getDate() + i);
                const isToday = d.toDateString() === new Date().toDateString();
                const ds = d.toDateString();
                const di = filtered.filter(it => new Date(it.timestamp).toDateString() === ds);
                h += `<div class="cd ${isToday ? 'td' : ''}" style="min-height:100px"><div class="cdn">${d.getDate()}</div>${di.slice(0, 4).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 15) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}${di.length > 4 ? `<div class="cm">+${di.length - 4}</div>` : ''}</div>`;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'workweek') {
            const sow = new Date(this._calDate);
            const day = sow.getDay();
            sow.setDate(sow.getDate() - day + (day === 0 ? -6 : 1)); // Monday
            const eow = new Date(sow); eow.setDate(eow.getDate() + 4);
            title.textContent = `${sow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${eow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            let h = '<div class="cg">';
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(d => h += `<div class="ch">${d}</div>`);
            for (let i = 0; i < 5; i++) {
                const d = new Date(sow); d.setDate(d.getDate() + i);
                const isToday = d.toDateString() === new Date().toDateString();
                const ds = d.toDateString();
                const di = filtered.filter(it => new Date(it.timestamp).toDateString() === ds);
                h += `<div class="cd ${isToday ? 'td' : ''}" style="min-height:100px"><div class="cdn">${d.getDate()}</div>${di.slice(0, 4).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 15) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}${di.length > 4 ? `<div class="cm">+${di.length - 4}</div>` : ''}</div>`;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'day') {
            title.textContent = this._calDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const di = filtered.filter(it => new Date(it.timestamp).toDateString() === this._calDate.toDateString());
            let h = '';
            for (let hr = 0; hr < 24; hr++) {
                const hi = di.filter(it => new Date(it.timestamp).getHours() === hr);
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
        if (!insights.length) insights.push({ t: 'i', m: 'All systems optimal.' });
        const ic = { w: 'var(--warn)', d: 'var(--danger)', i: 'var(--info)' };
        this._shadow.getElementById('insights').innerHTML = insights.map(i => `<div style="padding:0.625rem 0;border-bottom:1px solid var(--bdr);font-size:0.8rem"><span style="color:${ic[i.t]};font-weight:600">● </span>${i.m}</div>`).join('');
    }

    /* ── Render: Companion ── */
    _renderCompanion() {
        const msgs = this._shadow.getElementById('chat-msgs');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
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

        const payload = { ...item.data };
        if (titleEl) payload.title = titleEl.value.trim() || payload.title;
        if (contentEl) payload.content = contentEl.value.trim();
        if (dueEl) payload.dueDate = dueEl.value || null;
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

    /* ── Bind Events ── */
    _bind() {
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
                try { const { setSetting } = await import('../core/db.js'); await setSetting('habitCheckins', this._habits); } catch (err) { this._log('error', 'Save habit failed:', err); }
                this._renderHabits();
            }
            const modalCancel = e.target.closest('#edit-modal-cancel');
            if (modalCancel) { this._closeEditModal(); return; }
            const modalOverlay = e.target.closest('#edit-modal-overlay');
            if (modalOverlay && e.target === modalOverlay) { this._closeEditModal(); return; }
        });
    }

    /* ── Render Template ── */
    _render() {
        this._applyTheme(0);
        this._shadow.innerHTML = `
        <style>
        :host{display:block;--bg:#0a0a0a;--s1:#141414;--s2:#1e1e1e;--t1:#e5e5e5;--t2:#a3a3a3;--primary:#10b981;--primary-h:#0d9f6e;--danger:#ef4444;--warn:#f59e0b;--info:#3b82f6;--purple:#8b5cf6;--bdr:rgba(255,255,255,0.08);--r:0.625rem;--rl:0.875rem}
        *{margin:0;padding:0;box-sizing:border-box}
        :host{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--t1);font-size:13px;line-height:1.5}
        #auth-screen{position:fixed;inset:0;background:linear-gradient(135deg,#0a0a0a,#111827);display:flex;align-items:center;justify-content:center;z-index:10000}
        .abox{background:var(--s1);border:1px solid var(--bdr);border-radius:1.25rem;padding:2rem;width:380px;max-width:90%;text-align:center}
        .alogo{font-size:1.25rem;font-weight:800;display:flex;align-items:center;justify-content:center;gap:0.4rem;margin-bottom:0.25rem}
        .adot{width:8px;height:8px;border-radius:50%;background:var(--primary);box-shadow:0 0 10px var(--primary)}
        .asub{color:var(--primary);font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:1rem}
        .ainp{background:rgba(0,0,0,0.4);border:1px solid #333;padding:0.75rem;border-radius:var(--r);font-size:0.85rem;width:100%;color:var(--t1);margin-bottom:0.5rem;text-align:center}
        .ainp:focus{outline:none;border-color:var(--primary)}
        .abtn{background:var(--primary);color:#000;border:none;padding:0.75rem;border-radius:var(--r);font-size:0.85rem;font-weight:600;cursor:pointer;width:100%}
        .abtn:hover{background:var(--primary-h)}
        .aerr{color:var(--danger);font-size:0.7rem;margin-top:0.5rem;min-height:1rem}
        .ahint{font-size:0.6rem;opacity:0.4;margin-top:0.75rem;line-height:1.5}
        .ahint a{color:var(--primary);text-decoration:none;font-size:0.7rem}
        .ahint a:hover{text-decoration:underline}
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
        .mood-btns{display:flex;gap:0.375rem;margin-top:0.5rem}
        .mood-btn{padding:0.375rem 0.625rem;border-radius:var(--r);font-size:0.75rem;cursor:pointer;border:1px solid var(--bdr);background:var(--s2);color:var(--t1)}
        .mood-btn:hover{background:rgba(255,255,255,0.08)}
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
                <div class="alogo"><div class="adot"></div> SOVEREIGN VAULT</div>
                <div class="asub">Zero-Knowledge Encrypted Workspace</div>
                <div id="auth-mode" data-mode="unlock">
                    <div id="vault-select-group">
                        <label class="fl">Select Vault</label>
                        <select id="vault-select" class="fi" style="font-size:0.75rem;margin-bottom:0.5rem"></select>
                    </div>
                    <div id="vault-name-group" style="display:none">
                        <label class="fl">Vault Name</label>
                        <input type="text" id="vault-name-input" class="fi" style="font-size:0.75rem;margin-bottom:0.5rem" placeholder="e.g. Personal">
                    </div>
                    <label class="fl" id="auth-pw-label">Master Password</label>
                    <input type="password" id="auth-pw" class="ainp" placeholder="Master Password" autofocus>
                    <button id="auth-submit" class="abtn">Unlock Vault</button>
                </div>
                <div id="vault-dna" style="margin-top:0.5rem"></div>
                <div id="auth-err" class="aerr"></div>
                <div class="ahint" style="margin-top:1rem">
                    <a href="#" id="create-link">Create new vault</a>
                    <a href="#" id="back-link" style="display:none">Back to unlock</a>
                    <a href="#" id="delete-link" style="display:none;color:var(--danger)">Delete vault</a>
                </div>
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
                    <div class="nsec">Views</div>
                    <button class="tab-btn" data-tab="calendar"><span class="ti">📅</span>Calendar</button>
                    <button class="tab-btn" data-tab="analytics"><span class="ti">📊</span>Analytics</button>
                    <div class="nsec">System</div>
                    <button class="tab-btn" data-tab="companion"><span class="ti">🤖</span>Companion</button>
                    <button class="tab-btn" data-tab="settings"><span class="ti">⚙️</span>Settings</button>
                </nav>
                <div class="sf">
                    <button class="sfb" id="exp-json">📤 Export JSON</button>
                    <button class="sfb" id="imp-json">📥 Import JSON</button>
                    <button class="sfb" id="imp-csv">📥 Import CSV</button>
                    <button class="sfb" id="imp-ics">📥 Import ICS</button>
                    <button class="sfb" id="exp-ledger">📤 Ledger CSV</button>
                    <button class="sfb" id="imp-ledger">📥 Ledger CSV</button>
                    <button class="sfb dng" id="lock-btn">🔒 Lock</button>
                    <button class="sfb dng" id="delete-vault-btn">🗑️ Delete Vault</button>
                </div>
            </aside>
            <div class="main">
                <header class="top"><div class="tt" id="title">Tasks</div><div class="ta"><button class="tb" id="theme-btn">🎨</button></div></header>
                <div class="content">
                    <!-- Tasks -->
                    <div class="mod active" data-mod="tasks">
                        <div class="card">
                            <div class="fg"><input type="text" id="task-in" class="fi" placeholder="New task..."></div>
                            <div class="fr"><div class="fg"><label class="fl">Due</label><input type="datetime-local" id="task-due" class="fi"></div><div class="fg"><label class="fl">Priority</label><select id="task-pri" class="fs"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div></div>
                            <div class="fg"><input type="text" id="task-tags" class="fi" placeholder="Tags (comma sep)"></div>
                            <button class="btn bp" id="add-task">+ Add Task</button>
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
                            <button class="btn bp" id="add-note">+ Save Note</button>
                        </div>
                        <div class="il" id="note-list"></div>
                    </div>
                    <!-- Habits -->
                    <div class="mod" data-mod="habits">
                        <div class="card">
                            <div class="fg"><input type="text" id="habit-in" class="fi" placeholder="New habit..."></div>
                            <div class="fg"><select id="habit-pri" class="fs"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>
                            <button class="btn bp" id="add-habit">+ Add Habit</button>
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
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap"><button class="btn bp" id="add-ledger">+ Add</button><button class="btn bs" id="exp-ledger">📤 CSV</button><button class="btn bs" id="imp-ledger">📥 CSV</button></div>
                        </div>
                        <div style="overflow-x:auto"><table class="lt"><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th><th></th></tr></thead><tbody id="ledger-tbody"></tbody></table></div>
                    </div>
                    <!-- Calendar -->
                    <div class="mod" data-mod="calendar">
                        <div class="chd"><div class="cn"><button class="btn bs" id="cal-prev">◀</button><button class="btn bs" id="cal-today">Today</button><button class="btn bs" id="cal-next">▶</button><span class="ctitle" id="cal-title"></span></div><div style="display:flex;align-items:center"><div class="cv"><button class="cv-btn active" data-cv="month">Month</button><button class="cv-btn" data-cv="week">Week</button><button class="cv-btn" data-cv="workweek">Work Week</button><button class="cv-btn" data-cv="day">Day</button><button class="cv-btn" data-cv="schedule">Schedule</button></div><select id="cal-filter" class="cf"><option value="all">All</option><option value="task">Tasks</option><option value="note">Notes</option><option value="habit">Habits</option><option value="ledger">Ledger</option></select></div></div>
                        <div id="cal-view"></div>
                    </div>
                    <!-- Analytics -->
                    <div class="mod" data-mod="analytics">
                        <div class="sg" id="analytics-stats"></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Priority</div><div class="cb" id="chart-priority"></div></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Needs vs Wants</div><div id="chart-behavioral"></div></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Insights</div><div id="insights"></div></div>
                    </div>
                    <!-- Companion -->
                    <div class="mod" data-mod="companion">
                        <div class="card cc">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem"><div style="font-size:0.8rem;font-weight:600;color:var(--primary)">🤖 Companion</div><div style="font-size:0.6rem;color:var(--t2)">● Online</div></div>
                            <div class="cms" id="chat-msgs"><div class="cm"><div class="cb2">[Companion]</div><div class="ct">I live 100% locally. Try: "Task buy groceries", "Expense 20 for lunch", "Security audit". Separate multiple commands with semicolons.</div></div></div>
                            <div class="cir"><input type="text" id="chat-in" class="ci2" placeholder="Type a command..."><button class="btn bp bs" id="chat-send">Send</button></div>
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
                            <div class="sr"><div><div class="srl">History Limit</div><div class="srd">Max version snapshots per item</div></div><input type="number" id="set-history" class="fi" style="width:70px" value="5" min="1" max="50"></div>
                            <div class="sr"><div><div class="srl">Retention Days</div><div class="srd">Days to keep history</div></div><input type="number" id="set-retention" class="fi" style="width:70px" value="30" min="1" max="365"></div>
                            <div class="sr"><div><div class="srl">Auto-Archive</div></div><button class="tog" id="set-archive"></button></div>
                        </div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Export / Import</div>
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap"><button class="btn bs" id="exp-json2">📤 JSON</button><button class="btn bs" id="exp-csv2">📤 CSV</button><button class="btn bs" id="exp-txt2">📤 TXT</button><button class="btn bs" id="imp-json2">📥 JSON</button><button class="btn bs" id="imp-csv2">📥 CSV</button><button class="btn bs" id="imp-ics2">📥 ICS</button></div>
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
                <button class="mtb tab-btn" data-tab="calendar"><span class="mti">📅</span>Cal</button>
                <button class="mtb tab-btn" data-tab="analytics"><span class="mti">📊</span>Stats</button>
                <button class="mtb tab-btn" data-tab="companion"><span class="mti">🤖</span>Chat</button>
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
        <input type="file" id="fi-ledger" accept=".csv" style="display:none">`;
    }
}

customElements.define('sovereign-app', SovereignApp);
