/**
 * Sovereign Core v2.0 - Companion HUD (Custom Element)
 * Buildless, adaptive, and local-first.
 */

import { parseSovereignIntent, saveCompanionMemory } from '../core/companion.js';
import { syncBus } from '../core/sync.js';

class SovereignCompanionHUD extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.chatHistory = [{ type: 'bot', text: 'Hello. I am your Sovereign Companion. I live 100% locally.' }];
        this.syncStatus = syncBus.status;
        this.peerCount = syncBus.peerCount;
    }

    connectedCallback() {
        this.render();
        syncBus.addEventListener('presence', () => {
            this.syncStatus = syncBus.status;
            this.peerCount = syncBus.peerCount;
            this.render();
        });

        // Listen for incoming E2EE decrypted messages from the Ratchet pipeline
        syncBus.addEventListener('message-decrypted', (e) => {
            const { from, plaintext } = e.detail;
            this.addMessage('peer', `<b>[Peer ${from.split('@')[0]}]</b>: ${plaintext}`);
        });
        
        // Auto-connect for the prototype
        syncBus.connect("user@sovereign", "pass");
    }

    async handleInput(text) {
        this.addMessage('user', text);
        const { intent, payload } = await parseSovereignIntent(text);
        
        if (intent === "CREATE_TASK") {
            this.addMessage('bot', `Intent Recognized: **Create Task**. Creating vessel for "${payload}"...`);
            // Emit event for the app to handle
            this.dispatchEvent(new CustomEvent('sovereign-action', { 
                detail: { type: 'CREATE_TASK', title: payload },
                bubbles: true, 
                composed: true 
            }));
        } else if (intent === "SECURITY_AUDIT") {
            this.addMessage('bot', `Security Audit Triggered. Scanning SQLite vessels...`);
            const { performSecurityAudit } = await import('../core/companion.js');
            const audit = await performSecurityAudit();
            this.addMessage('bot', `Vault Status: **${audit.status}**`);
            this.addMessage('bot', `Recommendation: ${audit.recommendation}`);
        } else {
            this.addMessage('bot', payload);
            
            // Replicate outgoing text to peers over the E2EE Sync Bus
            if (this.peerCount > 0) {
                try {
                    // Pull the first available peer from the Set
                    const peerJid = Array.from(syncBus.peers)[0];
                    
                    // Generate a dummy public key for prototype bootstrapping 
                    // (in reality, this is fetched from a decentralized directory or scanned QR code)
                    const { generateDH } = await import('../core/double-ratchet.js');
                    const dummyKey = await generateDH();
                    
                    await syncBus.sendEncrypted(peerJid, 'user@sovereign', text, dummyKey.publicKey);
                    this.addMessage('bot', `<span style="color:#555;font-size:0.7rem;"><i>[Sent via Double Ratchet to ${peerJid}]</i></span>`);
                } catch(err) {
                    console.error("Ratchet Error:", err);
                }
            }
        }
    }

    addMessage(type, text) {
        this.chatHistory.push({ type, text });
        this.render();
        const chat = this.shadowRoot.getElementById('chat');
        chat.scrollTop = chat.scrollHeight;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; --p: #10b981; }
                .card { 
                    background: rgba(20, 20, 20, 0.7); 
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1); 
                    padding: 1.5rem; 
                    border-radius: 1.5rem;
                    border-left: 4px solid var(--p);
                }
                h3 { color: var(--p); margin-top: 0; font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase; }
                #chat { 
                    font-size: 0.8rem; 
                    height: 120px; 
                    overflow-y: auto; 
                    background: #000; 
                    padding: 0.75rem; 
                    border-radius: 0.75rem; 
                    margin-bottom: 1rem; 
                    border: 1px solid #222; 
                    color: #eee;
                }
                .msg { margin-bottom: 0.5rem; line-height: 1.4; }
                .bot-prefix { color: var(--p); font-weight: bold; }
                input { 
                    background: #000; 
                    border: 1px solid #333; 
                    color: white; 
                    padding: 0.75rem; 
                    border-radius: 0.75rem; 
                    width: 100%; 
                    box-sizing: border-box; 
                    outline: none;
                }
                input:focus { border-color: var(--p); }
            </style>
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <h3>🤖 Sovereign Companion</h3>
                    <div style="font-size: 0.6rem; text-align: right; opacity: 0.7;">
                        <div style="color: ${this.syncStatus.includes('Error') ? '#ef4444' : '#3b82f6'}">● ${this.syncStatus}</div>
                        <div>Peers: ${this.peerCount}</div>
                    </div>
                </div>
                <div id="chat">
                    ${this.chatHistory.map(m => `
                        <div class="msg">
                            ${m.type === 'bot' ? '<span class="bot-prefix">[Companion]</span> ' : '<span style="color:#888">[You]</span> '}
                            ${m.text}
                        </div>
                    `).join('')}
                </div>
                <input type="text" id="input" placeholder="How can I help you?">
            </div>
        `;

        this.shadowRoot.getElementById('input').onkeydown = (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.handleInput(e.target.value.trim());
                e.target.value = "";
            }
        };
    }
}

customElements.define('sovereign-companion-hud', SovereignCompanionHUD);
