import { useState, useEffect, useRef } from 'react';
import { useItems, type DecryptedItem } from '@vault/core';
import { ContainerItem, type Attachment } from './ContainerItem';
import { CheckSquare, Plus, Circle, CheckCircle2, Hash, X as CloseIcon, Calendar, Bell, AlertTriangle, Paperclip, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TagSuggestions } from './TagSuggestions';

interface TaskPayload {
  title: string;
  isCompleted: boolean;
  dueDate?: number;
}

export function TasksApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items, allTags, createItem, updateItem, deleteItem, exportData } = useItems(vaultId, encryptionKey);
  const [newTitle, setNewTitle] = useState('');
  const [priority, setPriority] = useState<DecryptedItem['priority']>('medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, boolean>>({});
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleExport = (e: any) => exportData((e as CustomEvent).detail);
    window.addEventListener('vault-export', handleExport);
    return () => window.removeEventListener('vault-export', handleExport);
  }, [exportData]);

  // Request Notification Permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const tasks = items.filter((i: DecryptedItem) => i.type === 'task');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    let dueDateTimestamp: number | undefined = undefined;
    if (dueDate) {
      const dateObj = new Date(dueDate);
      if (!isNaN(dateObj.getTime())) {
        dueDateTimestamp = dateObj.getTime();
      } else {
        // Fallback for partial date strings (e.g. YYYY-MM-DD without T)
        const fallbackDate = new Date(dueDate + "T00:00");
        if (!isNaN(fallbackDate.getTime())) {
          dueDateTimestamp = fallbackDate.getTime();
        }
      }
    }
    
    await createItem('task', { 
        title: newTitle, 
        isCompleted: false, 
        dueDate: dueDateTimestamp,
        attachments: newAttachments
    }, newTags, priority);

    setNewTitle('');
    setPriority('medium');
    setDueDate('');
    setNewTags([]);
    setNewAttachments([]);
    setTagInput('');
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

  const addTag = (tag: string) => {
    const cleanTag = tag.replace(/^#/, '').trim();
    if (cleanTag && !newTags.includes(cleanTag)) {
      setNewTags([...newTags, cleanTag]);
    }
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const removeTag = (tag: string) => {
    setNewTags(newTags.filter((t: string) => t !== tag));
  };

  const toggleTask = async (task: DecryptedItem) => {
    const payload = task.payload as TaskPayload;
    const newStatus = !payload.isCompleted;
    
    // Optimistic UI update
    setOptimisticStatus(prev => ({ ...prev, [task.id]: newStatus }));
    
    try {
      await updateItem(task.id, {
        payload: { ...payload, isCompleted: newStatus }
      });
    } finally {
      // Clear optimistic state once DB is synced
      setOptimisticStatus(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }
  };

  const getDueStatus = (dueDate?: number) => {
    if (!dueDate) return null;
    const now = Date.now();
    const diff = dueDate - now;
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < 0) return { label: 'Overdue', color: 'text-red-500 bg-red-500/10', icon: AlertTriangle };
    if (diff < oneDay) return { label: 'Due Soon', color: 'text-orange-500 bg-orange-500/10', icon: Bell };
    return { label: new Date(dueDate).toLocaleDateString(), color: 'text-muted-foreground bg-secondary/50', icon: Calendar };
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-xl">
             <CheckSquare className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
            <p className="text-sm text-muted-foreground">Encrypted action items with reminders.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 bg-card border border-border p-3 rounded-xl shadow-lg focus-within:ring-2 ring-primary/20">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="I need to..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 bg-transparent text-foreground px-2 py-2 outline-none placeholder:text-muted-foreground/50 font-medium text-lg"
            />
            <button 
              type="submit"
              className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/40">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <input 
                  type="datetime-local" 
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent text-xs text-foreground outline-none cursor-pointer"
                />
              </div>

              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="bg-secondary/50 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg outline-none border border-border/40 text-foreground cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1">
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
                className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground" 
                title="Attach File"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {newAttachments.length > 0 && (
          <div className="flex flex-col gap-1.5 px-1">
            {newAttachments.map(att => (
              <div key={att.id} className="flex justify-between items-center bg-card p-2 rounded-xl border border-border shadow-sm">
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

        <div className="flex flex-col gap-3 px-1">
          <div className="flex flex-wrap gap-2">
            {newTags.map((tag: string) => (
              <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                <Hash className="w-2.5 h-2.5" />
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive transition-colors">
                  <CloseIcon className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="relative max-w-xs">
            <input
              type="text"
              placeholder="Add tags... (Press Enter)"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowTagSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              className="w-full bg-card/50 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 ring-primary/30 transition-all"
            />
            {showTagSuggestions && tagInput && (
              <TagSuggestions 
                query={tagInput}
                allTags={allTags}
                onSelect={addTag}
                onClose={() => setShowTagSuggestions(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {tasks.map((task: DecryptedItem) => {
            const payload = task.payload as TaskPayload;
            const isCompleted = optimisticStatus[task.id] !== undefined ? optimisticStatus[task.id] : payload.isCompleted;
            const dueStatus = getDueStatus(payload.dueDate);

            return (
              <ContainerItem 
                key={task.id} 
                item={task} 
                onUpdate={async (updated) => updateItem(updated.id, updated)}
                onDelete={deleteItem}
              >
                <div className="flex flex-col gap-2">
                  <div 
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={() => toggleTask(task)}
                  >
                    <button className="flex-shrink-0 text-muted-foreground hover:text-green-500 transition-colors mt-0.5">
                      {isCompleted ? (
                         <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                         <Circle className="w-5 h-5 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                    <span className={`font-medium transition-all duration-300 flex-1 ${isCompleted ? 'line-through text-muted-foreground opacity-70' : 'text-foreground'}`}>
                      {payload.title}
                    </span>
                  </div>

                  {dueStatus && !isCompleted && (
                    <div className={`flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${dueStatus.color}`}>
                      <dueStatus.icon className="w-3 h-3" />
                      {dueStatus.label}
                    </div>
                  )}
                </div>
              </ContainerItem>
            )
          })}
          {tasks.length === 0 && (
            <motion.div initial={{ opacity:0 }} animate={{opacity:1}} className="text-center py-20 text-muted-foreground">
              <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All caught up!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
