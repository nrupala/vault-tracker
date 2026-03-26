import { useState, useEffect, useRef } from 'react';
import { useItems, type DecryptedItem } from '@/lib/core';
import { ContainerItem, type Attachment } from './ContainerItem';
import { PenLine, Plus, X as CloseIcon, Hash, Mic, Bold, Italic, List, Eye, EyeOff, Paperclip, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TagSuggestions } from './TagSuggestions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NotePayload {
  title: string;
  content: string;
}

export function NotesApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items, allTags, createItem, updateItem, deleteItem, exportData } = useItems(vaultId, encryptionKey);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect if Web Speech API is available (not available on Android Capacitor or some browsers)
  const speechAvailable = typeof window !== 'undefined' && 
    !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;

  useEffect(() => {
    const handleExport = (e: any) => exportData((e as CustomEvent).detail);
    window.addEventListener('vault-export', handleExport);
    return () => window.removeEventListener('vault-export', handleExport);
  }, [exportData]);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const value = newContent;
    const lines = value.split('\n');
    
    // Find current line index
    let currentPos = 0;
    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const nextPos = currentPos + lines[i].length + 1;
        if (start >= currentPos && start <= nextPos) {
            lineIndex = i;
            break;
        }
        currentPos = nextPos;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const currentLine = lines[lineIndex];
      
      if (e.shiftKey) {
        // Outdent
        if (currentLine.startsWith('  ')) {
          lines[lineIndex] = currentLine.substring(2);
          const newValue = lines.join('\n');
          setNewContent(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(0, start - 2);
          }, 0);
        }
      } else {
        // Indent
        lines[lineIndex] = '  ' + currentLine;
        const newValue = lines.join('\n');
        setNewContent(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }

    if (e.key === 'Enter') {
      const currentLine = lines[lineIndex];
      const match = currentLine.match(/^(\s*- )/);
      
      if (match) {
        e.preventDefault();
        const indent = match[1];
        
        // If the line is JUST the bullet, clarify/clear it (Workflowy escape)
        if (currentLine.trim() === '-') {
            lines[lineIndex] = '';
            setNewContent(lines.join('\n'));
            return;
        }

        const before = value.substring(0, start);
        const after = value.substring(start);
        const newValue = before + '\n' + indent + after;
        setNewContent(newValue);
        
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + indent.length + 1;
        }, 0);
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newContent.trim() && newAttachments.length === 0) return;
    
    await createItem('note', { title: newTitle, content: newContent, attachments: newAttachments }, newTags, 'low');
    setNewTitle('');
    setNewContent('');
    setNewTags([]);
    setNewAttachments([]);
    setTagInput('');
    setIsCreating(false);
    setIsPreview(false);
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

  const insertFormat = (prefix: string, suffix: string = '') => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newContent;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    setNewContent(newText);
    
    // Reset focus and selection (rough approximation)
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
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

  const handleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in your browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewContent((prev: string) => prev + (prev ? ' ' : '') + transcript);
      
      // Smart Auto-Title
      if (!newTitle.trim()) {
        const words = transcript.split(' ');
        const autoTitle = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
        setNewTitle(autoTitle.charAt(0).toUpperCase() + autoTitle.slice(1));
      }
    };

    recognition.start();
  };

  const notes = items.filter((i: DecryptedItem) => i.type === 'note');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl">
             <PenLine className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Notes</h2>
            <p className="text-sm text-muted-foreground">Secure, zero-trust notebook.</p>
          </div>
        </div>

        <button 
          onClick={() => setIsCreating(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium tracking-wide flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.form
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            onSubmit={handleCreate}
            className="bg-card p-4 border border-border rounded-xl shadow-lg mb-6 flex flex-col gap-3"
          >
            <div className="flex justify-between items-center mb-1">
              <input
                type="text"
                placeholder="Note Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-transparent text-foreground text-lg font-semibold border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground w-full"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsPreview(!isPreview)}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isPreview ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {isPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {isPreview ? 'Editor' : 'Preview'}
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => insertFormat('**', '**')} className="p-1.5 hover:bg-secondary rounded transition-colors" title="Bold"><Bold className="w-4 h-4" /></button>
                <button type="button" onClick={() => insertFormat('_', '_')} className="p-1.5 hover:bg-secondary rounded transition-colors" title="Italic"><Italic className="w-4 h-4" /></button>
                <button type="button" onClick={() => insertFormat('- ')} className="p-1.5 hover:bg-secondary rounded transition-colors" title="List"><List className="w-4 h-4" /></button>
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

            <div className="relative min-h-[120px]">
              {isPreview ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground p-2">
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{newContent || '*No content to preview*'}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  placeholder="Start typing... (Markdown supported)"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  onKeyDown={handleEditorKeyDown}
                  className="bg-transparent text-foreground border-none focus:outline-none focus:ring-0 resize-none min-h-[120px] placeholder:text-muted-foreground/60 w-full"
                />
              )}
              {!isPreview && (
                <div className="absolute bottom-2 right-2">
                  {speechAvailable ? (
                    <button
                      type="button"
                      onClick={handleVoiceDictation}
                      title="Voice Dictation"
                      className={`p-2 rounded-full transition-all shadow-sm ${
                        isRecording 
                          ? 'bg-red-500 text-white animate-pulse scale-110' 
                          : 'bg-secondary text-muted-foreground hover:bg-primary hover:text-primary-foreground'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Voice dictation requires browser mode (not available in app)"
                      className="p-2 rounded-full bg-secondary/30 text-muted-foreground/30 cursor-not-allowed"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-3 pt-2 border-t border-border/50">
               <div className="flex flex-wrap gap-2">
                 {newTags.map((tag: string) => (
                   <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">
                     <Hash className="w-3 h-3" />
                     {tag}
                     <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive transition-colors">
                       <CloseIcon className="w-3 h-3" />
                     </button>
                   </span>
                 ))}
               </div>

               <div className="relative">
                 <input
                   type="text"
                   placeholder="Add tags... (e.g. work, ideas)"
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
                   className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 ring-primary/20 transition-all"
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

            {newAttachments.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                {newAttachments.map(att => (
                  <div key={att.id} className="flex justify-between items-center bg-secondary/30 p-2 rounded-lg border border-border/30">
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

            <div className="flex justify-end gap-2 mt-2">
              <button 
                type="button" 
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                Save Securely
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <AnimatePresence>
          {notes.map((note: DecryptedItem) => (
            <ContainerItem 
              key={note.id} 
              item={note} 
              onUpdate={async (updated) => updateItem(updated.id, updated)}
              onDelete={deleteItem}
            >
              <div className="flex flex-col">
                 <h3 className="font-semibold text-foreground truncate mb-1 text-lg">
                   {(note.payload as NotePayload).title || 'Untitled Note'}
                 </h3>
                 <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{(note.payload as NotePayload).content}</ReactMarkdown>
                 </div>
              </div>
            </ContainerItem>
          ))}
          {notes.length === 0 && !isCreating && (
            <motion.div initial={{ opacity:0 }} animate={{opacity:1}} className="text-center py-20 text-muted-foreground">
              <PenLine className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No secure notes yet.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
