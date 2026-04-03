/**
 * Sovereign App v2.0 - Containerized Web Component
 * Shadow DOM isolation, tabbed UI, zero external dependencies.
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
        this._settings = { historyLimit: 5, retentionDays: 30, autoArchive: false };
        this._ledgerStats = null;
        this._themeIdx = 0;
    }

    async connectedCallback() {
        this._render();
        this._bind();
        await this._loadVaultList();
    }

    _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

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
        const r = this._shadow.querySelector(':host');
        r.style.setProperty('--bg', t.bg);
        r.style.setProperty('--s1', t.s1);
        r.style.setProperty('--s2', t.s2);
        r.style.setProperty('--t1', t.t1);
        r.style.setProperty('--t2', t.t2);
    }

    async _loadVaultList() {
        try {
            const { initSovereignDB, getAllVaults } = await import('./core/db.js');
            await initSovereignDB();
            const vaults = await getAllVaults();
            const sel = this._shadow.getElementById('vault-select');
            if (vaults.length > 0 && sel) {
                sel.innerHTML = `<option value="">-- Create New --</option>` + vaults.map(v => `<option value="${v.id}">${this._esc(v.name)}</option>`).join('');
            }
        } catch {}
    }

    async _unlock() {
        const pw = this._shadow.getElementById('auth-pw').value.trim();
        if (!pw) return this._authErr('Password required');
        try {
            this._authErr('Deriving key...');
            const { deriveSovereignKey, verifyPassword } = await import('./core/crypto.js');
            const { initSovereignDB, getAllVaults, saveVault } = await import('./core/db.js');
            const vid = this._shadow.getElementById('vault-select')?.value;

            if (vid) {
                const vaults = await getAllVaults();
                const vault = vaults.find(v => v.id === vid);
                if (!vault) return this._authErr('Vault not found');
                this._vaultId = vault.id;
                this._vaultName = vault.name;
                this._salt = new Uint8Array(vault.salt);
            } else {
                this._vaultId = 'vault_' + crypto.randomUUID();
                this._vaultName = this._shadow.getElementById('vault-name').value.trim() || 'My Vault';
                this._salt = crypto.getRandomValues(new Uint8Array(16));
                await saveVault(this._vaultId, this._vaultName, this._salt);
            }

            this._key = await deriveSovereignKey(pw, this._salt);
            const valid = await verifyPassword(this._key);
            if (!valid && vid) return this._authErr('Wrong password');

            await initSovereignDB();
            await this._loadSettings();
            await this._loadItems();

            this._shadow.getElementById('auth-screen').style.display = 'none';
            this._shadow.getElementById('app').style.display = 'flex';
            this._shadow.getElementById('vault-label').textContent = this._vaultName;
            this._nav(this._tab);
        } catch (e) { this._authErr('Error: ' + e.message); }
    }

    _authErr(msg) { const el = this._shadow.getElementById('auth-err'); if (el) el.textContent = msg; }

    async _loadSettings() {
        const { getSetting } = await import('./core/db.js');
        const h = await getSetting('historyLimit');
        const r = await getSetting('retentionDays');
        const a = await getSetting('autoArchive');
        if (h) this._settings.historyLimit = JSON.parse(h);
        if (r) this._settings.retentionDays = JSON.parse(r);
        if (a) this._settings.autoArchive = JSON.parse(a);
    }

    async _loadItems() {
        const { getAllVessels, getSetting } = await import('./core/db.js');
        const { decryptSovereignBlob } = await import('./core/crypto.js');
        const vessels = await getAllVessels();
        this._items = [];
        for (const v of vessels) {
            try {
                const data = await decryptSovereignBlob(this._key, v.blob, v.iv);
                const parsed = JSON.parse(data);
                this._items.push({
                    id: v.id, type: v.type || parsed.type || 'unknown',
                    data: parsed.payload || parsed,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                    priority: parsed.priority || v.priority || 'medium',
                    color: parsed.color || 'none', isFlagged: false,
                    timestamp: v.timestamp, updatedAt: v.updatedAt
                });
            } catch {}
        }
        const hd = await getSetting('habitCheckins');
        if (hd) this._habits = JSON.parse(hd);
    }

    async _seal(type, payload, tags = [], priority = 'medium') {
        const { createHollowVessel } = await import('./core/crypto.js');
        const { saveVessel } = await import('./core/db.js');
        const vessel = await createHollowVessel(this._key, type, payload, tags, priority);
        const id = `${type}_${crypto.randomUUID()}`;
        await saveVessel(id, vessel.ciphertext, vessel.iv, type, tags, priority);
        await this._loadItems();
        this._nav(this._tab);
    }

    async _delete(id) {
        const { deleteVessel } = await import('./core/db.js');
        await deleteVessel(id);
        await this._loadItems();
        this._nav(this._tab);
    }

    async _update(id, payload, tags, priority) {
        const { createHollowVessel } = await import('./core/crypto.js');
        const { updateVessel } = await import('./core/db.js');
        const vessel = await createHollowVessel(this._key, this._items.find(i => i.id === id)?.type || 'note', payload, tags, priority);
        const item = this._items.find(i => i.id === id);
        if (item) await updateVessel(id, vessel.ciphertext, vessel.iv, item.type, tags, priority, item.color, item.isFlagged);
        await this._loadItems();
        this._nav(this._tab);
    }

    _nav(tab) {
        this._tab = tab;
        this._shadow.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        this._shadow.querySelectorAll('.mod').forEach(m => m.classList.toggle('active', m.dataset.mod === tab));
        this._shadow.getElementById('title').textContent = { tasks: 'Tasks', notes: 'Notes', habits: 'Habits', ledger: 'Ledger', calendar: 'Calendar', analytics: 'Analytics', companion: 'Companion', settings: 'Settings' }[tab] || tab;
        this._renderMod();
    }

    _renderMod() {
        const fn = { tasks: '_renderTasks', notes: '_renderNotes', habits: '_renderHabits', ledger: '_renderLedger', calendar: '_renderCalendar', analytics: '_renderAnalytics', companion: '_renderCompanion', settings: '_renderSettings' }[this._tab];
        if (fn) this[fn]();
    }

    _renderTasks() {
        const tasks = this._items.filter(i => i.type === 'task');
        const done = tasks.filter(t => t.data.completed).length;
        const crit = tasks.filter(t => t.priority === 'critical' && !t.data.completed).length;
        const overdue = tasks.filter(t => !t.data.completed && t.data.dueDate && new Date(t.data.dueDate) < new Date()).length;

        const stats = this._shadow.getElementById('task-stats');
        if (stats) stats.innerHTML = `
            <div class="sc"><div class="sl">Completion</div><div class="sv">${tasks.length ? Math.round(done / tasks.length * 100) : 0}%</div><div class="ss">${done}/${tasks.length} done</div></div>
            <div class="sc"><div class="sl">Active</div><div class="sv">${tasks.length - done}</div></div>
            <div class="sc"><div class="sl">Critical</div><div class="sv" style="color:var(--danger)">${crit}</div></div>
            <div class="sc"><div class="sl">Overdue</div><div class="sv" style="color:var(--warn)">${overdue}</div></div>`;

        const list = this._shadow.getElementById('task-list');
        if (!list) return;
        if (!tasks.length) { list.innerHTML = '<div class="empty"><div class="ei">✓</div><div>No tasks yet</div></div>'; return; }
        list.innerHTML = tasks.map(t => {
            const due = t.data.dueDate ? new Date(t.data.dueDate).toLocaleDateString() : '';
            const od = !t.data.completed && t.data.dueDate && new Date(t.data.dueDate) < new Date();
            return `<div class="ic">
                <button class="chk ${t.data.completed ? 'on' : ''}" data-id="${t.id}">${t.data.completed ? '✓' : ''}</button>
                <div class="ib">
                    <div class="it ${t.data.completed ? 'done' : ''}">${this._esc(t.data.title || 'Untitled')}</div>
                    <div class="im">
                        <span class="pb p-${t.priority}">${t.priority}</span>
                        ${due ? `<span style="color:${od ? 'var(--danger)' : 'var(--t2)'}">${od ? '⚠ ' : ''}${due}</span>` : ''}
                        ${(t.tags || []).map(g => `<span class="tg">${this._esc(g)}</span>`).join('')}
                    </div>
                </div>
                <button class="ab del" data-del="${t.id}">✕</button>
            </div>`;
        }).join('');
    }

    _renderNotes() {
        const notes = this._items.filter(i => i.type === 'note');
        const list = this._shadow.getElementById('note-list');
        if (!list) return;
        if (!notes.length) { list.innerHTML = '<div class="empty"><div class="ei">📝</div><div>No notes yet</div></div>'; return; }
        list.innerHTML = notes.map(n => `<div class="ic">
            <div class="ib">
                <div class="it">${this._esc(n.data.title || 'Untitled')}</div>
                <div class="im"><span>${this._esc((n.data.content || '').substring(0, 120))}${(n.data.content || '').length > 120 ? '...' : ''}</span>
                ${(n.tags || []).map(g => `<span class="tg">${this._esc(g)}</span>`).join('')}
                <span>${new Date(n.timestamp).toLocaleDateString()}</span></div>
            </div>
            <button class="ab del" data-del="${n.id}">✕</button>
        </div>`).join('');
    }

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
            return `<div class="hc">
                <div class="hh"><div><div class="ht">${this._esc(h.data.title || 'Untitled')}</div><div class="hs">🔥 ${streak} day streak</div></div>
                <button class="hcb ${checked ? 'on' : ''}" data-hid="${h.id}">✓</button></div>
                <div class="im"><span class="pb p-${h.priority}">${h.priority}</span><span style="font-size:0.65rem;color:var(--t2)">${ci.length} check-ins</span></div>
                <button class="ab del" data-del="${h.id}" style="margin-top:0.5rem">Delete</button>
            </div>`;
        }).join('') + `</div>`;
    }

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
        if (stats) stats.innerHTML = `
            <div class="sc"><div class="sl">Net Balance</div><div class="sv ${bal >= 0 ? 'pos' : 'neg'}">$${bal.toFixed(2)}</div></div>
            <div class="sc"><div class="sl">Income</div><div class="sv" style="color:var(--primary)">$${inc.toFixed(2)}</div></div>
            <div class="sc"><div class="sl">Expenses</div><div class="sv" style="color:var(--danger)">$${exp.toFixed(2)}</div></div>
            <div class="sc"><div class="sl">Saving Power</div><div class="sv">${sp}%</div><div class="ss">${items.length} txns</div></div>`;

        const tbody = this._shadow.getElementById('ledger-tbody');
        if (!tbody) return;
        if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--t2)">No transactions</td></tr>'; return; }
        tbody.innerHTML = rows.reverse().map(r => `<tr>
            <td>${new Date(r.timestamp).toLocaleDateString()}</td>
            <td>${this._esc(r.data.category || 'general')}</td>
            <td><span class="tg" style="background:${r.cr ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};color:${r.cr ? 'var(--primary)' : 'var(--danger)'}">${r.cr ? 'Credit' : 'Debit'}</span></td>
            <td>${this._esc(r.data.desc || '')}${r.data.notes ? `<br><span style="font-size:0.65rem;color:var(--t2)">${this._esc(r.data.notes)}</span>` : ''}</td>
            <td class="${r.cr ? '' : 'amtd'}">${r.cr ? '' : '$' + r.amt.toFixed(2)}</td>
            <td class="${r.cr ? 'amtc' : ''}">${r.cr ? '$' + r.amt.toFixed(2) : ''}</td>
            <td class="${r.bal >= 0 ? 'pos' : 'neg'}">$${r.bal.toFixed(2)}</td>
            <td><button class="ab del" data-del="${r.id}">✕</button></td>
        </tr>`).join('');
    }

    _renderCalendar() {
        const view = this._shadow.getElementById('cal-view');
        const title = this._shadow.getElementById('cal-title');
        if (!view || !title) return;
        const all = this._items;

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
                const di = all.filter(it => new Date(it.timestamp).toDateString() === ds);
                h += `<div class="cd ${other ? 'om' : ''} ${isToday ? 'td' : ''}">
                    <div class="cdn">${d.getDate()}</div>
                    ${di.slice(0, 2).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 18) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}
                    ${di.length > 2 ? `<div class="cm">+${di.length - 2}</div>` : ''}
                </div>`;
                if (d > ld && i >= 34) break;
            }
            h += '</div>'; view.innerHTML = h;
        } else if (this._calView === 'day') {
            title.textContent = this._calDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const di = all.filter(it => new Date(it.timestamp).toDateString() === this._calDate.toDateString());
            let h = '';
            for (let hr = 0; hr < 24; hr++) {
                const hi = di.filter(it => new Date(it.timestamp).getHours() === hr);
                h += `<div class="dh"><div class="dhl">${hr.toString().padStart(2, '0')}:00</div><div class="dhc">${hi.map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 25) || it.type; return `<div class="ci ${it.type}" style="margin-bottom:0.25rem">${this._esc(t)}</div>`; }).join('')}</div></div>`;
            }
            view.innerHTML = h;
        } else {
            const sow = new Date(this._calDate); sow.setDate(sow.getDate() - sow.getDay());
            const eow = new Date(sow); eow.setDate(eow.getDate() + 6);
            title.textContent = `${sow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${eow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            let h = '<div class="cg">';
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => h += `<div class="ch">${d}</div>`);
            for (let i = 0; i < 7; i++) {
                const d = new Date(sow); d.setDate(d.getDate() + i);
                const isToday = d.toDateString() === new Date().toDateString();
                const ds = d.toDateString();
                const di = all.filter(it => new Date(it.timestamp).toDateString() === ds);
                h += `<div class="cd ${isToday ? 'td' : ''}" style="min-height:100px">
                    <div class="cdn">${d.getDate()}</div>
                    ${di.slice(0, 3).map(it => { const t = it.data?.title || it.data?.desc || it.data?.content?.substring(0, 18) || it.type; return `<div class="ci ${it.type}">${this._esc(t)}</div>`; }).join('')}
                    ${di.length > 3 ? `<div class="cm">+${di.length - 3}</div>` : ''}
                </div>`;
            }
            h += '</div>'; view.innerHTML = h;
        }
    }

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

        this._shadow.getElementById('analytics-stats').innerHTML = `
            <div class="sc"><div class="sl">Task Completion</div><div class="sv">${cr}%</div><div class="ss">${done}/${tasks.length}</div></div>
            <div class="sc"><div class="sl">Best Streak</div><div class="sv">🔥 ${ms}</div><div class="ss">Avg: ${as}</div></div>
            <div class="sc"><div class="sl">Notes</div><div class="sv">${notes.length}</div></div>
            <div class="sc"><div class="sl">Total Objects</div><div class="sv">${this._items.length}</div></div>`;

        this._shadow.getElementById('chart-priority').innerHTML = Object.entries(pr).map(([k, v]) =>
            `<div class="cbi"><div class="cbv">${v}</div><div class="cbf" style="height:${(v / mp) * 100}%;background:${colors[k]}"></div><div class="cbl">${k}</div></div>`
        ).join('');

        this._shadow.getElementById('chart-behavioral').innerHTML = `
            <div style="margin-bottom:0.75rem"><div style="display:flex;justify-content:space-between;font-size:0.75rem"><span>Needs</span><span>${ls.np}% ($${ls.needs.toFixed(2)})</span></div><div class="prb"><div class="prf" style="width:${ls.np}%;background:var(--info)"></div></div></div>
            <div><div style="display:flex;justify-content:space-between;font-size:0.75rem"><span>Wants</span><span>${ls.wp}% ($${ls.wants.toFixed(2)})</span></div><div class="prb"><div class="prf" style="width:${ls.wp}%;background:var(--warn)"></div></div></div>`;

        const insights = [];
        const tsp = (ls.needs || 0) + (ls.wants || 0);
        if (tsp > 0 && ls.wp > 40) insights.push({ t: 'w', m: `High discretionary spending: ${ls.wp}% of expenses are "wants".` });
        const ov = tasks.filter(t => !t.data.completed && t.data.dueDate && new Date(t.data.dueDate) < new Date()).length;
        if (ov > 3) insights.push({ t: 'd', m: `${ov} overdue tasks. Consider breaking them down.` });
        const lsh = habits.filter(h => { const ci = this._habits[h.id] || []; let s = 0; const d = new Date(); while (ci.includes(d.toDateString())) { s++; d.setDate(d.getDate() - 1); } return s < 3; }).length;
        if (habits.length > 0 && lsh / habits.length > 0.6) insights.push({ t: 'i', m: `${lsh}/${habits.length} habits have streaks < 3 days.` });
        const ct = tasks.filter(t => t.priority === 'critical' && !t.data.completed).length;
        if (ct > 0 && this._items.filter(i => i.type === 'ledger').length > 10) insights.push({ t: 'w', m: `Burnout risk: ${ct} critical tasks with active financial tracking.` });
        if (this._items.length > 100) insights.push({ t: 'i', m: `${this._items.length} items. Consider exporting for backup.` });
        if (!insights.length) insights.push({ t: 'i', m: 'All systems optimal.' });
        const ic = { w: 'var(--warn)', d: 'var(--danger)', i: 'var(--info)' };
        this._shadow.getElementById('insights').innerHTML = insights.map(i =>
            `<div style="padding:0.625rem 0;border-bottom:1px solid var(--bdr);font-size:0.8rem"><span style="color:${ic[i.t]};font-weight:600">● </span>${i.m}</div>`
        ).join('');
    }

    _renderCompanion() {
        // Chat already rendered statically, just scroll to bottom
        const msgs = this._shadow.getElementById('chat-msgs');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

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
        const { parseSovereignIntent, performSecurityAudit } = await import('./core/companion.js');
        const { intent, payload } = await parseSovereignIntent(text);
        if (intent === 'CREATE_TASK') { this._addChat('bot', `Creating task: "${payload}"`); await this._seal('task', { title: payload, completed: false, createdAt: Date.now() }); this._addChat('bot', 'Task sealed ✓'); }
        else if (intent === 'CREATE_NOTE') { this._addChat('bot', `Creating note: "${payload}"`); await this._seal('note', { title: 'Voice Note', content: payload, createdAt: Date.now() }); this._addChat('bot', 'Note sealed 📝'); }
        else if (intent === 'CREATE_HABIT') { this._addChat('bot', `Creating habit: "${payload}"`); await this._seal('habit', { title: payload, createdAt: Date.now() }); this._addChat('bot', 'Habit initiated 🔄'); }
        else if (intent === 'LOG_EXPENSE') { this._addChat('bot', `Logging $${payload.amount} for ${payload.desc}`); await this._seal('ledger', { desc: payload.desc, amount: -payload.amount, type: 'debit', category: 'general', classification: 'want', createdAt: Date.now() }); this._addChat('bot', 'Transaction recorded 💰'); }
        else if (intent === 'SECURITY_AUDIT') { this._addChat('bot', 'Running audit...'); const a = await performSecurityAudit(); this._addChat('bot', `Vault: ${a.status}. ${a.recommendation}`); }
        else this._addChat('bot', payload);
    }

    _download(content, name, type) {
        const b = new Blob([content], { type });
        const u = URL.createObjectURL(b);
        const a = document.createElement('a'); a.href = u; a.download = name;
        this._shadow.host.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(u);
    }

    _exportJSON() {
        const data = this._items.map(i => ({ id: i.id, type: i.type, data: i.data, tags: i.tags, priority: i.priority, timestamp: i.timestamp }));
        this._download(JSON.stringify(data, null, 2), `vault-${Date.now()}.json`, 'application/json');
    }

    _exportCSV() {
        const h = ['Type', 'Timestamp', 'Priority', 'Tags', 'Payload'];
        const r = this._items.map(i => [i.type, new Date(i.timestamp).toISOString(), i.priority, (i.tags || []).join(';'), JSON.stringify(i.data).replace(/"/g, '""')]);
        this._download([h, ...r].map(x => x.map(c => `"${c}"`).join(',')).join('\n'), `vault-${Date.now()}.csv`, 'text/csv');
    }

    _exportTXT() {
        const lines = this._items.map(i => { const t = i.data?.title || i.data?.desc || i.data?.content?.substring(0, 50) || i.type; return `[${i.type.toUpperCase()}] ${t}\n  Date: ${new Date(i.timestamp).toLocaleString()}\n  Priority: ${i.priority}\n  Tags: ${(i.tags || []).join(', ')}\n`; }).join('\n');
        this._download(lines, `vault-${Date.now()}.txt`, 'text/plain');
    }

    async _importJSON(file) {
        try {
            const { createHollowVessel } = await import('./core/crypto.js');
            const { saveVessel } = await import('./core/db.js');
            const data = JSON.parse(await file.text());
            const items = Array.isArray(data) ? data : [data];
            let c = 0;
            for (const it of items) {
                const v = await createHollowVessel(this._key, it.type || 'note', it.data || it.payload || {}, it.tags || [], it.priority || 'medium');
                await saveVessel(it.id || `${it.type || 'note'}_${crypto.randomUUID()}`, v.ciphertext, v.iv, it.type || 'note', it.tags || [], it.priority || 'medium');
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
            this._addChat?.('bot', `Imported ${c} items`);
        } catch (e) { alert('Import failed: ' + e.message); }
    }

    async _importCSV(file) {
        try {
            const { createHollowVessel } = await import('./core/crypto.js');
            const { saveVessel } = await import('./core/db.js');
            const lines = (await file.text()).split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
            let c = 0;
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
                const row = {}; headers.forEach((h, idx) => row[h] = vals[idx] || '');
                const type = row.type || 'note';
                let payload = {}; try { Object.assign(payload, JSON.parse(row.payload || '{}')); } catch {}
                const tags = row.tags ? row.tags.split(';').filter(Boolean) : [];
                const v = await createHollowVessel(this._key, type, payload, tags, row.priority || 'medium');
                await saveVessel(`${type}_${crypto.randomUUID()}`, v.ciphertext, v.iv, type, tags, row.priority || 'medium');
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
            alert(`Imported ${c} items`);
        } catch (e) { alert('Import failed: ' + e.message); }
    }

    async _importICS(file) {
        try {
            const { createHollowVessel } = await import('./core/crypto.js');
            const { saveVessel } = await import('./core/db.js');
            const text = await file.text();
            const events = text.split('BEGIN:VEVENT').slice(1);
            let c = 0;
            for (const ev of events) {
                const summary = ev.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Event';
                const desc = ev.match(/DESCRIPTION:(.*)/)?.[1]?.trim() || '';
                const dt = ev.match(/DTSTART[:;]?(.*)/)?.[1]?.trim();
                const due = dt ? new Date(dt.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toISOString() : null;
                const v = await createHollowVessel(this._key, 'task', { title: summary, content: desc, dueDate: due, completed: false, createdAt: Date.now() }, ['imported-ics']);
                await saveVessel(`task_${crypto.randomUUID()}`, v.ciphertext, v.iv, 'task', ['imported-ics']);
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
            alert(`Imported ${c} events as tasks`);
        } catch (e) { alert('Import failed: ' + e.message); }
    }

    _exportLedgerCSV() {
        const items = this._items.filter(i => i.type === 'ledger').sort((a, b) => a.timestamp - b.timestamp);
        const h = ['Date', 'Description', 'Type', 'Category', 'Classification', 'Amount', 'Notes'];
        const r = items.map(l => [new Date(l.timestamp).toLocaleDateString(), l.data.desc || '', l.data.type || 'debit', l.data.category || 'general', l.data.classification || 'need', l.data.amount || 0, l.data.notes || '']);
        this._download([h, ...r].map(x => x.map(c => `"${c}"`).join(',')).join('\n'), `ledger-${Date.now()}.csv`, 'text/csv');
    }

    async _importLedgerCSV(file) {
        try {
            const { createHollowVessel } = await import('./core/crypto.js');
            const { saveVessel } = await import('./core/db.js');
            const lines = (await file.text()).split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
            let c = 0;
            for (let i = 1; i < lines.length; i++) {
                const vals = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
                const row = {}; headers.forEach((h, idx) => row[h] = vals[idx] || '');
                const amt = parseFloat(row.amount) || 0;
                const type = row.type === 'credit' ? 'credit' : 'debit';
                const v = await createHollowVessel(this._key, 'ledger', { desc: row.description || row.desc || '', amount: type === 'debit' ? -Math.abs(amt) : Math.abs(amt), type, category: row.category || 'general', classification: row.classification || 'need', notes: row.notes || '', createdAt: Date.now() });
                await saveVessel(`ledger_${crypto.randomUUID()}`, v.ciphertext, v.iv, 'ledger');
                c++;
            }
            await this._loadItems(); this._nav(this._tab);
            alert(`Imported ${c} transactions`);
        } catch (e) { alert('Import failed: ' + e.message); }
    }

    _bind() {
        // Auth
        this._shadow.getElementById('auth-pw').addEventListener('keydown', e => { if (e.key === 'Enter') this._unlock(); });
        this._shadow.getElementById('unlock-btn').onclick = () => this._unlock();

        // Nav
        this._shadow.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => this._nav(b.dataset.tab));

        // Task
        this._shadow.getElementById('add-task').onclick = () => {
            const t = this._shadow.getElementById('task-in').value.trim();
            if (!t) return;
            const due = this._shadow.getElementById('task-due').value || null;
            const pri = this._shadow.getElementById('task-pri').value;
            const tags = this._shadow.getElementById('task-tags').value.split(',').map(x => x.trim()).filter(Boolean);
            this._seal('task', { title: t, completed: false, dueDate: due, createdAt: Date.now() }, tags, pri);
            this._shadow.getElementById('task-in').value = '';
            this._shadow.getElementById('task-due').value = '';
            this._shadow.getElementById('task-tags').value = '';
        };

        // Note
        this._shadow.getElementById('add-note').onclick = () => {
            const t = this._shadow.getElementById('note-title').value.trim();
            const c = this._shadow.getElementById('note-body').value.trim();
            if (!c && !t) return;
            const tags = this._shadow.getElementById('note-tags').value.split(',').map(x => x.trim()).filter(Boolean);
            this._seal('note', { title: t || 'Untitled', content: c, createdAt: Date.now() }, tags);
            this._shadow.getElementById('note-title').value = '';
            this._shadow.getElementById('note-body').value = '';
            this._shadow.getElementById('note-tags').value = '';
        };

        // Habit
        this._shadow.getElementById('add-habit').onclick = () => {
            const t = this._shadow.getElementById('habit-in').value.trim();
            if (!t) return;
            this._seal('habit', { title: t, createdAt: Date.now() }, [], this._shadow.getElementById('habit-pri').value);
            this._shadow.getElementById('habit-in').value = '';
        };

        // Ledger
        this._shadow.getElementById('add-ledger').onclick = () => {
            const desc = this._shadow.getElementById('ledger-desc').value.trim();
            const amt = parseFloat(this._shadow.getElementById('ledger-amt').value);
            const type = this._shadow.getElementById('ledger-type').value;
            const cat = this._shadow.getElementById('ledger-cat').value;
            const cls = this._shadow.getElementById('ledger-cls').value;
            const notes = this._shadow.getElementById('ledger-notes').value.trim();
            if (!desc || isNaN(amt)) return;
            this._seal('ledger', { desc, amount: type === 'debit' ? -Math.abs(amt) : Math.abs(amt), type, category: cat, classification: cls, notes, createdAt: Date.now() });
            this._shadow.getElementById('ledger-desc').value = '';
            this._shadow.getElementById('ledger-amt').value = '';
            this._shadow.getElementById('ledger-notes').value = '';
        };

        // Calendar
        this._shadow.getElementById('cal-prev').onclick = () => {
            if (this._calView === 'month') this._calDate.setMonth(this._calDate.getMonth() - 1);
            else if (this._calView === 'week') this._calDate.setDate(this._calDate.getDate() - 7);
            else this._calDate.setDate(this._calDate.getDate() - 1);
            this._renderCalendar();
        };
        this._shadow.getElementById('cal-next').onclick = () => {
            if (this._calView === 'month') this._calDate.setMonth(this._calDate.getMonth() + 1);
            else if (this._calView === 'week') this._calDate.setDate(this._calDate.getDate() + 7);
            else this._calDate.setDate(this._calDate.getDate() + 1);
            this._renderCalendar();
        };
        this._shadow.getElementById('cal-today').onclick = () => { this._calDate = new Date(); this._renderCalendar(); };
        this._shadow.querySelectorAll('.cv-btn').forEach(b => b.onclick = () => {
            this._calView = b.dataset.cv;
            this._shadow.querySelectorAll('.cv-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            this._renderCalendar();
        });

        // Chat
        this._shadow.getElementById('chat-send').onclick = () => {
            const inp = this._shadow.getElementById('chat-in');
            if (!inp.value.trim()) return;
            this._handleChat(inp.value.trim());
            inp.value = '';
        };
        this._shadow.getElementById('chat-in').addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.target.value.trim()) { this._handleChat(e.target.value.trim()); e.target.value = ''; }
        });

        // Theme
        this._shadow.getElementById('theme-btn').onclick = () => {
            this._themeIdx = (this._themeIdx + 1) % 5;
            this._applyTheme(this._themeIdx);
        };

        // Lock
        this._shadow.getElementById('lock-btn').onclick = () => {
            this._key = null; this._salt = null; this._items = [];
            this._shadow.getElementById('auth-screen').style.display = 'flex';
            this._shadow.getElementById('app').style.display = 'none';
            this._shadow.getElementById('auth-pw').value = '';
            this._authErr('');
        };

        // Export/Import sidebar
        this._shadow.getElementById('exp-json').onclick = () => this._exportJSON();
        this._shadow.getElementById('imp-json').onclick = () => this._shadow.getElementById('fi-json').click();
        this._shadow.getElementById('imp-csv').onclick = () => this._shadow.getElementById('fi-csv').click();
        this._shadow.getElementById('imp-ics').onclick = () => this._shadow.getElementById('fi-ics').click();
        this._shadow.getElementById('exp-ledger').onclick = () => this._exportLedgerCSV();
        this._shadow.getElementById('imp-ledger').onclick = () => this._shadow.getElementById('fi-ledger').click();
        this._shadow.getElementById('exp-json2').onclick = () => this._exportJSON();
        this._shadow.getElementById('exp-csv2').onclick = () => this._exportCSV();
        this._shadow.getElementById('exp-txt2').onclick = () => this._exportTXT();
        this._shadow.getElementById('imp-json2').onclick = () => this._shadow.getElementById('fi-json').click();
        this._shadow.getElementById('imp-csv2').onclick = () => this._shadow.getElementById('fi-csv').click();
        this._shadow.getElementById('imp-ics2').onclick = () => this._shadow.getElementById('fi-ics').click();

        this._shadow.getElementById('fi-json').onchange = e => { if (e.target.files[0]) this._importJSON(e.target.files[0]); e.target.value = ''; };
        this._shadow.getElementById('fi-csv').onchange = e => { if (e.target.files[0]) this._importCSV(e.target.files[0]); e.target.value = ''; };
        this._shadow.getElementById('fi-ics').onchange = e => { if (e.target.files[0]) this._importICS(e.target.files[0]); e.target.value = ''; };
        this._shadow.getElementById('fi-ledger').onchange = e => { if (e.target.files[0]) this._importLedgerCSV(e.target.files[0]); e.target.value = ''; };

        // Settings
        this._shadow.getElementById('set-history').onchange = async e => {
            this._settings.historyLimit = parseInt(e.target.value) || 5;
            const { setSetting } = await import('./core/db.js');
            await setSetting('historyLimit', this._settings.historyLimit);
        };
        this._shadow.getElementById('set-retention').onchange = async e => {
            this._settings.retentionDays = parseInt(e.target.value) || 30;
            const { setSetting } = await import('./core/db.js');
            await setSetting('retentionDays', this._settings.retentionDays);
        };
        this._shadow.getElementById('set-archive').onclick = async function () {
            this.classList.toggle('on');
            const { setSetting } = await import('./core/db.js');
            await setSetting('autoArchive', this.classList.contains('on'));
        };

        // Delegated events for task toggle, delete, habit check
        this._shadow.addEventListener('click', async e => {
            const chk = e.target.closest('.chk');
            if (chk) {
                const item = this._items.find(i => i.id === chk.dataset.id);
                if (item) { item.data.completed = !item.data.completed; await this._update(item.id, item.data, item.tags, item.priority); }
                return;
            }
            const del = e.target.closest('[data-del]');
            if (del) { this._delete(del.dataset.del); return; }
            const hcb = e.target.closest('.hcb');
            if (hcb) {
                const today = new Date().toDateString();
                if (!this._habits[hcb.dataset.hid]) this._habits[hcb.dataset.hid] = [];
                const idx = this._habits[hcb.dataset.hid].indexOf(today);
                if (idx >= 0) this._habits[hcb.dataset.hid].splice(idx, 1);
                else this._habits[hcb.dataset.hid].push(today);
                const { setSetting } = await import('./core/db.js');
                await setSetting('habitCheckins', this._habits);
                this._renderHabits();
            }
        });
    }

    _render() {
        this._applyTheme(0);
        this._shadow.innerHTML = `
        <style>
        :host { display:block; --bg:#0a0a0a; --s1:#141414; --s2:#1e1e1e; --t1:#e5e5e5; --t2:#a3a3a3; --primary:#10b981; --primary-h:#0d9f6e; --danger:#ef4444; --warn:#f59e0b; --info:#3b82f6; --purple:#8b5cf6; --bdr:rgba(255,255,255,0.08); --r:0.625rem; --rl:0.875rem; }
        * { margin:0; padding:0; box-sizing:border-box; }
        :host { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--t1); font-size:13px; line-height:1.5; }

        /* Auth */
        #auth-screen { position:fixed; inset:0; background:linear-gradient(135deg,#0a0a0a,#111827); display:flex; align-items:center; justify-content:center; z-index:10000; }
        .abox { background:var(--s1); border:1px solid var(--bdr); border-radius:1.25rem; padding:2rem; width:360px; max-width:90%; text-align:center; }
        .alogo { font-size:1.25rem; font-weight:800; display:flex; align-items:center; justify-content:center; gap:0.4rem; margin-bottom:0.25rem; }
        .adot { width:8px; height:8px; border-radius:50%; background:var(--primary); box-shadow:0 0 10px var(--primary); }
        .asub { color:var(--primary); font-size:0.65rem; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:1.25rem; }
        .ainp { background:rgba(0,0,0,0.4); border:1px solid #333; padding:0.75rem; border-radius:var(--r); font-size:0.85rem; width:100%; color:var(--t1); margin-bottom:0.75rem; text-align:center; }
        .ainp:focus { outline:none; border-color:var(--primary); }
        .abtn { background:var(--primary); color:#000; border:none; padding:0.75rem; border-radius:var(--r); font-size:0.85rem; font-weight:600; cursor:pointer; width:100%; }
        .abtn:hover { background:var(--primary-h); }
        .aerr { color:var(--danger); font-size:0.7rem; margin-top:0.5rem; min-height:1rem; }
        .ahint { font-size:0.6rem; opacity:0.4; margin-top:0.75rem; line-height:1.5; }

        /* App */
        #app { display:none; height:100vh; }
        #app.on { display:flex; }
        .side { width:200px; background:var(--s1); border-right:1px solid var(--bdr); display:flex; flex-direction:column; flex-shrink:0; }
        .sh { padding:0.75rem 1rem; border-bottom:1px solid var(--bdr); }
        .sl { font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:0.3rem; }
        .svl { font-size:0.6rem; color:var(--t2); margin-top:0.125rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sn { flex:1; padding:0.375rem; overflow-y:auto; }
        .tab-btn { display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.625rem; border-radius:var(--r); cursor:pointer; font-size:0.8rem; font-weight:500; color:var(--t2); border:none; background:none; width:100%; text-align:left; }
        .tab-btn:hover { background:rgba(255,255,255,0.05); color:var(--t1); }
        .tab-btn.active { background:rgba(16,185,129,0.1); color:var(--primary); }
        .ti { width:16px; text-align:center; }
        .nsec { font-size:0.55rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--t2); opacity:0.5; padding:0.75rem 0.625rem 0.25rem; }
        .sf { padding:0.5rem 0.75rem; border-top:1px solid var(--bdr); display:flex; flex-direction:column; gap:0.25rem; }
        .sfb { display:flex; align-items:center; gap:0.375rem; padding:0.375rem 0.5rem; border-radius:var(--r); cursor:pointer; font-size:0.7rem; color:var(--t2); border:none; background:none; width:100%; text-align:left; }
        .sfb:hover { background:rgba(255,255,255,0.05); }
        .sfb.dng { color:var(--danger); }

        /* Main */
        .main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .top { height:44px; background:var(--s1); border-bottom:1px solid var(--bdr); display:flex; align-items:center; justify-content:space-between; padding:0 1rem; flex-shrink:0; }
        .tt { font-size:0.85rem; font-weight:600; }
        .ta { display:flex; align-items:center; gap:0.375rem; }
        .tb { background:none; border:1px solid var(--bdr); color:var(--t2); padding:0.25rem 0.5rem; border-radius:var(--r); cursor:pointer; font-size:0.7rem; }
        .tb:hover { background:rgba(255,255,255,0.05); color:var(--t1); }

        .content { flex:1; overflow-y:auto; padding:1rem; }
        .mod { display:none; }
        .mod.active { display:block; }

        /* Cards */
        .card { background:var(--s1); border:1px solid var(--bdr); border-radius:var(--rl); padding:1rem; margin-bottom:0.75rem; }

        /* Stats */
        .sg { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:0.5rem; margin-bottom:1rem; }
        .sc { background:var(--s1); border:1px solid var(--bdr); border-radius:var(--r); padding:0.75rem; }
        .sl { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--t2); margin-bottom:0.125rem; }
        .sv { font-size:1.25rem; font-weight:700; }
        .ss { font-size:0.65rem; color:var(--t2); margin-top:0.125rem; }
        .pos { color:var(--primary); } .neg { color:var(--danger); }

        /* Forms */
        .fg { margin-bottom:0.5rem; }
        .fl { display:block; font-size:0.7rem; font-weight:500; margin-bottom:0.125rem; color:var(--t2); }
        .fi,.fs,.ft { background:rgba(0,0,0,0.3); border:1px solid var(--bdr); padding:0.5rem 0.625rem; border-radius:var(--r); font-size:0.8rem; color:var(--t1); width:100%; }
        .fi:focus,.fs:focus,.ft:focus { outline:none; border-color:var(--primary); }
        .ft { resize:vertical; min-height:60px; font-family:inherit; }
        .fr { display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; }

        /* Buttons */
        .btn { padding:0.375rem 0.75rem; border-radius:var(--r); font-size:0.75rem; font-weight:500; cursor:pointer; border:1px solid var(--bdr); background:var(--s2); color:var(--t1); display:inline-flex; align-items:center; gap:0.25rem; }
        .btn:hover { background:rgba(255,255,255,0.08); }
        .bp { background:var(--primary); color:#000; border-color:var(--primary); }
        .bp:hover { background:var(--primary-h); }
        .bs { padding:0.25rem 0.5rem; font-size:0.65rem; }

        /* Tags/Priority */
        .tg { display:inline-block; padding:0.0625rem 0.375rem; border-radius:999px; font-size:0.6rem; background:rgba(255,255,255,0.08); color:var(--t2); margin-right:0.125rem; }
        .pb { display:inline-block; padding:0.0625rem 0.25rem; border-radius:999px; font-size:0.55rem; font-weight:600; }
        .p-low { background:rgba(59,130,246,0.2); color:#60a5fa; }
        .p-medium { background:rgba(245,158,11,0.2); color:#fbbf24; }
        .p-high { background:rgba(249,115,22,0.2); color:#fb923c; }
        .p-critical { background:rgba(239,68,68,0.2); color:#f87171; }

        /* Items */
        .il { display:flex; flex-direction:column; gap:0.375rem; }
        .ic { background:var(--s1); border:1px solid var(--bdr); border-radius:var(--r); padding:0.625rem 0.75rem; display:flex; align-items:flex-start; gap:0.5rem; }
        .ic:hover { border-color:rgba(255,255,255,0.15); }
        .chk { width:16px; height:16px; border-radius:50%; border:2px solid var(--bdr); cursor:pointer; flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; background:none; color:transparent; font-size:0.55rem; }
        .chk.on { background:var(--primary); border-color:var(--primary); color:#000; }
        .ib { flex:1; min-width:0; }
        .it { font-size:0.8rem; font-weight:500; margin-bottom:0.125rem; }
        .it.done { text-decoration:line-through; opacity:0.5; }
        .im { font-size:0.65rem; color:var(--t2); display:flex; align-items:center; gap:0.375rem; flex-wrap:wrap; }
        .ab { background:none; border:none; color:var(--t2); cursor:pointer; padding:0.125rem; font-size:0.7rem; border-radius:0.25rem; }
        .ab:hover { background:rgba(255,255,255,0.08); color:var(--t1); }
        .ab.del:hover { color:var(--danger); }

        /* Empty */
        .empty { text-align:center; padding:2rem 1rem; color:var(--t2); }
        .ei { font-size:2rem; margin-bottom:0.5rem; opacity:0.3; }

        /* Ledger Table */
        .lt { width:100%; border-collapse:collapse; font-size:0.75rem; }
        .lt th { text-align:left; padding:0.5rem; font-size:0.6rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--t2); border-bottom:1px solid var(--bdr); font-weight:600; }
        .lt td { padding:0.5rem; border-bottom:1px solid var(--bdr); vertical-align:middle; }
        .lt tr:hover td { background:rgba(255,255,255,0.02); }
        .amtc { color:var(--primary); font-weight:600; }
        .amtd { color:var(--danger); font-weight:600; }

        /* Calendar */
        .chd { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; }
        .cn { display:flex; align-items:center; gap:0.375rem; }
        .ct { font-size:0.85rem; font-weight:600; }
        .cv { display:flex; gap:0.125rem; }
        .cv-btn { padding:0.25rem 0.5rem; border-radius:var(--r); font-size:0.65rem; cursor:pointer; border:1px solid var(--bdr); background:none; color:var(--t2); }
        .cv-btn.active { background:var(--primary); color:#000; border-color:var(--primary); }
        .cg { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:var(--bdr); border-radius:var(--r); overflow:hidden; }
        .ch { background:var(--s2); padding:0.375rem; text-align:center; font-size:0.6rem; font-weight:600; text-transform:uppercase; color:var(--t2); }
        .cd { background:var(--s1); padding:0.25rem; min-height:70px; cursor:pointer; }
        .cd:hover { background:rgba(255,255,255,0.03); }
        .cd.om { opacity:0.3; }
        .cd.td { background:rgba(16,185,129,0.08); }
        .cdn { font-size:0.7rem; font-weight:500; margin-bottom:0.125rem; }
        .cd.td .cdn { color:var(--primary); font-weight:700; }
        .ci { font-size:0.55rem; padding:0.0625rem 0.125rem; border-radius:0.125rem; margin-bottom:0.125rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ci.task { background:rgba(16,185,129,0.2); color:#34d399; }
        .ci.note { background:rgba(59,130,246,0.2); color:#60a5fa; }
        .ci.habit { background:rgba(245,158,11,0.2); color:#fbbf24; }
        .ci.ledger { background:rgba(139,92,246,0.2); color:#a78bfa; }
        .cm { font-size:0.55rem; color:var(--t2); padding-left:0.125rem; }

        /* Day View */
        .dh { display:flex; gap:0.5rem; padding:0.375rem 0; border-bottom:1px solid var(--bdr); min-height:40px; }
        .dhl { width:45px; font-size:0.65rem; color:var(--t2); flex-shrink:0; text-align:right; padding-right:0.375rem; }
        .dhc { flex:1; }

        /* Charts */
        .cb { display:flex; align-items:end; gap:0.375rem; height:100px; padding:0 0.375rem; }
        .cbi { flex:1; display:flex; flex-direction:column; align-items:center; }
        .cbf { width:100%; border-radius:0.25rem 0.25rem 0 0; min-height:3px; }
        .cbv { font-size:0.6rem; font-weight:600; margin-bottom:0.125rem; }
        .cbl { font-size:0.55rem; color:var(--t2); margin-top:0.25rem; text-align:center; }
        .prb { height:5px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden; margin-top:0.25rem; }
        .prf { height:100%; border-radius:999px; }

        /* Habits */
        .hg { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:0.5rem; }
        .hc { background:var(--s1); border:1px solid var(--bdr); border-radius:var(--rl); padding:0.75rem; }
        .hh { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.375rem; }
        .ht { font-size:0.8rem; font-weight:600; }
        .hs { font-size:0.7rem; color:var(--warn); }
        .hcb { width:32px; height:32px; border-radius:50%; border:2px solid var(--bdr); background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.85rem; color:transparent; }
        .hcb.on { background:var(--primary); border-color:var(--primary); color:#000; }

        /* Chat */
        .cc { display:flex; flex-direction:column; height:calc(100vh - 160px); }
        .cms { flex:1; overflow-y:auto; padding:0.5rem; }
        .cm { margin-bottom:0.5rem; }
        .cb2 { color:var(--primary); font-size:0.65rem; font-weight:600; }
        .cu { color:var(--t2); font-size:0.65rem; font-weight:600; }
        .ct { font-size:0.75rem; margin-top:0.125rem; line-height:1.4; }
        .cir { display:flex; gap:0.375rem; padding:0.5rem; border-top:1px solid var(--bdr); }
        .ci2 { flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--bdr); padding:0.375rem 0.5rem; border-radius:var(--r); font-size:0.75rem; color:var(--t1); }
        .ci2:focus { outline:none; border-color:var(--primary); }

        /* Settings */
        .sr { display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--bdr); }
        .sr-l { font-size:0.8rem; }
        .sr-d { font-size:0.65rem; color:var(--t2); margin-top:0.125rem; }
        .tog { width:36px; height:20px; border-radius:999px; background:rgba(255,255,255,0.15); cursor:pointer; position:relative; border:none; }
        .tog.on { background:var(--primary); }
        .tog::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:transform 0.2s; }
        .tog.on::after { transform:translateX(16px); }

        /* Mobile */
        .mnav { display:none; }
        @media (max-width:768px) {
            .side { display:none; }
            .mnav { display:flex!important; position:fixed; bottom:0; left:0; right:0; background:var(--s1); border-top:1px solid var(--bdr); padding:0.375rem; gap:0.125rem; overflow-x:auto; z-index:100; padding-bottom:calc(0.375rem + env(safe-area-inset-bottom)); }
            .mtb { flex-shrink:0; padding:0.375rem 0.5rem; border-radius:var(--r); font-size:0.6rem; color:var(--t2); cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.125rem; background:none; border:none; }
            .mtb.active { color:var(--primary); background:rgba(16,185,129,0.1); }
            .mti { font-size:1rem; }
            .content { padding-bottom:70px; }
            .fr { grid-template-columns:1fr; }
            .sg { grid-template-columns:repeat(2,1fr); }
        }

        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:999px; }
        </style>

        <!-- Auth -->
        <div id="auth-screen">
            <div class="abox">
                <div class="alogo"><div class="adot"></div> SOVEREIGN VAULT</div>
                <div class="asub">Zero-Knowledge Auth</div>
                <select id="vault-select" class="fi" style="font-size:0.75rem;margin-bottom:0.5rem"></select>
                <input type="password" id="auth-pw" class="ainp" placeholder="Master Password" autofocus>
                <input type="text" id="vault-name" class="ainp" placeholder="New Vault Name (optional)" style="font-size:0.75rem;padding:0.5rem">
                <button id="unlock-btn" class="abtn">Unlock Vault</button>
                <div id="auth-err" class="aerr"></div>
                <div class="ahint">Encryption happens locally. No data leaves your device.<br>No password recovery possible.</div>
            </div>
        </div>

        <!-- App -->
        <div id="app">
            <aside class="side">
                <div class="sh"><div class="sl"><div class="adot" style="width:6px;height:6px"></div> SOVEREIGN</div><div class="svl" id="vault-label">Vault</div></div>
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
                </div>
            </aside>

            <div class="main">
                <header class="top"><div class="tt" id="title">Tasks</div>
                    <div class="ta"><button class="tb" id="theme-btn">🎨</button></div>
                </header>
                <div class="content">
                    <!-- Tasks -->
                    <div class="mod active" data-mod="tasks">
                        <div class="card">
                            <div class="fg"><input type="text" id="task-in" class="fi" placeholder="New task..."></div>
                            <div class="fr">
                                <div class="fg"><label class="fl">Due</label><input type="datetime-local" id="task-due" class="fi"></div>
                                <div class="fg"><label class="fl">Priority</label><select id="task-pri" class="fs"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                            </div>
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
                            <div class="fr">
                                <div class="fg"><label class="fl">Amount</label><input type="number" id="ledger-amt" class="fi" placeholder="0.00" step="0.01"></div>
                                <div class="fg"><label class="fl">Type</label><select id="ledger-type" class="fs"><option value="credit">Credit (Income)</option><option value="debit">Debit (Expense)</option></select></div>
                            </div>
                            <div class="fr">
                                <div class="fg"><label class="fl">Category</label><select id="ledger-cat" class="fs"><option value="general">General</option><option value="food">Food</option><option value="transport">Transport</option><option value="housing">Housing</option><option value="utilities">Utilities</option><option value="health">Health</option><option value="entertainment">Entertainment</option><option value="shopping">Shopping</option><option value="education">Education</option><option value="salary">Salary</option><option value="investment">Investment</option></select></div>
                                <div class="fg"><label class="fl">Classification</label><select id="ledger-cls" class="fs"><option value="need">Need</option><option value="want">Want</option></select></div>
                            </div>
                            <div class="fg"><input type="text" id="ledger-notes" class="fi" placeholder="Notes..."></div>
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap">
                                <button class="btn bp" id="add-ledger">+ Add</button>
                                <button class="btn bs" id="exp-ledger">📤 CSV</button>
                                <button class="btn bs" id="imp-ledger">📥 CSV</button>
                            </div>
                        </div>
                        <div style="overflow-x:auto"><table class="lt"><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th><th></th></tr></thead><tbody id="ledger-tbody"></tbody></table></div>
                    </div>

                    <!-- Calendar -->
                    <div class="mod" data-mod="calendar">
                        <div class="chd">
                            <div class="cn"><button class="btn bs" id="cal-prev">◀</button><button class="btn bs" id="cal-today">Today</button><button class="btn bs" id="cal-next">▶</button><span class="ct" id="cal-title"></span></div>
                            <div class="cv"><button class="cv-btn active" data-cv="month">Month</button><button class="cv-btn" data-cv="week">Week</button><button class="cv-btn" data-cv="day">Day</button></div>
                        </div>
                        <div id="cal-view"></div>
                    </div>

                    <!-- Analytics -->
                    <div class="mod" data-mod="analytics">
                        <div class="sg" id="analytics-stats"></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Priority Distribution</div><div class="cb" id="chart-priority"></div></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Behavioral Balance</div><div id="chart-behavioral"></div></div>
                        <div class="card"><div style="font-size:0.8rem;font-weight:600;margin-bottom:0.5rem">Ecosystem Insights</div><div id="insights"></div></div>
                    </div>

                    <!-- Companion -->
                    <div class="mod" data-mod="companion">
                        <div class="card cc">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                                <div style="font-size:0.8rem;font-weight:600;color:var(--primary)">🤖 Sovereign Companion</div>
                                <div style="font-size:0.6rem;color:var(--t2)">● Online</div>
                            </div>
                            <div class="cms" id="chat-msgs">
                                <div class="cm"><div class="cb2">[Companion]</div><div class="ct">Hello. I live 100% locally. Try: "Task buy groceries", "Security audit", "Expense 20 for lunch".</div></div>
                            </div>
                            <div class="cir"><input type="text" id="chat-in" class="ci2" placeholder="Type a command..."><button class="btn bp bs" id="chat-send">Send</button></div>
                        </div>
                    </div>

                    <!-- Settings -->
                    <div class="mod" data-mod="settings">
                        <div class="card">
                            <div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Data Retention</div>
                            <div class="sr"><div><div class="sr-l">History Limit</div><div class="sr-d">Max version snapshots per item</div></div><input type="number" id="set-history" class="fi" style="width:70px" value="5" min="1" max="50"></div>
                            <div class="sr"><div><div class="sr-l">Retention Days</div><div class="sr-d">Days to keep history</div></div><input type="number" id="set-retention" class="fi" style="width:70px" value="30" min="1" max="365"></div>
                            <div class="sr"><div><div class="sr-l">Auto-Archive Completed</div></div><button class="tog" id="set-archive"></button></div>
                        </div>
                        <div class="card">
                            <div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Data Management</div>
                            <div style="display:flex;gap:0.375rem;flex-wrap:wrap">
                                <button class="btn bs" id="exp-json2">📤 JSON</button>
                                <button class="btn bs" id="exp-csv2">📤 CSV</button>
                                <button class="btn bs" id="exp-txt2">📤 TXT</button>
                                <button class="btn bs" id="imp-json2">📥 JSON</button>
                                <button class="btn bs" id="imp-csv2">📥 CSV</button>
                                <button class="btn bs" id="imp-ics2">📥 ICS</button>
                            </div>
                        </div>
                        <div class="card">
                            <div style="font-size:0.8rem;font-weight:600;margin-bottom:0.75rem">Security</div>
                            <div class="sr"><div><div class="sr-l">Vault Items</div><div class="sr-d" id="item-count">0 vessels</div></div></div>
                            <div class="sr"><div><div class="sr-l">Encryption</div><div class="sr-d">AES-256-GCM / PBKDF2 600K</div></div><span style="color:var(--primary);font-size:0.7rem">● Active</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mobile Nav -->
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

        <!-- Hidden inputs -->
        <input type="file" id="fi-json" accept=".json" style="display:none">
        <input type="file" id="fi-csv" accept=".csv" style="display:none">
        <input type="file" id="fi-ics" accept=".ics" style="display:none">
        <input type="file" id="fi-ledger" accept=".csv" style="display:none">`;
    }
}

customElements.define('sovereign-app', SovereignApp);
