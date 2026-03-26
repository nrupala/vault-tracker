import { Shield, Github, Heart, Lock, Mic, RefreshCcw, History, Trash2, Calendar, Share2 } from 'lucide-react';
import { useVault, useSettings } from '@/lib/core';

export function AboutApp() {
  const { activeVault } = useVault();
  const { settings, updateSettings } = useSettings(activeVault?.id);
  return (
    <div className="max-w-3xl mx-auto space-y-12 py-10">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-primary/10 rounded-3xl mb-4">
          <Shield className="w-16 h-16 text-primary" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter">Vault Tracker v1.1.0</h2>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          Sync with Your Keys. Retain Your Sovereignty.. High-fidelity mobile experience with cross-format data portability.
        </p>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 text-left">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Security Model
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every piece of data—your notes, tasks, habits, and financial records—is encrypted locally in your browser using **AES-256-GCM**. 
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 text-left">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Mic className="w-5 h-5 text-pink-500" /> Voice-to-Vault
          </h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground italic">"Task [Title]" / "Expense [Amount]"</p>
            <p>Rapid, hands-free entry using local-only semantic parsing. No voice data ever leaves your device.</p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 text-left">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-blue-500" /> Sovereign Sync
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Connect any **Universal Provider** (GDrive, WebDAV, Local FS). Sync data as **encrypted blobs**, ensuring zero exposure to the cloud.
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 text-left">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" /> Calendar Bible
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            High-fidelity organization. Your calendar is your Bible—now with **Safe-Point Versioning** to ensure your schedule is never lost.
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4 text-left md:col-span-2">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-purple-500" /> Data Retention Policy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                <span>History Limit</span>
                <span className="text-primary">{settings?.historyLimit} versions</span>
              </div>
              <input 
                type="range" min="1" max="50" 
                value={settings?.historyLimit || 5} 
                onChange={(e) => updateSettings({ historyLimit: parseInt(e.target.value) })}
                className="w-full accent-primary" 
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                <span>Age Purge</span>
                <span className="text-primary">{settings?.retentionDays} days</span>
              </div>
              <input 
                type="range" min="1" max="365" 
                value={settings?.retentionDays || 30} 
                onChange={(e) => updateSettings({ retentionDays: parseInt(e.target.value) })}
                className="w-full accent-primary" 
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">
                <Trash2 className="w-3.5 h-3.5 text-red-500" /> Auto-Archive
              </div>
              <button 
                onClick={() => updateSettings({ autoArchiveCompleted: !settings?.autoArchiveCompleted })}
                className={`w-10 h-5 rounded-full transition-colors relative ${settings?.autoArchiveCompleted ? 'bg-primary' : 'bg-border'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings?.autoArchiveCompleted ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-10 border-t border-border/50 text-center space-y-8">
        <div className="flex justify-center items-center gap-2 text-sm font-semibold text-muted-foreground">
          Built with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> by 
          <span className="text-foreground">Vault Tracker Makers</span>
        </div>

        <div className="flex flex-col items-center gap-6">
          <a href="https://buymeacoffee.com/nrupalakolt" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[#FFDD00] text-black px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-105 transition-transform">
            ☕ Buy me a coffee
          </a>

          <div className="flex justify-center gap-4">
             <a href="https://github.com/nrupala/vault-tracker" target="_blank" className="flex items-center gap-2 p-3 bg-secondary rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-sm font-bold">
               <Github className="w-6 h-6" /> View Source on GitHub
             </a>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-[10px] font-bold tracking-widest uppercase opacity-40 flex justify-center items-center gap-2">
            Proudly Built in Canada <span className="text-red-500 text-base">🍁</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase font-bold tracking-[0.2em] text-muted-foreground/50">Copyrights</p>
            <p className="font-bold text-lg text-muted-foreground/80">© 2026 Nrupal Akolkar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
