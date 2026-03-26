import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, KeyRound, Plus, Github, Heart } from 'lucide-react';
import { ThemeProvider } from './components/ThemeProvider';
import { useVault, VaultProvider } from '@/lib/core';
import { NotesApp } from './components/NotesApp';
import { TasksApp } from './components/TasksApp';
import { HabitsApp } from './components/HabitsApp';
import { AnalyticsApp } from './components/AnalyticsApp';
import { CalendarApp } from './components/CalendarApp';
import { LedgerApp } from './components/LedgerApp';
import { AboutApp } from './components/AboutApp';
import { AppShell, ActiveTab } from './components/AppShell';
import { ConfirmModal } from './components/ConfirmModal';

function VaultManager({ onUnlock }: { onUnlock: () => void }) {
  const { vaults, loadVaults, createVault, unlockVault, deleteVault } = useVault();
  const [mode, setMode] = useState<'unlock' | 'create' | 'delete'>('unlock');
  const [vaultName, setVaultName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  useEffect(() => {
    if (vaults.length > 0 && !selectedVaultId && mode !== 'create') {
      setSelectedVaultId(vaults[0].id);
    }
    if (vaults.length === 0) {
      setMode('create');
    }
  }, [vaults, selectedVaultId, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'create') {
        if (!vaultName || !password) throw new Error('Name and password required');
        await createVault(vaultName, password);
        onUnlock();
      } else if (mode === 'unlock') {
        if (!selectedVaultId || !password) throw new Error('Password required');
        await unlockVault(selectedVaultId, password);
        onUnlock();
      } else if (mode === 'delete') {
        if (!selectedVaultId || !password) throw new Error('Password required to delete');
        // Show the custom confirm modal instead of window.confirm()
        setShowDeleteConfirm(true);
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    setLoading(true);
    try {
      await deleteVault(selectedVaultId, password);
      setMode('unlock');
      setPassword('');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Delete failed. Wrong password?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card p-8 rounded-2xl shadow-xl border border-border"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Vault Tracker</h1>
            <p className="text-muted-foreground text-sm mt-1">Zero-Trust Encrypted Workspace</p>
            <span className="text-[10px] text-muted-foreground/40 font-mono mt-2 uppercase tracking-widest">v1.1.0 Mobile + Data Import Ed.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {mode === 'create' ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium">Vault Name</label>
                  <input
                    type="text"
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                    placeholder="e.g. Personal"
                    required
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium">Select Vault</label>
                  <select
                    value={selectedVaultId}
                    onChange={(e) => setSelectedVaultId(e.target.value)}
                    className="w-full bg-background text-foreground border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    {vaults.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {mode === 'delete' ? 'Confirm Master Password to Wipe Vault' : 'Master Password'}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background text-foreground border border-border pl-10 pr-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            {error && <p className="text-destructive text-sm font-medium">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${mode === 'delete' ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'} text-primary-foreground font-medium py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2 mt-6`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'create' ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {mode === 'create' ? 'Create Secure Vault' : mode === 'delete' ? 'Wipe Vault Permanently' : 'Unlock Vault'}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 flex flex-col gap-3">
            {mode === 'unlock' ? (
              <button 
                onClick={() => { setMode('create'); setPassword(''); setError(''); }}
                className="text-sm font-semibold text-primary hover:underline transition-all text-center"
              >
                Need a new vault? Create one here
              </button>
            ) : (
              <button 
                onClick={() => { setMode('unlock'); setPassword(''); setError(''); setShowAdvanced(false); }}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-all text-center"
              >
                Back to Unlock
              </button>
            )}

            {!showAdvanced && mode === 'unlock' && (
              <button 
                onClick={() => setShowAdvanced(true)}
                className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/40 hover:text-destructive transition-all text-center mt-4"
              >
                Advanced: Manage Vaults
              </button>
            )}

            {showAdvanced && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl mt-2 space-y-3"
              >
                <p className="text-[10px] text-red-500/60 font-bold uppercase text-center leading-tight">
                  Danger Zone: These actions are permanent
                </p>
                <button 
                  onClick={() => { setMode('delete'); setPassword(''); setError(''); }}
                  className="w-full py-2 bg-red-500/10 text-red-500 text-xs font-black rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                >
                  WIPE / DELETE VAULT
                </button>
                <button 
                  onClick={() => setShowAdvanced(false)}
                  className="w-full text-[10px] font-bold text-muted-foreground"
                >
                  Hide Advanced Options
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Intro Banner - Only on Login */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="bg-card/50 backdrop-blur-sm border border-border p-6 rounded-2xl space-y-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Security Model
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              VaultTracker uses **AES-256-GCM** encryption locally in your browser. Your data never leaves your device unencrypted. Zero-trust, zero-knowledge, and 100% private.
            </p>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border p-6 rounded-2xl space-y-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-500" /> Financial Intelligence
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Advanced spending analysis helps you track Needs vs. Wants with proactive alerts on category spikes. All processed entirely on your machine.
            </p>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-center gap-6 pt-4">
            <a href="https://github.com/nrupala/vault-tracker" target="_blank" className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <Github className="w-4 h-4" /> View Source on GitHub
            </a>
            <a href="https://buymeacoffee.com/nrupalakolt" target="_blank" className="text-xs font-bold text-[#FFDD00] hover:scale-105 transition-transform flex items-center gap-2">
              <Heart className="w-4 h-4 fill-red-500 text-red-500" /> Buy Me a Coffee
            </a>
            <div className="text-[10px] font-bold tracking-widest uppercase opacity-40 flex items-center gap-2">
              Made in Canada <span className="text-red-500">🍁</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Vault Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Vault Permanently?"
        message="This will permanently delete ALL encrypted data in this vault. This action cannot be undone and your data will be unrecoverable."
        confirmLabel="Wipe Vault"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}

function MainApp() {
  const { activeVault, encryptionKey, isLocked } = useVault();
  const [activeTab, setActiveTab] = useState<ActiveTab>('notes');

  if (isLocked || !activeVault || !encryptionKey) {
    return <VaultManager onUnlock={() => { }} />;
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)}>
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        {activeTab === 'notes' && <NotesApp vaultId={activeVault.id} encryptionKey={encryptionKey} />}
        {activeTab === 'tasks' && <TasksApp vaultId={activeVault.id} encryptionKey={encryptionKey} />}
        {activeTab === 'habits' && <HabitsApp vaultId={activeVault.id} encryptionKey={encryptionKey} />}
        {activeTab === 'analytics' && <AnalyticsApp vaultId={activeVault.id} encryptionKey={encryptionKey} />}
        {activeTab === 'calendar' && <CalendarApp vaultId={activeVault.id} encryptionKey={encryptionKey} />}
        {activeTab === 'ledger' && <LedgerApp vaultId={activeVault.id} encryptionKey={encryptionKey} />}
        {activeTab === 'about' && <AboutApp />}
      </motion.div>
    </AppShell>
  );
}

function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <MainApp />
      </VaultProvider>
    </ThemeProvider>
  );
}

export default App;
