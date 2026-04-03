/**
 * Sovereign Intelligence Engine v2.0
 * Local pattern recognition, smart suggestions, anomaly detection.
 * All processing happens client-side. No data leaves the device.
 */

export class IntelligenceEngine {
    constructor() {
        this._patterns = { tags: {}, categories: {}, descriptions: {}, amounts: {}, habits: {} };
        this._loaded = false;
    }

    /* ── Learn from items ── */
    learn(items) {
        // Reset
        this._patterns = { tags: {}, categories: {}, descriptions: {}, amounts: {}, habits: {}, taskTitles: {}, noteTitles: {} };

        for (const item of items) {
            // Tags frequency
            for (const tag of (item.tags || [])) {
                this._patterns.tags[tag] = (this._patterns.tags[tag] || 0) + 1;
            }

            if (item.type === 'ledger') {
                const d = item.data;
                // Category frequency
                if (d.category) this._patterns.categories[d.category] = (this._patterns.categories[d.category] || 0) + 1;
                // Description patterns (normalize)
                if (d.desc) {
                    const norm = d.desc.toLowerCase().trim();
                    this._patterns.descriptions[norm] = (this._patterns.descriptions[norm] || 0) + 1;
                }
                // Amount patterns by category
                if (d.category && d.amount) {
                    const cat = d.category;
                    if (!this._patterns.amounts[cat]) this._patterns.amounts[cat] = [];
                    this._patterns.amounts[cat].push(Math.abs(parseFloat(d.amount) || 0));
                }
            }

            if (item.type === 'task' && item.data.title) {
                const norm = item.data.title.toLowerCase().trim();
                this._patterns.taskTitles[norm] = (this._patterns.taskTitles[norm] || 0) + 1;
            }

            if (item.type === 'note' && item.data.title) {
                const norm = item.data.title.toLowerCase().trim();
                this._patterns.noteTitles[norm] = (this._patterns.noteTitles[norm] || 0) + 1;
            }

            if (item.type === 'habit' && item.data.title) {
                const norm = item.data.title.toLowerCase().trim();
                this._patterns.habits[norm] = (this._patterns.habits[norm] || 0) + 1;
            }
        }
        this._loaded = true;
    }

    /* ── Autocomplete: given partial input, return top suggestions ── */
    suggest(field, query, limit = 5) {
        if (!this._loaded) return [];
        const q = query.toLowerCase().trim();
        if (!q) return this._topSuggestions(field, limit);

        switch (field) {
            case 'tags':
                return Object.entries(this._patterns.tags)
                    .filter(([k]) => k.includes(q))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);

            case 'ledger-desc':
                return Object.entries(this._patterns.descriptions)
                    .filter(([k]) => k.includes(q))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);

            case 'ledger-category':
                return Object.entries(this._patterns.categories)
                    .filter(([k]) => k.includes(q))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);

            case 'task-title':
                return Object.entries(this._patterns.taskTitles)
                    .filter(([k]) => k.includes(q))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);

            case 'note-title':
                return Object.entries(this._patterns.noteTitles)
                    .filter(([k]) => k.includes(q))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);

            case 'habit-title':
                return Object.entries(this._patterns.habits)
                    .filter(([k]) => k.includes(q))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);

            default:
                return [];
        }
    }

    _topSuggestions(field, limit) {
        switch (field) {
            case 'tags': return Object.entries(this._patterns.tags).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
            case 'ledger-desc': return Object.entries(this._patterns.descriptions).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
            case 'ledger-category': return Object.entries(this._patterns.categories).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
            case 'task-title': return Object.entries(this._patterns.taskTitles).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
            default: return [];
        }
    }

    /* ── Smart amount suggestion based on category history ── */
    suggestAmount(category) {
        if (!this._loaded || !this._patterns.amounts[category]) return null;
        const amounts = this._patterns.amounts[category];
        if (amounts.length === 0) return null;
        const sorted = [...amounts].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const mode = Object.entries(amounts.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {}))
            .sort((a, b) => b[1] - a[1])[0];
        return { median: Math.round(median * 100) / 100, avg: Math.round(avg * 100) / 100, mode: mode ? parseFloat(mode[0]) : null, count: amounts.length };
    }

    /* ── Anomaly detection: is this amount unusual for the category? ── */
    detectAnomaly(category, amount) {
        if (!this._loaded || !this._patterns.amounts[category]) return null;
        const amounts = this._patterns.amounts[category];
        if (amounts.length < 3) return null; // Need at least 3 data points
        const sorted = [...amounts].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const upper = q3 + 1.5 * iqr;
        const lower = q1 - 1.5 * iqr;
        const absAmount = Math.abs(amount);
        if (absAmount > upper) return { type: 'high', message: `Usually $${q1.toFixed(0)}-$${q3.toFixed(0)} for ${category}. This is $${absAmount.toFixed(2)}.`, typical: `$${q1.toFixed(0)}-$${q3.toFixed(0)}` };
        if (absAmount < lower && lower > 0) return { type: 'low', message: `Usually $${q1.toFixed(0)}-$${q3.toFixed(0)} for ${category}. This is $${absAmount.toFixed(2)}.`, typical: `$${q1.toFixed(0)}-$${q3.toFixed(0)}` };
        return null;
    }

    /* ── Quick-add chips: most recent/frequent items for fast entry ── */
    quickChips(type, limit = 6) {
        if (!this._loaded) return [];
        switch (type) {
            case 'ledger':
                return Object.entries(this._patterns.descriptions)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);
            case 'task':
                return Object.entries(this._patterns.taskTitles)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);
            case 'tags':
                return Object.entries(this._patterns.tags)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, limit)
                    .map(([k]) => k);
            default: return [];
        }
    }

    /* ── Smart prompts: "You usually log X on Mondays" ── */
    smartPrompts(items) {
        const prompts = [];
        const now = new Date();
        const dayOfWeek = now.getDay();
        const hour = now.getHours();

        // Day-of-week patterns
        const dayItems = items.filter(i => {
            const d = new Date(i.timestamp);
            return d.getDay() === dayOfWeek;
        });

        if (dayItems.length > 0) {
            const types = {};
            dayItems.forEach(i => { types[i.type] = (types[i.type] || 0) + 1; });
            const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
            if (topType && topType[1] >= 2) {
                const typeNames = { task: 'tasks', note: 'notes', ledger: 'expenses', habit: 'habits' };
                prompts.push({ type: 'nudge', text: `You usually log ${topType[1]} ${typeNames[topType[0]] || topType[0]} on ${now.toLocaleDateString('en-US', { weekday: 'long' })}s.` });
            }
        }

        // Time-based nudges
        if (hour >= 8 && hour <= 10) {
            prompts.push({ type: 'nudge', text: 'Morning! Good time to log yesterday\'s expenses.' });
        }
        if (hour >= 17 && hour <= 19) {
            prompts.push({ type: 'nudge', text: 'Evening review: any tasks to wrap up today?' });
        }

        // Habit reminders
        const habits = items.filter(i => i.type === 'habit');
        if (habits.length > 0) {
            const unchecked = habits.filter(h => {
                const checkins = JSON.parse(localStorage.getItem('habitCheckins') || '{}')[h.id] || [];
                return !checkins.includes(now.toDateString());
            });
            if (unchecked.length > 0 && hour >= 20) {
                prompts.push({ type: 'reminder', text: `${unchecked.length} habit${unchecked.length > 1 ? 's' : ''} not checked in today.` });
            }
        }

        return prompts;
    }
}

export const intelligence = new IntelligenceEngine();
