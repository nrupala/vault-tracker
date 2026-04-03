/**
 * Sovereign Core v2.0 - Identity Module
 * Manages master key derivation with proper salt handling.
 * Salt is provided by the vault metadata, NOT regenerated on each auth.
 */

class SovereignIdentity {
    constructor() {
        this._masterKey = null;
        this._salt = null;
    }

    /**
     * Derive key from password using the vault's stored salt.
     * @param {string} password - User's master password
     * @param {Uint8Array} salt - Vault's stored salt (from vaults table)
     */
    async authenticate(password, salt) {
        if (!salt || !(salt instanceof Uint8Array)) {
            throw new Error('Identity: Salt is required for authentication. Use createVault for new vaults.');
        }
        console.log("Identity: Deriving session key with vault salt...");
        const { deriveSovereignKey } = await import('./crypto.js');
        this._salt = salt;
        this._masterKey = await deriveSovereignKey(password, this._salt);
        return true;
    }

    /**
     * Generate a new salt for creating a new vault.
     * @returns {Uint8Array} Fresh random salt
     */
    static generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16));
    }

    get masterKey() {
        if (!this._masterKey) throw new Error("Vault Locked.");
        return this._masterKey;
    }

    get salt() {
        return this._salt;
    }

    lock() {
        this._masterKey = null;
        this._salt = null;
        console.log("Identity: Session Wiped.");
    }
}

export const identity = new SovereignIdentity();
