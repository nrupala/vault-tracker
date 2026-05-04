/**
 * Sovereign Core v2.0 - Decentralized Sync Bus
 * XMPP-style signaling combined with Double Ratchet E2EE.
 */

import { RatchetState, generateDH, encodePK } from './double-ratchet.js';

export class SovereignSyncBus extends EventTarget {
    constructor() {
        super();
        this.status = "Disconnected";
        this.peers = new Set();
        this.ratchets = new Map(); // Maps JID string -> RatchetState instance
        this.vaultSecretKey = new Uint8Array(32); // Initial derived SK from vault
        this.ws = null;
    }

    /**
     * Set the initial Shared Key (SK). In a real implementation, 
     * this is derived via PBKDF2/HKDF at the time of Vault Unlock.
     */
    setVaultSecret(skBuffer) {
        this.vaultSecretKey = skBuffer;
    }

    /**
     * Connect to XMPP / WebSocket endpoint.
     */
    async connect(jid, password, host, mock = false) {
        if (!jid || !password || !host) {
            console.warn("SyncBus: jid, password, and host are required.");
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
            
            // Wire up incoming E2EE messages
            this.ws.onmessage = async (e) => {
                await this._handleIncoming(e.data);
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

    async _handleOutgoing(stanza) {
        console.log("SyncBus Outgoing:", stanza);
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('stanza-sent', { detail: stanza }));
        }, 100);
    }

    /**
     * Process incoming stanzas. 
     * If the stanza is a mapped E2EE Double Ratchet payload, it decrypts automatically.
     */
    async _handleIncoming(stanzaStr) {
        try {
            // Attempt to parse JSON Ratchet Envelope
            const parsed = JSON.parse(stanzaStr);
            if (parsed.type === "e2ee" && parsed.from) {
                const jid = parsed.from;
                let ratchet = this.ratchets.get(jid);
                
                // If we don't have an active Ratchet session, bootstrap as receiver (Bob)
                if (!ratchet && parsed.header) {
                    ratchet = new RatchetState();
                    const bobKeyPair = await generateDH(); // Generate our ephemeral receiver keys
                    await ratchet.initAsBob(this.vaultSecretKey, bobKeyPair);
                    this.ratchets.set(jid, ratchet);
                }

                // Decrypt Ratchet Payload
                if (ratchet && parsed.ciphertext) {
                    // Reconstruct header buffers
                    const header = {
                        dh: new Uint8Array(parsed.header.dh).buffer,
                        n: parsed.header.n,
                        pan: parsed.header.pan
                    };

                    const decryptedPlaintext = await ratchet.ratchetDecrypt(
                        header, 
                        new Uint8Array(parsed.ciphertext).buffer, 
                        new Uint8Array(parsed.iv)
                    );
                    
                    console.log(`🔒 [E2EE] Decrypted message from ${jid}`);
                    this.dispatchEvent(new CustomEvent('message-decrypted', { 
                        detail: { from: jid, plaintext: decryptedPlaintext } 
                    }));
                    return; // Successfully handed off E2EE payload
                }
            } 
        } catch (e) {
            // If parsing fails, treat as a legacy/raw XMPP XML Stanza
        }
        
        // Pass to raw stanza handler if non-E2EE
        this.dispatchEvent(new CustomEvent('stanza-received', { detail: stanzaStr }));
    }

    /**
     * Send an E2E Encrypted Payload to a Specific Peer
     * @param {string} toJid Target Peer
     * @param {string} fromJid Local Identifier
     * @param {string} plaintext Data to be encrypted
     * @param {CryptoKey} peerPublicKey Remote Peer's Raw Public Key (required for first initialization)
     */
    async sendEncrypted(toJid, fromJid, plaintext, peerPublicKey) {
        if (!this.ws || this.status === "Disconnected") throw new Error("SyncBus offline");

        let ratchet = this.ratchets.get(toJid);
        
        // Bootstrap sending chain as Alice if this is a new peer
        if (!ratchet && peerPublicKey) {
            ratchet = new RatchetState();
            await ratchet.initAsAlice(this.vaultSecretKey, peerPublicKey);
            this.ratchets.set(toJid, ratchet);
        }

        if (!ratchet) throw new Error("Ratchet uninitialized: Missing peer public key for bootstrap");

        // Step Ratchet & Encrypt
        const { header, ciphertext, iv } = await ratchet.ratchetEncrypt(plaintext);
        
        const payload = {
            type: "e2ee",
            to: toJid,
            from: fromJid,
            header: {
               dh: Array.from(new Uint8Array(header.dh)), // Ensure transportable Array
               n: header.n,
               pan: header.pan 
            },
            ciphertext: Array.from(new Uint8Array(ciphertext)),
            iv: Array.from(new Uint8Array(iv))
        };

        const stanza = JSON.stringify(payload);
        this.ws.send(stanza);
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
