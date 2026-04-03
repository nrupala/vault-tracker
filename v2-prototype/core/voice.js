/**
 * Sovereign Core v2.0 - Voice Intelligence Engine
 * Zero dependencies. Uses Web Speech API.
 */

export class VoiceEngine extends EventTarget {
    constructor() {
        super();
        this.isListening = false;
        this.lastTranscript = '';
        this.recognition = null;
        this._init();
    }

    _init() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            console.warn('VoiceEngine: SpeechRecognition not supported');
            return;
        }
        this.recognition = new SR();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            this.lastTranscript = transcript;
            this.isListening = false;
            const intent = this._parseIntent(transcript);
            this.dispatchEvent(new CustomEvent('voice-intent', { detail: intent }));
        };

        this.recognition.onerror = (e) => {
            this.isListening = false;
            this.dispatchEvent(new CustomEvent('voice-error', { detail: e.error }));
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };
    }

    _parseIntent(text) {
        const t = text.toLowerCase();
        if (t.match(/^(add\s*)?task\s+(.+)/i)) {
            return { intent: 'CREATE_TASK', payload: text.replace(/^(add\s*)?task\s+/i, '').trim() };
        }
        if (t.match(/^(take\s*)?note\s+(.+)/i)) {
            return { intent: 'CREATE_NOTE', payload: text.replace(/^(take\s*)?note\s+/i, '').trim() };
        }
        if (t.match(/^(track\s*)?habit\s+(.+)/i)) {
            return { intent: 'CREATE_HABIT', payload: text.replace(/^(track\s*)?habit\s+/i, '').trim() };
        }
        if (t.match(/^(expense|spent|log|spend)\s+(\d+\.?\d*)\s*(for|on)?\s*(.+)/i)) {
            const m = t.match(/^(expense|spent|log|spend)\s+(\d+\.?\d*)\s*(for|on)?\s*(.+)/i);
            return { intent: 'LOG_EXPENSE', payload: { amount: parseFloat(m[2]), desc: m[4] || m[1] } };
        }
        if (t.match(/security|audit|safe/i)) {
            return { intent: 'SECURITY_AUDIT', payload: 'Scanning vault...' };
        }
        return { intent: 'UNKNOWN', payload: `Try: "Task [title]", "Note [text]", "Habit [name]", "Expense 20 for lunch"` };
    }

    start() {
        if (!this.recognition) return false;
        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch {
            return false;
        }
    }

    stop() {
        if (!this.recognition) return;
        this.recognition.stop();
        this.isListening = false;
    }

    get isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
}

export const voiceEngine = new VoiceEngine();
