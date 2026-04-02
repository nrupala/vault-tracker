/**
 * Sovereign Core v2.0 - Module Router (Custom Element)
 * Buildless hash-based routing for isolated modules.
 */

class SovereignRouter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.routes = {};
    }

    connectedCallback() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    }

    async handleRoute() {
        const hash = window.location.hash || '#tasks';
        const route = hash.slice(1);
        
        // Simple cross-fade trigger
        this.shadowRoot.querySelector('.fade-in')?.style.setProperty('opacity', '0');
        setTimeout(() => {
            this.render(route);
            this.dispatchEvent(new CustomEvent('route-changed', { detail: { route } }));
        }, 150);
    }

    render(route) {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; width: 100%; height: 100%; }
                .fade-in { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            </style>
            <div class="fade-in">
                <slot name="${route}"></slot>
            </div>
        `;
    }
}

customElements.define('sovereign-router', SovereignRouter);
