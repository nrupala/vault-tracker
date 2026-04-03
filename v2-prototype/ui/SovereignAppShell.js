/**
 * Sovereign Core v2.0 - Main App Shell
 * Pure Web Component.
 */

import { exportVaultToBlob, importVaultFromBlob } from '../core/db.js';

class SovereignAppShell extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        window.addEventListener('sovereign-vessel-added', () => {
            this.showNotification("Vessel Sealed: Metadata Scrubbed & Atomic Encryption Applied.");
        });
        
        this.setupCoreAccess();
    }

    setupCoreAccess() {
        const exportBtn = this.shadowRoot.getElementById('export-btn');
        const importBtn = this.shadowRoot.getElementById('import-btn');
        const fileInput = this.shadowRoot.getElementById('import-file');

        if(exportBtn) exportBtn.onclick = async () => {
            try {
                this.showNotification("Extracting OPFS Vault...");
                const blob = await exportVaultToBlob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sovereign-vault-${Date.now()}.db`;
                a.click();
                window.URL.revokeObjectURL(url);
                this.showNotification("Vault Extracted to Local disk.");
            } catch (e) {
                this.showNotification("Export Error: " + e.message);
            }
        };

        if(importBtn) importBtn.onclick = () => fileInput.click();

        if(fileInput) fileInput.onchange = async (e) => {
            if (!e.target.files.length) return;
            const file = e.target.files[0];
            try {
                this.showNotification("Restoring Vault... Do not close window.");
                await importVaultFromBlob(file);
                this.showNotification("Vault Restored. Reloading Engine.");
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                this.showNotification("Restore Failed: " + err.message);
            }
        };
    }

    showNotification(msg) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        this.shadowRoot.getElementById('notifications').appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                .container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    flex: 1;
                    width: 100%;
                    box-sizing: border-box;
                }
                .nav {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 0;
                    margin-bottom: 2rem;
                }
                .logo {
                    font-weight: 900;
                    font-size: 1.5rem;
                    letter-spacing: -0.05em;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
                #notifications {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    display: grid;
                    gap: 1rem;
                    z-index: 1000;
                }
                .toast {
                    background: #10b981;
                    color: black;
                    padding: 1rem 1.5rem;
                    border-radius: 1rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .core-footer {
                    background: rgba(10,10,10,0.8);
                    border-top: 1px solid rgba(255,255,255,0.05);
                    padding: 1rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8rem;
                }
                .core-btn {
                    background: transparent;
                    color: #888;
                    border: 1px solid #333;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: inherit;
                    font-weight: 500;
                }
                .core-btn:hover {
                    color: white;
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.1);
                }
                .danger-btn:hover {
                    border-color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                }
            </style>
            <div class="container">
                <nav class="nav">
                    <div class="logo"><div class="dot"></div> VAULT TRACKER <sup>v2.0</sup></div>
                    <div style="display: flex; gap: 1.5rem; font-size: 0.8rem; font-weight: 500; opacity: 0.7;">
                        <a href="#tasks" style="color: white; text-decoration: none;">TASKS</a>
                        <a href="#notes" style="color: white; text-decoration: none;">NOTES</a>
                        <a href="#habits" style="color: white; text-decoration: none;">HABITS</a>
                        <a href="#ledger" style="color: white; text-decoration: none;">LEDGER</a>
                    </div>
                </nav>
                <main id="view-port">
                    <slot name="content"></slot>
                </main>
                <div id="notifications"></div>
            </div>
            
            <footer class="core-footer">
                <div>
                    <span style="opacity: 0.5;">CORE ENGINE:</span> 
                    <span style="color: #10b981; font-family: monospace;">SQLite WASM (OPFS)</span>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button id="import-btn" class="core-btn danger-btn">RESTORE VAULT (.db)</button>
                    <button id="export-btn" class="core-btn">EXTRACT VAULT</button>
                    <input type="file" id="import-file" accept=".db,.sqlite" style="display: none;">
                </div>
            </footer>
        `;
    }
}

customElements.define('sovereign-app-shell', SovereignAppShell);
