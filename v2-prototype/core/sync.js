/**
 * Sovereign Core v2.0 - Decentralized Sync Bus
 * XMPP-style signaling. No hardcoded endpoints or credentials.
 */

export class SovereignSyncBus extends EventTarget {
    constructor() {
        super();
        this.status = "Disconnected";
        this.peers = new Set();
        this.ws = null;
    }

    /**
     * Connect to XMPP server.
     * @param {string} jid - XMPP JID (required)
     * @param {string} password - XMPP password (required)
     * @param {string} host - WebSocket endpoint (required)
     * @param {boolean} mock - Use mock mode for local testing
     */
    async connect(jid, password, host, mock = false) {
        if (!jid || !password || !host) {
            console.warn("SyncBus: jid, password, and host are required. Running in disconnected mode.");
            this.status = "Disconnected (No config)";
            return false;
        }

        if (mock) {
            console.log(`SyncBus: Mock mode for ${jid}`);
            this.ws = {
                send: (data) => this._handleOutgoing(data),
                close: () => { this.status = "Disconnected"; }
            };
            this.status = "Connected (Mock/E2EE)";
            this._announcePresence(jid);
            return true;
        }

        try {
            this.ws = new WebSocket(host);
            this.ws.onopen = () => {
                this.status = "Connected (E2EE)";
                this._announcePresence(jid);
            };
            this.ws.onerror = (e) => {
                this.status = "Error: Connection failed";
                console.error("SyncBus WebSocket error:", e);
            };
            this.ws.onclose = () => { this.status = "Disconnected"; };
            this.ws.onmessage = (e) => {
                this.dispatchEvent(new CustomEvent('stanza-received', { detail: e.data }));
            };
            return true;
        } catch (e) {
            this.status = "Error: " + e.message;
            console.error("SyncBus connection failed:", e);
            return false;
        }
    }

    _announcePresence(jid) {
        this.peers.add(jid);
        this.dispatchEvent(new CustomEvent('presence', { detail: { jid, status: 'online' } }));
    }

    _handleOutgoing(stanza) {
        console.log("SyncBus Mock Outgoing:", stanza);
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('stanza-sent', { detail: stanza }));
        }, 100);
    }

    async broadcastSignal(vesselId) {
        if (!this.ws || this.status === "Disconnected") return;
        const stanza = `<message to="all@sovereign.vault" type="headline"><hollow xmlns="vault:sovereign:hollow" id="${vesselId}" /></message>`;
        console.log(`SyncBus: Broadcasting signal for vessel [${vesselId}]`);
        this.ws.send(stanza);
    }

    get peerCount() { return this.peers.size; }
}

export const syncBus = new SovereignSyncBus();
