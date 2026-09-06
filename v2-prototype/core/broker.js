/**
 * Sovereign Core v2.0 - Sovereign Signal Broker (XMPP-style)
 * Zero-dependency, buildless signaling layer per COMMUNICATION_v2.md:
 *   - XMPP stanza codec (RFC 6120 framing over WebSocket transports)
 *   - Local loopback transport (BroadcastChannel) for same-device/multi-tab
 *     signaling with no server at all
 *   - WebSocket transport adapter (connect to any XMPP-over-WS or sovereign
 *     relay endpoint)
 *
 * Zero knowledge: payloads carried in stanzas are already E2EE by the Double
 * Ratchet (core/sync.js). The broker never sees plaintext.
 */

const SIGNAL_XMLNS = 'vault:sovereign:signal';
const NS_STREAM = 'http://etherx.jabber.org/streams';
const NS_CLIENT = 'jabber:client';

/* ---------------- XMPP stanza codec ---------------- */

export function buildStreamOpen(toHost) {
    return `<?xml version="1.0"?>` +
        `<stream:stream xmlns="${NS_CLIENT}" xmlns:stream="${NS_STREAM}" ` +
        `to="${esc(toHost)}" version="1.0" xml:lang="en" xmlns:xml="http://www.w3.org/XML/1998/namespace">`;
}

export function buildAuthPlain(jid, password) {
    const token = btoaCompat(`${jid}\u0000${jid}\u0000${password}`);
    return `<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="PLAIN">${token}</auth>`;
}

export function buildBind(resource) {
    return `<iq type="set" id="bind_1"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind">` +
        `<resource>${esc(resource)}</resource></bind></iq>`;
}

export function buildPresence(jid) {
    return `<presence from="${esc(jid)}"/>`;
}

export function buildMessage({ to, from, type = 'chat', body, signal }) {
    const payload = signal
        ? `<signal xmlns="${SIGNAL_XMLNS}">${esc(JSON.stringify(signal))}</signal>`
        : '';
    const bodyEl = body ? `<body>${esc(body)}</body>` : '';
    return `<message to="${esc(to)}" from="${esc(from)}" type="${esc(type)}">${payload}${body}</message>`;
}

/** Parse a stanza into { name, attrs, children:{signal, body} }. DOMParser when present, regex fallback otherwise. */
export function parseStanza(xml) {
    if (typeof DOMParser !== 'undefined') {
        try {
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            if (!doc.querySelector('parsererror')) {
                const root = doc.documentElement;
                const signalEl = root.getElementsByTagNameNS(SIGNAL_XMLNS, 'signal')[0] ||
                    root.getElementsByTagName('signal')[0];
                const bodyEl = root.getElementsByTagName('body')[0];
                return {
                    name: root.localName || root.nodeName,
                    attrs: Object.fromEntries([...root.attributes].map(a => [a.name, a.value])),
                    signal: signalEl ? safeJson(signalEl.textContent) : null,
                    body: bodyEl ? bodyEl.textContent : null
                };
            }
        } catch { /* fall through to regex parser */ }
    }
    return regexParseStanza(xml);
}

function regexParseStanza(xml) {
    const nameMatch = xml.match(/^<([a-zA-Z0-9:-]+)/);
    const attrs = {};
    const attrRe = /([a-zA-Z0-9:-]+)="([^"]*)"/g;
    const tagEnd = xml.indexOf('>');
    const openTag = tagEnd >= 0 ? xml.slice(0, tagEnd + 1) : xml;
    let m;
    while ((m = attrRe.exec(openTag)) !== null) attrs[m[1]] = m[2];
    const signalMatch = xml.match(/<signal[^>]*>([\s\S]*?)<\/signal>/);
    const bodyMatch = xml.match(/<body>([\s\S]*?)<\/body>/);
    return {
        name: nameMatch ? nameMatch[1] : 'unknown',
        attrs,
        signal: signalMatch ? safeJson(unescape(signalMatch[1])) : null,
        body: bodyMatch ? unescape(bodyMatch[1]) : null
    };
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescape(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function btoaCompat(s) {
    if (typeof btoa === 'function') {
        // Base64 must encode the RAW UTF-8 bytes; encodeURIComponent would escape
        // NUL separators and '@' and produce an invalid SASL PLAIN token.
        const bytes = new TextEncoder().encode(s);
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin);
    }
    return Buffer.from(s, 'utf8').toString('base64');
}

