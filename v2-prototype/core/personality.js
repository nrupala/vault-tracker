/**
 * Sovereign Personality Engine v2.0
 * The app has a soul. Choose its mood.
 * Each personality changes tone, greetings, micro-copy, and interaction style.
 */

export const PERSONALITIES = {
    zen: {
        name: 'Zen',
        emoji: '🧘',
        accent: '#10b981',
        greeting: ['Breathe. One task at a time.', 'Welcome back. The vault is calm.', 'Peace of mind starts here.'],
        empty: { task: 'No tasks yet. When the time is right, add one.', note: 'The page is blank. Let thoughts flow when ready.', habit: 'No habits yet. Small steps lead to great changes.', ledger: 'No transactions. Financial clarity comes with time.' },
        companion: { hello: 'I\'m here whenever you need me.', success: 'Done. Well done.', error: 'That didn\'t work. Let\'s try again gently.' },
        prompt: 'Take a moment. What would you like to focus on?',
        chip: 'Recent',
        nudge: 'A gentle reminder: you have {count} pending items.',
        save: 'Save',
        delete: 'Let go',
        add: '+ Add',
        description: 'Calm, minimal, focused. Green tones. Slower pace.'
    },
    focus: {
        name: 'Focus',
        emoji: '🎯',
        accent: '#3b82f6',
        greeting: ['Let\'s crush it. What\'s next?', 'Ready to dominate today?', 'Focus mode: activated.'],
        empty: { task: 'No tasks. Let\'s build the list.', note: 'Blank slate. Time to capture ideas.', habit: 'No habits. Let\'s build some discipline.', ledger: 'No transactions yet. Let\'s track every dollar.' },
        companion: { hello: 'Locked in. What do you need?', success: 'Boom. Done.', error: 'Missed. Let\'s fix it.' },
        prompt: 'What\'s the most important thing right now?',
        chip: 'Frequent',
        nudge: 'Heads up: {count} items need attention.',
        save: 'Save',
        delete: 'Delete',
        add: '+ Add',
        description: 'Sharp, direct, efficient. Blue tones. Zero fluff.'
    },
    playful: {
        name: 'Playful',
        emoji: '🎉',
        accent: '#f59e0b',
        greeting: ['Hey there! Ready for some productivity fun?', 'Welcome back, champion!', 'Let\'s make today awesome!'],
        empty: { task: 'No tasks yet! Your to-do list is waiting to be born 🌟', note: 'Empty page! Perfect for your brilliant ideas 💡', habit: 'No habits yet! Let\'s build some cool routines 🚀', ledger: 'No transactions! Let\'s start tracking that money 💰' },
        companion: { hello: 'Hey friend! What can I help with? 😊', success: 'Nailed it! You\'re amazing! 🎉', error: 'Oopsie! Let\'s try that again 🤗' },
        prompt: 'What should we tackle first? ✨',
        chip: 'Your favorites',
        nudge: 'Psst! You have {count} things waiting for you 👀',
        save: 'Save it!',
        delete: 'Remove',
        add: '+ Add',
        description: 'Warm, fun, encouraging. Orange tones. Lots of energy.'
    },
    professional: {
        name: 'Professional',
        emoji: '💼',
        accent: '#6b7280',
        greeting: ['Good morning. Here\'s your overview.', 'Welcome back. Let\'s review your workspace.', 'Your vault is ready. How can I assist?'],
        empty: { task: 'No tasks recorded.', note: 'No notes recorded.', habit: 'No habits tracked.', ledger: 'No transactions recorded.' },
        companion: { hello: 'How may I assist you today?', success: 'Completed successfully.', error: 'An error occurred. Please try again.' },
        prompt: 'What would you like to manage today?',
        chip: 'Recent entries',
        nudge: 'You have {count} pending items requiring attention.',
        save: 'Save',
        delete: 'Delete',
        add: '+ Add',
        description: 'Clean, formal, precise. Gray tones. Business-first.'
    },
    energy: {
        name: 'Energy',
        emoji: '⚡',
        accent: '#8b5cf6',
        greeting: ['LET\'S GO! You\'ve got this! 🔥', 'Welcome back! Time to make it happen!', 'Ready to level up? Let\'s do this! 💪'],
        empty: { task: 'Zero tasks! Let\'s fill this up! 🚀', note: 'Empty! Your next big idea is coming! 💥', habit: 'No habits! Time to build unstoppable routines! 🔥', ledger: 'No transactions! Let\'s track that hustle! 💸' },
        companion: { hello: 'What are we crushing today? 🔥', success: 'BOOM! You\'re on fire! 🔥🔥🔥', error: 'No worries! We bounce back stronger! 💪' },
        prompt: 'What\'s the mission today? 🚀',
        chip: 'Top picks',
        nudge: '🔥 {count} items waiting! Let\'s clear them out!',
        save: 'Lock it in!',
        delete: 'Remove',
        add: '+ Add',
        description: 'Bold, energetic, motivating. Purple tones. High energy.'
    }
};

export class PersonalityEngine {
    constructor() {
        this._current = 'focus';
        this._loaded = false;
    }

    set(personality) {
        if (PERSONALITIES[personality]) {
            this._current = personality;
            this._loaded = true;
        }
    }

    get() {
        return PERSONALITIES[this._current] || PERSONALITIES.focus;
    }

    get name() { return this.get().name; }
    get emoji() { return this.get().emoji; }
    get accent() { return this.get().accent; }

    greeting() {
        const p = this.get();
        return p.greeting[Math.floor(Math.random() * p.greeting.length)];
    }

    empty(type) {
        return this.get().empty[type] || 'Nothing here yet.';
    }

    companion(type) {
        return this.get().companion[type] || '';
    }

    prompt() { return this.get().prompt; }
    chip() { return this.get().chip; }
    nudge(count) { return this.get().nudge.replace('{count}', count); }
    save() { return this.get().save; }
    delete() { return this.get().delete; }
    add() { return this.get().add; }

    // Apply personality CSS variables to the app
    applyStyles(element) {
        const p = this.get();
        element.style.setProperty('--personality-accent', p.accent);
    }
}

export const personality = new PersonalityEngine();
