import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare,
  Calendar,
  Info,
  Menu,
  X,
  Shield,
  Download,
  Upload,
  Lock,
  BarChart3
} from 'lucide-react';
import { useTheme, Theme } from './ThemeProvider';
import { useVault, useItems } from '@/lib/core';

export type ActiveTab = 'notes' | 'tasks' | 'habits' | 'analytics' | 'calendar' | 'ledger' | 'about';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { activeVault, lockVault, encryptionKey } = useVault();
  const { importData } = useItems(activeVault?.id, encryptionKey);
  const [importing, setImporting] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleImport = async (format: 'json' | 'text' | 'ics') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'json' ? '.json' : format === 'ics' ? '.ics' : '.txt,.md';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setImporting(true);
      try {
        const content = await file.text();
        const count = await importData(content, format);
        alert(`Successfully imported ${count} items!`);
      } catch (err: any) {
        alert('Import failed: ' + err.message);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const navItems = [
    { id: 'tasks' as ActiveTab, label: 'Tasks', icon: CheckSquare, color: 'text-green-500' },
    { id: 'analytics' as ActiveTab, label: 'Analytics', icon: BarChart3, color: 'text-orange-500' },
    { id: 'calendar' as ActiveTab, label: 'Calendar', icon: Calendar, color: 'text-rose-500' },
    { id: 'about' as ActiveTab, label: 'About', icon: Info, color: 'text-primary' },
  ];

  return (
    <div className="flex h-dvh bg-background overflow-hidden relative text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 w-64 h-full bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight">Vault</span>
              <span className="text-[10px] text-muted-foreground font-mono">v1.1.0</span>
            </div>
          </div>
          <button onClick={toggleSidebar} className="md:hidden p-1 rounded-md hover:bg-secondary">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {activeVault && (
          <div className="px-6 py-2 shrink-0">
            <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Active Vault</p>
              <p className="font-medium text-sm truncate">{activeVault.name}</p>
            </div>
          </div>
        )}

        {/* Nav — scrollable so it doesn't push footer off screen */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                   onTabChange(item.id);
                   setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive ? 'bg-secondary font-semibold' : 'hover:bg-secondary/50 font-medium text-muted-foreground hover:text-foreground'}`}
              >
                <item.icon className={`w-5 h-5 ${item.color} transition-opacity ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* 
          Sidebar footer: uses max() so on Android/iPhone where the bottom nav is 4rem,
          logout + theme are always visible above it.
          On desktop (md:pb-4) this padding is removed.
        */}
        <div className="p-4 mt-auto border-t border-border space-y-4 shrink-0 pb-[max(calc(env(safe-area-inset-bottom)+1rem),5.5rem)] md:pb-4">
          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Settings</p>
            
            <div className="space-y-1 mb-4">
              <label className="text-[10px] uppercase font-bold text-muted-foreground px-2">Data Management</label>
              <div className="flex flex-col gap-1 px-2 mt-1">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('vault-export', { detail: 'json' }))}
                  className="text-left text-xs py-1.5 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button
                  disabled={importing}
                  onClick={() => handleImport('json')}
                  className="text-left text-xs py-1.5 hover:text-primary transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" /> Import JSON
                </button>
                <button
                  disabled={importing}
                  onClick={() => handleImport('ics')}
                  className="text-left text-xs py-1.5 hover:text-primary transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Calendar className="w-3.5 h-3.5" /> Import Calendar (.ics)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground px-2">Theme</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="w-full bg-secondary border border-border px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="system">System Default</option>
                <option value="light">Light Slate</option>
                <option value="sepia">Vintage Sepia</option>
                <option value="blue">Deep Blue</option>
                <option value="black">Amoled Black</option>
              </select>
            </div>
          </div>

          <button
            onClick={lockVault}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <Lock className="w-4 h-4" />
            Lock Vault
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Header — single height calc, no duplicate h-16 */}
        <header className="flex items-center px-4 md:px-8 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-md hover:bg-secondary mr-4"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight capitalize">{activeTab}</h1>
        </header>

        {/* Scrollable content with enough bottom clearance for mobile nav */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 relative overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto w-full h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/*
          Mobile Bottom Navigation — ALL 7 TABS.
          Horizontally scrollable row so every tab is reachable on narrow phones.
          min-w-[4rem] per tab prevents them from collapsing below a tappable size.
        */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
          <nav className="flex items-center overflow-x-auto h-16 px-1" style={{ scrollbarWidth: 'none' }}>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[4.25rem] flex-1 h-full py-1 px-1 transition-all ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  <div className={`w-10 h-6 flex items-center justify-center rounded-full transition-all ${isActive ? 'bg-primary/20' : ''}`}>
                    <item.icon className={`w-4.5 h-4.5 ${item.color} ${isActive ? 'opacity-100 scale-110' : 'opacity-50'} transition-all`} style={{ width: '1.125rem', height: '1.125rem' }} />
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap leading-none ${isActive ? 'opacity-100' : 'opacity-60'}`}>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </main>
    </div>
  );
}
