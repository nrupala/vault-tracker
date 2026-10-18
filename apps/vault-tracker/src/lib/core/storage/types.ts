// Copyright (c) 2026 Nrupal Akolkar
// SPDX-License-Identifier: Apache-2.0

/**
 * Storage record types — the shapes the app persists.
 *
 * These interfaces are the contract between the UI/hooks layer and the
 * storage engines (SQLite + SQLCipher on native, jeep-sqlite on web, and
 * the legacy Dexie/IndexedDB store kept as the migration source/fallback).
 * They are re-exported from ../db so existing imports keep working.
 */

// A Vault represents a protected space. The salt is public and used
// alongside the User's master password to derive the encryption key via PBKDF2.
export interface Vault {
  id: string; // UUID
  name: string; // Plaintext Name of the vault
  salt: Uint8Array; // Public salt used for password-KEK derivation
  challengeCiphertext: ArrayBuffer; // Used to verify password is correct
  challengeNonce: Uint8Array; // Used to verify password is correct
  createdAt: number;

  // --- v2 key architecture (DEK model) ---
  // Present once a vault is created on, or migrated to, the DEK scheme. Items are
  // encrypted under a random DEK; the DEK is wrapped by a password-derived KEK
  // and, independently, by a recovery-key-derived KEK. keyVersion 2 = DEK model;
  // undefined/1 = legacy (key derived directly from password, migrated on unlock).
  keyVersion?: number;
  dekWrappedByPassword?: ArrayBuffer;
  dekPasswordNonce?: Uint8Array;
  dekWrappedByRecovery?: ArrayBuffer;
  dekRecoveryNonce?: Uint8Array;
  recoverySalt?: Uint8Array; // salt for the recovery-key KEK
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

  // Resilience & Versioning (v1.1.6+)
  v: number;
  history?: { v: number; payload: ArrayBuffer; nonce: Uint8Array; updatedAt: number }[];
}

export interface VaultSettings {
  id: string; // vaultId
  historyLimit: number; // Max versions to keep (default 5)
  retentionDays: number; // Days to keep history (default 30)
  autoArchiveCompleted: boolean; // Auto-archive done items
  archiveAfterDays: number; // Days after completion to archive
}

/** A rescue snapshot entry: a full copy of vaults + items at a point in time. */
export interface RescueEntry {
  id: string;
  timestamp: number;
  data: { vaults: Vault[]; items: EncryptedItem[] };
}

export type TableName = 'vaults' | 'items' | 'settings';
