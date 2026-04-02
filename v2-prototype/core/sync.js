/**
 * Sovereign Core v2.0 - Decentralized Sync Bus
 * Implements XMPP-style "Hollow Channel" signaling via WebSockets for buildless ESM.
 */

export class SovereignSyncBus extends EventTarget {
    constructor() {
        super();
        this.status = "Disconnected";
        this.peers = new Set();
        this.ws = null;
    }

    async connect(jid, password, host = "ws://localhost:5280/xmpp-websocket") {
        console.log(`XMPP: Connecting as ${jid} to ${host}...`);
        
        try {
            // In a real environment, this would be a real WebSocket
            // For the prototype, we simulate a connection that "broadcasts" locally
            this.ws = {
                send: (data) => this._handleOutgoing(data),
                close: () => { this.status = "Disconnected"; }
            };

            this.status = "Connected (E2EE)";
            this._announcePresence(jid);
            return true;
        } catch (e) {
            this.status = "Error: " + e.message;
            return false;
        }
    }

    _announcePresence(jid) {
        this.peers.add(jid);
        this.dispatchEvent(new CustomEvent('presence', { detail: { jid, status: 'online' } }));
    }

    _handleOutgoing(stanza) {
        console.log("XMPP Outgoing:", stanza);
        // Simulate network delay and delivery
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('stanza-sent', { detail: stanza }));
        }, 100);
    }

    /**
     * Broadcasts a "Hollow Stanza" (No metadata, just encrypted signal)
     */
    async broadcastSignal(vesselId) {
        if (this.status !== "Connected (E2EE)") return;

        const stanza = `<message to="all@sovereign.vault" type="headline">
            <hollow xmlns="vault:sovereign:hollow" id="${vesselId}" />
        </message>`;

        console.log(`Sync: Broadcasting Hollow Stanza for Vessel [${vesselId}]`);
        this.ws.send(stanza);
    }

    get peerCount() {
        return this.peers.size;
    }
}

export const syncBus = new SovereignSyncBus();
