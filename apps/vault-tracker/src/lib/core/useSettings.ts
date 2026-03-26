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

  return { settings, updateSettings };
}
