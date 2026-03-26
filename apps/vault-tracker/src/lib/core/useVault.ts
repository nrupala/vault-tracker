import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { db, type Vault } from './db';
import {
  deriveKey,
  generateSalt,
  generateVerificationPayload,
  verifyPassword,
} from './crypto';
import { v4 as uuidv4 } from 'uuid';

export interface VaultState {
  activeVault: Vault | null;
  encryptionKey: CryptoKey | null;
  isLocked: boolean;
  vaults: Vault[];
  loadVaults: () => Promise<void>;
  createVault: (name: string, password: string) => Promise<Vault>;
  unlockVault: (id: string, password: string) => Promise<Vault>;
  lockVault: () => void;
  deleteVault: (id: string, password: string) => Promise<void>;
}

const VaultContext = createContext<VaultState | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [activeVault, setActiveVault] = useState<Vault | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [vaults, setVaults] = useState<Vault[]>([]);

  const loadVaults = useCallback(async () => {
    const list = await db.vaults.toArray();
    setVaults(list);
  }, []);

  const createVault = async (name: string, masterPassword: string) => {
    const salt = generateSalt();
    const key = await deriveKey(masterPassword, salt);
    const { challengeCiphertext, challengeNonce } =
      await generateVerificationPayload(key);

    const newVault: Vault = {
      id: uuidv4(),
      name,
      salt,
      challengeCiphertext,
      challengeNonce,
      createdAt: Date.now(),
    };

    await db.vaults.add(newVault);
    setActiveVault(newVault);
    setEncryptionKey(key);
    setIsLocked(false);
    await loadVaults();
    return newVault;
  };

  const unlockVault = async (vaultId: string, masterPassword: string) => {
    const vault = await db.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    const key = await verifyPassword(
      masterPassword,
      vault.salt,
      vault.challengeNonce,
      vault.challengeCiphertext
    );

    setActiveVault(vault);
    setEncryptionKey(key);
    setIsLocked(false);
    return vault;
  };

  const lockVault = () => {
    setActiveVault(null);
    setEncryptionKey(null);
    setIsLocked(true);
  };

  const deleteVault = async (vaultId: string, masterPassword: string) => {
    const vault = await db.vaults.get(vaultId);
    if (!vault) throw new Error('Vault not found');

    // Verify password before allowing deletion
    await verifyPassword(
      masterPassword,
      vault.salt,
      vault.challengeNonce,
      vault.challengeCiphertext
    );

    // Securely wipe all items associated with this vault first
    await db.items.where('vaultId').equals(vaultId).delete();
    // Then delete the vault itself
    await db.vaults.delete(vaultId);
    
    if (activeVault?.id === vaultId) {
      lockVault();
    }
    
    await loadVaults();
  };

  const contextValue: VaultState = {
    activeVault,
    encryptionKey,
    isLocked,
    vaults,
    loadVaults,
    createVault,
    unlockVault,
    lockVault,
    deleteVault
  };

  return React.createElement(VaultContext.Provider, { value: contextValue }, children);
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
