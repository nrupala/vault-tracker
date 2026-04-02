/**
 * Sovereign Core v2.0 - Vessel List (Custom Element)
 * Displays the local SQLite "Hollow Ledger" with decrypted content.
 */

import { getAllVessels } from '../core/db.js';

class SovereignVesselList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.vessels = [];
        this.decryptedVessels = [];
    }

    connectedCallback() {
        this.refresh();
        // Listen for global refresh signals
        window.addEventListener('sovereign-vessel-added', () => this.refresh());
    }

    async refresh() {
        try {
            this.vessels = await getAllVessels();
            await this.decryptAllVessels();
            this.render();
        } catch (e) {
            console.error(e);
        }
    }

    async decryptAllVessels() {
        this.decryptedVessels = [];
        
        for (const vessel of this.vessels) {
            const decryptFunc = window.decryptVessel;
            if (decryptFunc) {
                const decrypted = await decryptFunc(vessel);
                this.decryptedVessels.push({
                    ...vessel,
                    decrypted
                });
            } else {
                this.decryptedVessels.push({
                    ...vessel,
                    decrypted: null
                });
            }
        }
    }

    handleDelete(vesselId) {
        const deleteFunc = window.handleDeleteVessel;
        if (deleteFunc) {
            deleteFunc(vesselId);
        }
    }

    getTypeColor(type) {
        const colors = {
            task: '#10b981',
            note: '#3b82f6',
            habit: '#f59e0b',
            ledger: '#8b5cf6',
            tracker: '#ec4899'
        };
        return colors[type] || '#6b7280';
    }

    getTypeIcon(type) {
        const icons = {
            task: '✓',
            note: '📝',
            habit: '🔄',
            ledger: '💰',
            tracker: '📊'
        };
        return icons[type] || '📦';
    }

    renderVesselContent(vessel) {
        if (!vessel.decrypted) {
            return '<div style="opacity: 0.5; font-size: 0.8rem;">Encrypted Content</div>';
        }

        const d = vessel.decrypted;
        const type = vessel.id.split('_')[0];

        switch (type) {
            case 'task':
                return `
                    <div style="font-weight: 600;">${d.title || 'Untitled Task'}</div>
                    <div style="font-size: 0.7rem; opacity: 0.6; margin-top: 0.25rem;">
                        ${d.completed ? '✓ Completed' : '○ Pending'} • 
                        Priority: ${d.priority || 'normal'}
                    </div>
                `;
            case 'note':
                return `
                    <div style="font-weight: 600;">Note</div>
                    <div style="font-size: 0.8rem; opacity: 0.8; margin-top: 0.25rem; 
                                max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
                        ${d.content || 'Empty note'}
                    </div>
                `;
            case 'habit':
                return `
                    <div style="font-weight: 600;">${d.title || 'Untitled Habit'}</div>
                    <div style="font-size: 0.7rem; opacity: 0.6; margin-top: 0.25rem;">
                        🔥 Streak: ${d.streak || 0} days
                    </div>
                `;
            case 'ledger':
                const amount = d.amount || 0;
                const isPositive = amount >= 0;
                return `
                    <div style="font-weight: 600;">${d.desc || 'Transaction'}</div>
                    <div style="font-size: 0.9rem; font-weight: 700; margin-top: 0.25rem; 
                                color: ${isPositive ? '#10b981' : '#ef4444'};">
                        ${isPositive ? '+' : ''}${amount.toFixed(2)}
                    </div>
                `;
            case 'tracker':
                return `
                    <div style="font-weight: 600;">${d.metric || 'Metric'}</div>
                    <div style="font-size: 1.2rem; font-weight: 700; margin-top: 0.25rem;">
                        ${d.value || 0} ${d.unit || ''}
                    </div>
                `;
            default:
                return '<div style="opacity: 0.5;">Unknown vessel type</div>';
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; --p: #10b981; }
                .list { display: grid; gap: 0.75rem; }
                .vessel { 
                    background: rgba(40, 40, 40, 0.3); 
                    border: 1px solid rgba(255, 255, 255, 0.05); 
                    padding: 1rem; 
                    border-radius: 1rem;
                    position: relative;
                    transition: all 0.2s;
                }
                .vessel:hover {
                    border-color: rgba(255, 255, 255, 0.1);
                    background: rgba(50, 50, 50, 0.4);
                }
                .vessel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .vessel-type {
                    font-size: 0.6rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    padding: 0.2rem 0.5rem;
                    border-radius: 0.5rem;
                    background: rgba(0, 0, 0, 0.3);
                }
                .vessel-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .vessel-btn {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.4);
                    cursor: pointer;
                    font-size: 0.8rem;
                    padding: 0.2rem;
                    transition: color 0.2s;
                }
                .vessel-btn:hover {
                    color: #ef4444;
                }
                .vessel-content {
                    color: white;
                }
                .vessel-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                .vessel-id {
                    font-family: monospace;
                    font-size: 0.65rem;
                    opacity: 0.4;
                }
                .vessel-time {
                    font-size: 0.65rem;
                    opacity: 0.4;
                }
                .count-badge { 
                    font-size: 0.7rem; 
                    opacity: 0.5; 
                    margin-bottom: 1rem; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em;
                }
                .empty-state {
                    text-align: center;
                    padding: 3rem 2rem;
                    opacity: 0.3;
                }
                .empty-state-icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }
            </style>
            <div class="count-badge">${this.vessels.length} Hollow Vessels on Device</div>
            <div class="list">
                ${this.vessels.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔐</div>
                        <div>Your vault is empty</div>
                        <div style="font-size: 0.8rem; margin-top: 0.5rem;">Create your first vessel to begin</div>
                    </div>
                ` : ''}
                ${this.decryptedVessels.map(v => {
                    const type = v.id.split('_')[0];
                    const color = this.getTypeColor(type);
                    const icon = this.getTypeIcon(type);
                    
                    return `
                        <div class="vessel" style="border-left: 3px solid ${color};">
                            <div class="vessel-header">
                                <span class="vessel-type" style="color: ${color};">
                                    ${icon} ${type}
                                </span>
                                <div class="vessel-actions">
                                    <button class="vessel-btn" onclick="this.getRootNode().host.handleDelete('${v.id}')" title="Delete">
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div class="vessel-content">
                                ${this.renderVesselContent(v)}
                            </div>
                            <div class="vessel-footer">
                                <span class="vessel-id">${v.id.slice(0, 16)}...</span>
                                <span class="vessel-time">${new Date(v.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

customElements.define('sovereign-vessel-list', SovereignVesselList);
