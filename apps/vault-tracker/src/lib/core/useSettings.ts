import { useState, useCallback, useEffect } from 'react';
import { db, type VaultSettings } from './db';

const DEFAULT_SETTINGS: Omit<VaultSettings, 'id'> = {
  historyLimit: 5,
  retentionDays: 30,
  autoArchiveCompleted: false,
  archiveAfterDays: 30
};

export function useSettings(vaultId: string | undefined) {
  const [settings, setSettings] = useState<VaultSettings | null>(null);

  const loadSettings = useCallback(async () => {
    if (!vaultId) return;
    const s = await db.settings.get(vaultId);
    if (s) {
      setSettings(s);
    } else {
      const initial = { id: vaultId, ...DEFAULT_SETTINGS };
      await db.settings.add(initial);
      setSettings(initial);
    }
  }, [vaultId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = async (updates: Partial<VaultSettings>) => {
    if (!vaultId || !settings) return;
    const newSettings = { ...settings, ...updates };
    await db.settings.put(newSettings);
    setSettings(newSettings);
  };

  const runRetentionPurge = useCallback(async () => {
    if (!vaultId || !settings) return;
    const now = Date.now();
    const retentionMs = settings.retentionDays * 24 * 60 * 60 * 1000;
    
    // 1. Purge old history entries (v1.1.7)
    await db.items.toCollection().modify(item => {
      if (item.history) {
        item.history = item.history.filter(h => (now - h.updatedAt) < retentionMs);
      }
    });

    // 2. Auto-archive completed items (placeholder for Iteration 17)
    if (settings.autoArchiveCompleted) {
      console.log('🛡️ Resilience: Archive check for items older than', settings.archiveAfterDays);
    }
  }, [vaultId, settings]);

  return { settings, updateSettings, runRetentionPurge };
}
