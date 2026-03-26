import { Shield, Github, Heart, Lock, Mic, RefreshCcw } from 'lucide-react';

export function AboutApp() {
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
            Connect any **Universal Provider** (Google Drive, OneDrive, S3, WebDAV, or Local FS). Vault Tracker syncs your data as **encrypted blobs**, ensuring zero exposure to the provider.
          </p>
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
