import { Shield, Github, Heart, Globe, Lock } from 'lucide-react';

export function AboutApp() {
  return (
    <div className="max-w-3xl mx-auto space-y-12 py-10">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-primary/10 rounded-3xl mb-4">
          <Shield className="w-16 h-16 text-primary" />
        </div>
        <h2 className="text-4xl font-black tracking-tighter">Vault Tracker v1.0</h2>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          The world's most private productivity suite. Zero-trust, zero-knowledge, and 100% yours.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Security Model
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every piece of data—your notes, tasks, habits, and even your tags—is encrypted locally in your browser using **AES-256-GCM**. Your master password never leaves your device.
          </p>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-green-500" /> Decentralized
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No cloud. No database leaks. No tracking. Your data is stored in your browser's IndexedDB. You own the vault; we just provide the tools.
          </p>
        </div>
      </div>

      <div className="pt-10 border-t border-border/50 text-center space-y-6">
        <div className="flex justify-center items-center gap-2 text-sm font-semibold text-muted-foreground">
          Built with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> by 
          <span className="text-foreground">Vault Tracker Makers</span>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase font-bold tracking-[0.2em] text-muted-foreground/50">Copyrights</p>
          <p className="font-bold text-lg">© 2026 Nrupal Akolkar</p>
        </div>

        <div className="flex justify-center gap-4">
           <a href="#" className="p-3 bg-secondary rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
             <Github className="w-6 h-6" />
           </a>
        </div>
      </div>
    </div>
  );
}
