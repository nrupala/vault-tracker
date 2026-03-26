import { useState, useEffect, useRef } from 'react';
import { useItems, type DecryptedItem } from '@/lib/core';
import { ContainerItem, type Attachment } from './ContainerItem';
import { Activity, Plus, Target, Flame, Paperclip, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HabitPayload {
  title: string;
  streak: number;
  lastCheckedIn: number;
  checkedInDays?: number[]; // Added for calendar history
}

export function HabitsApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items, createItem, updateItem, deleteItem, exportData } = useItems(vaultId, encryptionKey);

  useEffect(() => {
    const handleExport = (e: any) => exportData((e as CustomEvent).detail);
    window.addEventListener('vault-export', handleExport);
    return () => window.removeEventListener('vault-export', handleExport);
  }, [exportData]);
  
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<DecryptedItem['priority']>('medium');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const habits = items.filter((i: DecryptedItem) => i.type === 'habit');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    await createItem('habit', { title: newTitle, streak: 0, lastCheckedIn: 0, checkedInDays: [], attachments: newAttachments }, [], newPriority);
    setNewTitle('');
    setNewPriority('medium');
    setNewAttachments([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = (event.target as FileReader)?.result;
        if (result) {
          setNewAttachments(prev => [...prev, {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            data: result as string,
            size: file.size
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateTitle = async (id: string, newTitle: string) => {
    const habit = items.find((i: DecryptedItem) => i.id === id);
    if (!habit) return;
    await updateItem(id, {
      payload: { ...habit.payload, title: newTitle }
    });
    setEditingId(null);
  };

  const isToday = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const checkIn = async (habit: DecryptedItem) => {
    const payload = habit.payload as HabitPayload;
    const isCompletedToday = isToday(payload.lastCheckedIn);
    const history = payload.checkedInDays || [];

    if (isCompletedToday) {
      // Undo Completion
      const newStreak = Math.max(0, payload.streak - 1);
      const newHistory = history.filter(d => !isToday(d));
      await updateItem(habit.id, {
        payload: { ...payload, streak: newStreak, lastCheckedIn: newHistory[newHistory.length - 1] || 0, checkedInDays: newHistory }
      });
      return;
    }

    // Calculate if it's a consecutive day or streak lost
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastDate = new Date(payload.lastCheckedIn);
    const isConsecutive = lastDate.getDate() === yesterday.getDate() &&
                         lastDate.getMonth() === yesterday.getMonth() &&
                         lastDate.getFullYear() === yesterday.getFullYear();

    const newStreak = isConsecutive ? payload.streak + 1 : 1;
    const now = Date.now();

    await updateItem(habit.id, {
      payload: { ...payload, streak: newStreak, lastCheckedIn: now, checkedInDays: [...history, now] }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-xl">
            <Activity className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Habits</h2>
          <p className="text-sm text-muted-foreground">Track consistency, securely.</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-4 mb-8 w-full p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Habit to form..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 min-w-0 bg-background text-foreground border border-border px-4 py-3 rounded-xl outline-none focus:ring-2 ring-primary/20 transition-all"
          />
          <button 
            type="submit"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold tracking-wide hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 flex-shrink-0 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Add
          </button>
        </div>
        
        <div className="flex items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Priority:</span>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border ${
                    newPriority === p 
                      ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                      : 'bg-secondary/50 border-transparent text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              multiple 
              accept="image/*,audio/*,video/*" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className="p-2 hover:bg-secondary rounded-xl transition-colors text-muted-foreground hover:text-foreground" 
              title="Attach File"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
        </div>

        {newAttachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-border/50">
            {newAttachments.map(att => (
              <div key={att.id} className="flex justify-between items-center bg-secondary/50 p-2 rounded-xl border border-border/30">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{att.name}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setNewAttachments(prev => prev.filter(a => a.id !== att.id))} 
                  className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <AnimatePresence mode="popLayout">
          {habits.map((habit: DecryptedItem) => {
            const payload = habit.payload as HabitPayload;
            const checkedToday = isToday(payload.lastCheckedIn);
            const isEditing = editingId === habit.id;

            return (
              <ContainerItem 
                key={habit.id} 
                item={habit} 
                onUpdate={async (updated) => updateItem(updated.id, updated)}
                onDelete={deleteItem}
              >
                <div className="flex justify-between items-center py-1">
                  <div className="flex-1 min-w-0 mr-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleUpdateTitle(habit.id, editingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateTitle(habit.id, editingTitle);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 ring-primary"
                        autoFocus
                      />
                    ) : (
                      <h3 
                        className="font-bold text-foreground mb-1 truncate hover:text-primary cursor-pointer transition-colors"
                        onClick={() => {
                          setEditingId(habit.id);
                          setEditingTitle(payload.title);
                        }}
                      >
                        {payload.title}
                      </h3>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 bg-orange-500/10 w-fit px-2 py-0.5 rounded-full">
                       <Flame className="w-3.5 h-3.5" />
                       {payload.streak} Day Streak
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => checkIn(habit)}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0 ${checkedToday ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:rotate-12 active:scale-90'}`}
                  >
                    <Target className="w-6 h-6" />
                  </button>
                </div>
              </ContainerItem>
            )
          })}
        </AnimatePresence>
      </div>

      {habits.length === 0 && (
         <motion.div initial={{ opacity:0 }} animate={{opacity:1}} className="text-center py-20 text-muted-foreground">
           <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
           <p>Start building secure habits.</p>
         </motion.div>
      )}
    </div>
  );
}
