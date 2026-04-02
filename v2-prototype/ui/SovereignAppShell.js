/**
 * Sovereign Core v2.0 - Main App Shell
 * Pure Web Component.
 */

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
                }
                .container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
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
        `;
    }
}

customElements.define('sovereign-app-shell', SovereignAppShell);
