// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Storage record types for @vault/core — the shapes the package persists.
 * Re-exported from ../db so existing imports keep working. Mirrors the app
 * copy's storage/types.ts, trimmed to this package's record model.
 */

// A Vault represents a protected space. The salt is public and used
// alongside the User's master password to derive the encryption key via PBKDF2.
export interface Vault {
  id: string; // UUID
  name: string; // Plaintext Name of the vault
  salt: Uint8Array; // Public salt used for key derivation
  challengeCiphertext: ArrayBuffer; // Used to verify password is correct
  challengeNonce: Uint8Array; // Used to verify password is correct
  createdAt: number;
}

// All user data (Notes, Tasks, Habits) are stored here.
// The real shape of the data is encrypted in the payload.
export interface EncryptedItem {
  id: string; // UUID of the item itself
  vaultId: string; // References Vault.id
  type: 'note' | 'task' | 'habit' | 'expense';
  createdAt: number;
  updatedAt: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isFlagged: boolean;
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | 'none';

  // Tag metadata can remain in plaintext for easy filtering/querying without decryption
  tags: string[];

  // The actual specific data payload (e.g. Note content, Checklists, Habit streaks)
  encryptedPayload: ArrayBuffer;
  nonce: Uint8Array;
}

export type TableName = 'vaults' | 'items';
