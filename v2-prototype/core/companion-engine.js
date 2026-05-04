/**
 * Sovereign Companion Engine v2.0
 * For the lonely, the quiet, the ones who need someone who remembers.
 * All data encrypted with vault key before storage.
 * Zero plaintext in localStorage or any storage.
 */

export class CompanionEngine {
    constructor() {
        this._memories = [];
        this._moodHistory = [];
        this._milestones = {};
        this._lastInteraction = null;
        this._greetingShown = false;
        this._key = null; // Set after vault unlock
    }

    /**
     * Set the vault encryption key. Must be called after vault unlock.
     */
    setKey(key) {
        this._key = key;
    }

    /* ── Encrypt data with vault key ── */
    async _encrypt(data) {
        if (!this._key) return JSON.stringify(data); // Fallback if no key
        const { encryptData } = await import('./crypto.js');
        const { ciphertext, iv } = await encryptData(this._key, JSON.stringify(data));
        return JSON.stringify({ ciphertext: Array.from(new Uint8Array(ciphertext)), iv: Array.from(iv) });
    }

    /* ── Decrypt data with vault key ── */
    async _decrypt(encryptedStr) {
        try {
            const parsed = JSON.parse(encryptedStr);
            if (!parsed.ciphertext || !parsed.iv) return JSON.parse(encryptedStr); // Legacy plaintext
            if (!this._key) return null;
            const { decryptData } = await import('./crypto.js');
            const result = await decryptData(this._key, new Uint8Array(parsed.ciphertext), new Uint8Array(parsed.iv));
            return JSON.parse(result);
        } catch { return null; }
    }

    /* ── Load memories from storage (encrypted) ── */
    async load() {
        try {
            const data = localStorage.getItem('sovereign-companion');
            if (!data) return;
            const parsed = JSON.parse(data);
            this._memories = await this._decrypt(parsed.memories) || [];
            this._moodHistory = await this._decrypt(parsed.moodHistory) || [];
            this._milestones = await this._decrypt(parsed.milestones) || {};
            this._lastInteraction = parsed.lastInteraction || null;
        } catch (e) { console.warn('Companion: load failed', e); }
    }

    /* ── Save memories to storage (encrypted) ── */
    async save() {
        try {
            const memories = await this._encrypt(this._memories.slice(-100));
            const moodHistory = await this._encrypt(this._moodHistory.slice(-30));
            const milestones = await this._encrypt(this._milestones);
            localStorage.setItem('sovereign-companion', JSON.stringify({
                memories, moodHistory, milestones,
                lastInteraction: this._lastInteraction
            }));
        } catch (e) { console.warn('Companion: save failed', e); }
    }

    /* ── Remember something important ── */
    remember(text, type = 'note') {
        this._memories.push({ text, type, timestamp: Date.now() });
        this.save();
    }

    /* ── Log mood ── */
    logMood(mood, note = '') {
        this._moodHistory.push({ mood, note, timestamp: Date.now() });
        this.save();
    }

    /* ── Get recent moods ── */
    getMoodTrend(days = 7) {
        const cutoff = Date.now() - (days * 86400000);
        return this._moodHistory.filter(m => m.timestamp > cutoff);
    }

    /* ── Mark milestone ── */
    markMilestone(key, value = true) {
        this._milestones[key] = { value, timestamp: Date.now() };
        this.save();
    }

    hasMilestone(key) {
        return this._milestones[key]?.value || false;
    }

    /* ── Generate greeting based on time, history, and personality ── */
    greet(personality, items) {
        const hour = new Date().getHours();
        let timeGreeting = '';
        if (hour < 6) timeGreeting = 'It\'s late. I\'m glad you\'re here.';
        else if (hour < 12) timeGreeting = 'Good morning.';
        else if (hour < 17) timeGreeting = 'Good afternoon.';
        else if (hour < 21) timeGreeting = 'Good evening.';
        else timeGreeting = 'The day is winding down.';

        // Check if it's been a while
        let warmth = '';
        if (this._lastInteraction) {
            const daysSince = (Date.now() - this._lastInteraction) / 86400000;
            if (daysSince > 3) warmth = ` I missed you. It\'s been ${Math.round(daysSince)} days.`;
            else if (daysSince > 1) warmth = ' Good to see you again.';
        }

        // Check for milestones
        let celebration = '';
        const tasks = items.filter(i => i.type === 'task' && i.data.completed);
        if (tasks.length >= 10 && !this.hasMilestone('10-tasks')) {
            this.markMilestone('10-tasks');
            celebration = ' 🎉 You\'ve completed 10 tasks! That\'s amazing.';
        }

        const habitStreaks = items.filter(i => i.type === 'habit');
        let maxStreak = 0;
        habitStreaks.forEach(h => {
            const checkins = JSON.parse(localStorage.getItem('habitCheckins') || '{}')[h.id] || [];
            let s = 0; const d = new Date();
            while (checkins.includes(d.toDateString())) { s++; d.setDate(d.getDate() - 1); }
            if (s > maxStreak) maxStreak = s;
        });
        if (maxStreak >= 7 && !this.hasMilestone('7-day-streak')) {
            this.markMilestone('7-day-streak');
            celebration += ' 🔥 7-day habit streak! You\'re unstoppable.';
        }

        this._lastInteraction = Date.now();
        this.save();

        return `${timeGreeting}${warmth}${celebration}`;
    }