function safeJson(text) {
    try { return JSON.parse(text); } catch { return text; }
}

/* ---------------- The broker ---------------- */

export class SovereignBroker extends EventTarget {
    constructor() {
        super();
        this.status = 'Disconnected';
        this.jid = null;
        this.transport = 'none'; // 'loopback' | 'websocket' | 'none'
        this.channel = null;
        this.ws = null;
        this._reconnectMs = 2000;
        this._maxReconnectMs = 30000;
        this._shouldRun = false;
        this._services = new Map();   // serviceName -> async handler(args)
        this._pending = new Map();    // reqId -> { resolve, reject, timer }
        this._reqSeq = 0;
    }

    /* ---------- Service bus (local-first RPC over the signal bus) ---------- */

    /** Register a service handler: register('echo', async (args) => result). */
    register(serviceName, handler) {
        if (typeof handler !== 'function') throw new Error('register: handler must be a function');
        this._services.set(serviceName, handler);
    }

    unregister(serviceName) { this._services.delete(serviceName); }

    /**
     * Call a service: locally when registered here, otherwise as an E2EE-transport
     * request routed over the active transport (loopback peer or XMPP/WS relay).
     */
    async call(serviceName, args = null, { timeoutMs = 5000 } = {}) {
        if (this._services.has(serviceName)) {
            return this._services.get(serviceName)(args);
        }
        const reqId = `req_${++this._reqSeq}_${Date.now()}`;
        const delivered = this.sendSignal({ kind: 'service-call', payload: { reqId, service: serviceName, args } });
        if (!delivered) throw new Error(`call: no transport available for service '${serviceName}'`);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._pending.delete(reqId);
                reject(new Error(`call: '${serviceName}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this._pending.set(reqId, { resolve, reject, timer });
        });
    }

    /** Event bridge: emit/on mirror EventTarget with plain names. */
    emit(event, detail = null) {
        this.dispatchEvent(new CustomEvent(event, { detail }));
    }

    on(event, handler) { this.addEventListener(event, handler); }

    _handleServiceCall(signal) {
        const { reqId, service, args } = signal.payload || {};
        const handler = this._services.get(service);
        Promise.resolve().then(() => handler ? handler(args) : { error: `service '${service}' not found here` })
            .then(result => {
                if (reqId) this.sendSignal({ kind: 'service-reply', payload: { reqId, result, error: null } });
            })
            .catch(err => {
                if (reqId) this.sendSignal({ kind: 'service-reply', payload: { reqId, result: null, error: String(err && err.message || err) } });
            });
    }

    _onSignal(signal) {
        if (!signal || typeof signal !== 'object') return;
        if (signal.kind === 'service-call' && signal.payload) {
            this._handleServiceCall(signal.payload);
            return;
        }
        if (signal.kind === 'service-reply' && signal.payload && this._pending.has(signal.payload.reqId)) {
            const p = this._pending.get(signal.payload.reqId);
            clearTimeout(p.timer);
            this._pending.delete(signal.payload.reqId);
            if (signal.payload.error) p.reject(new Error(`service reply error: ${signal.payload.error}`));
            else p.resolve(signal.payload.result);
            return;
        }
        this.dispatchEvent(new CustomEvent('signal', { detail: signal }));
    }

    /**
     * Connect a transport.
     *   loopback:  { transport: 'loopback', jid }             (no server, same device/multi-tab)
     *   websocket: { transport: 'websocket', jid, endpoint }  (XMPP-over-WS or sovereign relay)
     */
    async connect({ jid, transport = 'loopback', endpoint = null }) {
        await this.close();
        this.jid = jid;
        this._shouldRun = true;

        if (transport === 'loopback') {
            this.transport = 'loopback';
            try {
                this.channel = new BroadcastChannel('sovereign-bus');
                this.channel.onmessage = (e) => this._onSignal(e.data);
                this.channel.onmessageerror = () => this._setStatus('Error');
                this.status = 'Connected (Loopback)';
                this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
                this._announce();
                return true;
            } catch (err) {
                this.status = 'Error: ' + err.message;
                this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
                return false;
            }
        }

        if (transport === 'websocket') {
            if (!endpoint) {
                this.status = 'Error: endpoint required for websocket transport';
                this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
                return false;
            }
            this.transport = 'websocket';
            return this._openWS(jid, endpoint);
        }

        this.status = 'Error: unknown transport';
        this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
        return false;
    }

    async _openWS(jid, endpoint, attempt = 0) {
        try {
            this.ws = new WebSocket(endpoint);
        } catch (err) {
            this.status = 'Error: ' + err.message;
            this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
            return false;
        }
        this.ws.onopen = () => {
            // RFC 6120 framing: stream open -> SASL PLAIN -> bind -> presence.
            this.ws.send(buildStreamOpen(new URL(endpoint).host));
            this.ws.send(buildAuthPlain(jid, this._password || ''));
            this.ws.send(buildBind('sovereign'));
            this.ws.send(buildPresence(jid));
            this.status = 'Connected (XMPP/WS)';
            this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
            this._announce();
        };
        this.ws.onmessage = (e) => {
            const parsed = parseStanza(String(e.data));
            if (parsed.signal) this._onSignal({ ...parsed.signal, from: parsed.attrs.from || parsed.signal.from });
            this.dispatchEvent(new CustomEvent('stanza', { detail: parsed }));
        };
        this.ws.onerror = () => this._setStatus('Error: connection failed');
        this.ws.onclose = () => {
            this._setStatus('Disconnected');
            if (this._shouldRun) {
                const wait = Math.min(this._maxReconnectMs, this._reconnectMs * (attempt + 1));
                setTimeout(() => { if (this._shouldRun) this._openWS(jid, endpoint, attempt + 1); }, wait);
            }
        };
        return true;
    }

    _setStatus(status) {
        this.status = status;
        this.dispatchEvent(new CustomEvent('status', { detail: status }));
    }

    _announce() {
        if (this.transport === 'loopback' && this.channel) {
            this.channel.postMessage({ kind: 'presence', from: this.jid, ts: Date.now() });
        }
        this.dispatchEvent(new CustomEvent('presence', { detail: { jid: this.jid, status: 'online' } }));
    }

    /**
     * Send a sovereign signal (already E2EE payload or plain envelope object).
     * Loopback -> BroadcastChannel JSON; websocket -> XMPP message stanza.
     */
    sendSignal({ to = null, kind = 'update', payload = null }) {
        const signal = { kind, payload, from: this.jid, ts: Date.now() };
        if (this.transport === 'loopback' && this.channel) {
            this.channel.postMessage(signal);
            this.dispatchEvent(new CustomEvent('signal-sent', { detail: signal }));
            return true;
        }
        if (this.transport === 'websocket' && this.ws && this.ws.readyState === 1) {
            const stanza = buildMessage({ to: to || 'all@sovereign.vault', from: this.jid, signal });
            this.ws.send(stanza);
            this.dispatchEvent(new CustomEvent('signal-sent', { detail: signal }));
            return true;
        }
        return false;
    }

    /** Convenience: announce a Hollow Vessel change (kind: 'vessel', payload: {id, action}). */
    broadcastVessel(vesselId, action = 'update') {
        return this.sendSignal({ kind: 'vessel', payload: { id: vesselId, action } });
    }

    async close() {
        this._shouldRun = false;
        for (const [reqId, p] of this._pending) {
            clearTimeout(p.timer);
            p.reject(new Error('broker closed'));
        }
        this._pending.clear();
        if (this.channel) { try { this.channel.close(); } catch { /* already closed */ } this.channel = null; }
        if (this.ws) { try { this.ws.close(); } catch { /* already closed */ } this.ws = null; }
        this.transport = 'none';
        this._setStatus('Disconnected');
    }
}

export const broker = new SovereignBroker();

// Contract alias: the broker is the service-broker layer of the signal bus.
export { SovereignBroker as ServiceBroker };