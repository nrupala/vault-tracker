import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, KeyRound, Plus } from 'lucide-react';
import { ThemeProvider } from './components/ThemeProvider';
import { useVault, VaultProvider } from './hooks/useVault';
import { NotesApp } from './components/NotesApp';
import { TasksApp } from './components/TasksApp';
import { HabitsApp } from './components/HabitsApp';
import { AnalyticsApp } from './components/AnalyticsApp';
import { CalendarApp } from './components/CalendarApp';
import { LedgerApp } from './components/LedgerApp';
import { AboutApp } from './components/AboutApp';
import { AppShell, ActiveTab } from './components/AppShell';

function VaultManager({ onUnlock }: { onUnlock: () => void }) {
  const { vaults, loadVaults, createVault, unlockVault, deleteVault } = useVault();
  const [mode, setMode] = useState<'unlock' | 'create' | 'delete'>('unlock');
  const [vaultName, setVaultName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        if (!confirm('CRITICAL WARNING: This will permanently delete ALL data in this vault. This cannot be undone. Are you absolutely sure?')) {
           setLoading(false);
           return;
        }
        await deleteVault(selectedVaultId, password);
        setMode('unlock');
        setPassword('');
        alert('Vault deleted successfully.');
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
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
                  {vaults.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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

        {vaults.length > 0 && (
          <div className="mt-6 flex flex-col gap-2 text-center">
             <button 
               onClick={() => {
                 setMode(mode === 'create' ? 'unlock' : 'create');
                 setError('');
                 setPassword('');
               }}
               className="text-sm text-muted-foreground hover:text-foreground transition-colors"
             >
               {mode === 'create' ? 'Unlock an existing vault' : 'Create a new vault'}
             </button>
             <button 
               onClick={() => {
                 setMode(mode === 'delete' ? 'unlock' : 'delete');
                 setError('');
                 setPassword('');
               }}
               className="text-sm text-destructive/60 hover:text-destructive transition-colors"
             >
               {mode === 'delete' ? 'Cancel' : 'Manage / Delete Vaults'}
             </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function MainApp() {
  const { activeVault, encryptionKey, isLocked } = useVault();
  const [activeTab, setActiveTab] = useState<ActiveTab>('notes');

  if (isLocked || !activeVault || !encryptionKey) {
    return <VaultManager onUnlock={() => {}} />;
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
