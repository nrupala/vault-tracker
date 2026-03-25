import { useState, useEffect } from 'react';
import { Share2, Clock, MoreVertical, Trash2, Edit2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecryptedItem } from '@vault/core';

interface ContainerItemProps {
  item: DecryptedItem;
  children: React.ReactNode;
  onUpdate: (item: DecryptedItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ContainerItem({ item, children, onUpdate, onDelete }: ContainerItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPriority, setEditPriority] = useState<DecryptedItem['priority']>(item.priority);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setEditTitle((item.payload as any).title || '');
      setEditContent((item.payload as any).content || (item.payload as any).value || '');
      setEditPriority(item.priority);
    }
  }, [isEditing, item]);

  const handleSave = async () => {
    const updatedPayload = { ...item.payload } as any;
    if ('title' in updatedPayload) updatedPayload.title = editTitle;
    if ('content' in updatedPayload) updatedPayload.content = editContent;
    if ('value' in updatedPayload) updatedPayload.value = editContent;
    
    await onUpdate({ ...item, payload: updatedPayload, priority: editPriority });
    setIsEditing(false);
  };

  const handleCopy = () => {
    const content = (item.payload as any).content || (item.payload as any).title || '';
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  const handleShare = async () => {
    try {
      const shareData = {
        title: (item.payload as any).title || 'Vault Tracker Item',
        text: (item.payload as any).content || (item.payload as any).title || '',
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        alert('Web Share API not supported on this browser.');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
    setShowMenu(false);
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-blue-500/10 text-blue-500',
    medium: 'bg-yellow-500/10 text-yellow-500',
    high: 'bg-orange-500/10 text-orange-500',
    critical: 'bg-red-500/10 text-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-visible"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-2 items-center">
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${priorityColors[item.priority]}`}>
            {item.priority}
          </span>
          {item.tags.map((tag: string) => (
            <span key={tag} className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full font-medium">
              #{tag}
            </span>
          ))}
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary transition-all sm:opacity-50 hover:opacity-100 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-[100] py-1"
              >
                <button 
                  onClick={() => { setIsEditing(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4 text-blue-500" /> Edit
                </button>
                <button 
                  onClick={handleCopy}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-purple-500" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button 
                  onClick={handleShare}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4 text-orange-500" /> Share
                </button>
                <div className="border-t border-border my-1" />
                <button 
                  onClick={() => { onDelete(item.id); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary text-destructive flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div 
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3 pt-2"
          >
            {('title' in (item.payload as any)) && (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none"
                placeholder="Title"
              />
            )}
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm min-h-[80px] focus:outline-none resize-none"
              placeholder="Content"
            />
            {/* Priority selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Priority</label>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high', 'critical'] as const).map((p) => {
                  const colors: Record<string, string> = {
                    low: 'border-blue-500 bg-blue-500/10 text-blue-500',
                    medium: 'border-yellow-500 bg-yellow-500/10 text-yellow-500',
                    high: 'border-orange-500 bg-orange-500/10 text-orange-500',
                    critical: 'border-red-500 bg-red-500/10 text-red-500',
                  };
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`flex-1 px-2 py-1 rounded-lg text-[10px] font-black capitalize border-2 transition-all ${
                        editPriority === p ? colors[p] : 'border-transparent bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 text-xs font-semibold hover:bg-secondary rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-lg"
              >
                Save
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center text-[10px] text-muted-foreground gap-3">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(item.createdAt).toLocaleDateString()}
        </div>
        <div className="flex items-center gap-1 capitalize">
          {item.type}
        </div>
      </div>
    </motion.div>
  );
}
