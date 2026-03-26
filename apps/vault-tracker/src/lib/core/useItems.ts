import { useState, useCallback, useMemo, useEffect } from 'react';
import { db, type EncryptedItem } from './db';
import { encryptData, decryptData } from './crypto';
import { v4 as uuidv4 } from 'uuid';

// This is the plaintext shape of the data used by the UI
export interface DecryptedItem<T = any> {
  id: string;
  vaultId: string;
  type: 'note' | 'task' | 'habit' | 'expense';
  createdAt: number;
  updatedAt: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isFlagged: boolean;
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | 'none';
  tags: string[];
  payload: T; // The actual structured content depending on `type`
}

export function useItems(activeVaultId: string | undefined, key: CryptoKey | null) {
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load and Decrypt all items for the active vault
  const loadItems = useCallback(async () => {
    if (!activeVaultId || !key) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const encryptedItems = await db.items.where('vaultId').equals(activeVaultId).toArray();
      
      const decryptedItems: DecryptedItem[] = await Promise.all(
        encryptedItems.map(async (item: EncryptedItem) => {
          const payloadString = await decryptData(key, item.encryptedPayload, item.nonce);
          return {
            ...item,
            payload: JSON.parse(payloadString),
          } as DecryptedItem;
        })
      );
      
      setItems(decryptedItems.sort((a,b) => b.updatedAt - a.updatedAt));
    } catch (e) {
      console.error('Failed to load items', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeVaultId, key]);

  // Auto-load effect
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Create & Encrypt a new item
  const createItem = async (
    type: 'note' | 'task' | 'habit' | 'expense',
    payload: any,
    tags: string[] = [],
    priority: DecryptedItem['priority'] = 'low'
  ) => {
    if (!activeVaultId || !key) throw new Error('Vault is locked');

    const plaintextPayload = JSON.stringify(payload);
    const { ciphertext, nonce } = await encryptData(key, plaintextPayload);

    const newItem: EncryptedItem = {
      id: uuidv4(),
      vaultId: activeVaultId,
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      priority,
      isFlagged: false,
      color: 'none',
      tags,
      encryptedPayload: ciphertext,
      nonce,
    };

    await db.items.add(newItem);
    await loadItems(); // Refresh the list
    return newItem.id;
  };

  // Update & Re-encrypt an existing item
  const updateItem = async (id: string, updates: Partial<DecryptedItem>) => {
     if (!key) throw new Error('Vault is locked');
     const existing = await db.items.get(id);
     if (!existing) throw new Error('Item not found');

     let newCiphertext = existing.encryptedPayload;
     let newNonce = existing.nonce;

     // If payload changed, re-encrypt
     if (updates.payload !== undefined) {
         const plaintextPayload = JSON.stringify(updates.payload);
         const { ciphertext, nonce } = await encryptData(key, plaintextPayload);
         newCiphertext = ciphertext;
         newNonce = nonce;
     }

     await db.items.update(id, {
         ...updates,
         updatedAt: Date.now(),
         encryptedPayload: newCiphertext,
         nonce: newNonce,
     });
     
     await loadItems();
  };

  const deleteItem = async (id: string) => {
      await db.items.delete(id);
      await loadItems();
  };

  const exportData = useCallback((format: 'json' | 'csv' | 'txt') => {
    if (items.length === 0) return;

    let content = '';
    let fileName = `vault-export-${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      content = JSON.stringify(items, null, 2);
      fileName += '.json';
    } else if (format === 'csv') {
      const headers = ['Type', 'CreatedAt', 'UpdatedAt', 'Priority', 'Flagged', 'Tags', 'Payload'];
      const rows = items.map(i => [
        i.type,
        new Date(i.createdAt).toISOString(),
        new Date(i.updatedAt).toISOString(),
        i.priority,
        i.isFlagged,
        i.tags.join(';'),
        JSON.stringify(i.payload).replace(/"/g, '""')
      ].join(','));
      content = [headers.join(','), ...rows].join('\n');
      fileName += '.csv';
    } else if (format === 'txt') {
      content = items.map(i => {
        return `[${i.type.toUpperCase()}] ${new Date(i.createdAt).toLocaleString()}\nPriority: ${i.priority}\nTags: ${i.tags.join(', ')}\nContent: ${JSON.stringify(i.payload, null, 2)}\n-------------------\n`;
      }).join('\n');
      fileName += '.txt';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [items]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => item.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [items]);

  const importData = useCallback(async (content: string, format: 'json' | 'text' | 'ics') => {
    if (!activeVaultId || !key) throw new Error('Vault is locked');

    let count = 0;
    
    if (format === 'json') {
      try {
        const data = JSON.parse(content);
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) {
          await createItem(item.type || 'note', item.payload || item, item.tags || [], item.priority || 'medium');
          count++;
        }
      } catch (e) {
        throw new Error('Invalid JSON format');
      }
    } else if (format === 'text') {
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        await createItem('note', { content: line }, ['imported-txt'], 'medium');
        count++;
      }
    } else if (format === 'ics') {
      // Basic ICS Parser
      const events = content.split('BEGIN:VEVENT');
      events.shift(); // Remove header
      for (const event of events) {
        const summaryMatch = event.match(/SUMMARY:(.*)/);
        const descriptionMatch = event.match(/DESCRIPTION:(.*)/);
        const dtstartMatch = event.match(/DTSTART[:;](.*)/);
        
        const summary = summaryMatch ? summaryMatch[1].trim() : 'Unnamed Event';
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        const dateStr = dtstartMatch ? dtstartMatch[1].trim() : '';
        
        await createItem('task', { 
          title: summary, 
          description,
          dueDate: dateStr,
          status: 'todo'
        }, ['imported-ics'], 'medium');
        count++;
      }
    }
    
    await loadItems();
    return count;
  }, [activeVaultId, key, createItem, loadItems]);

  return {
    items,
    allTags,
    isLoading,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    exportData,
    importData,
  };
}