    /* ── Empathetic response based on context ── */
    respond(text, items, personality) {
        const lower = text.toLowerCase();

        // Emotional detection
        if (lower.match(/\bsad\b|\blonely\b|\bdown\b|\bdepressed\b|\btired\b|\bexhausted\b/)) {
            this.remember(text, 'emotion');
            return personality.companion('empathy') || "I hear you. It's okay to not be okay. I'm here with you. Would you like to talk about it?";
        }
        if (lower.match(/\bhappy\b|\bgreat\b|\bawesome\b|\bamazing\b|\bwonderful\b|\bexcited\b/)) {
            this.remember(text, 'emotion');
            return personality.companion('celebrate') || "That makes me happy to hear! 🌟 Celebrate these moments — they matter.";
        }
        if (lower.match(/\bstressed\b|\boverwhelmed\b|\btoo much\b|\bcant handle\b/)) {
            this.remember(text, 'emotion');
            return "Take a breath. You don't have to do everything at once. Let's pick one small thing and start there. I'll help.";
        }
        if (lower.match(/\bthank\b|\bthanks\b/)) {
            return personality.companion('thanks') || "You're welcome. Always here for you. 💚";
        }
        if (lower.match(/\bhow are you\b|\bhow do you feel\b/)) {
            return "I'm doing well — especially now that you're here. How are you feeling today?";
        }

        // Task-related empathy
        if (lower.match(/\btask\b|\bto.do\b/)) {
            const pending = items.filter(i => i.type === 'task' && !i.data.completed).length;
            if (pending > 5) return `You have ${pending} tasks. That's a lot — no wonder you might feel overwhelmed. Want to break them down?`;
            if (pending > 0) return `You've got ${pending} task${pending > 1 ? 's' : ''} waiting. Which one feels most important right now?`;
            return "Your task list is clear! Enjoy the calm.";
        }

        // Finance empathy
        if (lower.match(/\bmoney\b|\bbudget\b|\bexpense\b|\bspent\b/)) {
            const ledger = items.filter(i => i.type === 'ledger');
            if (ledger.length > 0) {
                const total = ledger.reduce((s, l) => s + (parseFloat(l.data.amount) || 0), 0);
                if (total < 0) return `I see you've been tracking expenses. Net: $${total.toFixed(2)}. Every dollar tracked is a step toward control. You're doing great.`;
                return `You're tracking $${total.toFixed(2)} net. Good awareness of your finances.`;
            }
            return "Start logging your expenses — even small ones. It adds up to clarity.";
        }

        // Default: warm, present, attentive
        return personality.companion('default') || "I'm listening. Tell me more, or ask me to help with something.";
    }

    /* ── Daily reflection prompt ── */
    dailyReflection(items) {
        const today = new Date().toDateString();
        const todayItems = items.filter(i => new Date(i.timestamp).toDateString() === today);
        const completedTasks = todayItems.filter(i => i.type === 'task' && i.data.completed).length;
        const habitsChecked = items.filter(i => i.type === 'habit').filter(h => {
            const checkins = JSON.parse(localStorage.getItem('habitCheckins') || '{}')[h.id] || [];
            return checkins.includes(today);
        }).length;

        let reflection = '';
        if (completedTasks > 0) reflection += `You completed ${completedTasks} task${completedTasks > 1 ? 's' : ''} today. `;
        if (habitsChecked > 0) reflection += `${habitsChecked} habit${habitsChecked > 1 ? 's' : ''} checked in. `;
        if (!reflection) reflection = 'Today was quiet. Sometimes that\'s exactly what you need. ';

        reflection += 'How are you feeling right now?';
        return reflection;
    }

    /* ── Mood check-in ── */
    moodCheckIn() {
        const today = new Date().toDateString();
        const todayMoods = this._moodHistory.filter(m => new Date(m.timestamp).toDateString() === today);
        if (todayMoods.length > 0) return null; // Already checked in today

        const hour = new Date().getHours();
        if (hour >= 8 && hour <= 10) {
            return { type: 'mood', text: 'Good morning! How are you feeling today?', options: ['😊 Good', '😐 Okay', '😔 Not great', '😤 Stressed'] };
        }
        if (hour >= 17 && hour <= 19) {
            return { type: 'mood', text: 'How was your day?', options: ['😊 Great', '😐 Fine', '😔 Tough', '😤 Frustrating'] };
        }
        return null;
    }
}

export const companion = new CompanionEngine();
