import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Upload, TrendingDown, TrendingUp, Wallet, Tag, FileText, Search } from 'lucide-react';
import { useItems, type DecryptedItem } from '@/lib/core';
import { format } from 'date-fns';
import Papa from 'papaparse';

interface ExpensePayload {
  description: string;
  amount: number;
  entryType: 'debit' | 'credit';
  category: string;
  notes: string;
  classification?: 'need' | 'want';
}

interface LedgerAppProps {
  vaultId: string;
  encryptionKey: CryptoKey;
}

const CURATED_CATEGORIES = [
  'Utilities', 'Eating Out', 'Grocery', 'Travel', 'Fuel', 
  'Housing', 'Insurance', 'Health', 'Entertainment', 'Subscriptions', 'General'
];

export function LedgerApp({ vaultId, encryptionKey }: LedgerAppProps) {
  const { items, createItem, exportData } = useItems(vaultId, encryptionKey);

  // Wire up the sidebar Export buttons
  useEffect(() => {
    const handleExport = (e: any) => exportData((e as CustomEvent).detail);
    window.addEventListener('vault-export', handleExport);
    return () => window.removeEventListener('vault-export', handleExport);
  }, [exportData]);

  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [entryType, setEntryType] = useState<'debit' | 'credit'>('debit');
  const [newCategory, setNewCategory] = useState('General');
  const [newClassification, setNewClassification] = useState<'need' | 'want'>('need');
  const [newNotes, setNewNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const expenseItems = useMemo(() => {
    const list = items
      .filter((item: DecryptedItem) => item.type === 'expense')
      .map((item: DecryptedItem) => ({
        ...item,
        payload: item.payload as ExpensePayload
      }))
      .sort((a, b) => a.createdAt - b.createdAt); // Order by creation for standing balance

    let runningBalance = 0;
    return list.map((item: DecryptedItem & { payload: ExpensePayload }) => {
      if (item.payload.entryType === 'credit') {
        runningBalance += item.payload.amount;
      } else {
        runningBalance -= item.payload.amount;
      }
      return { ...item, balance: runningBalance };
    }).reverse(); // Show latest at top in UI
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription || !newAmount) return;

    await createItem('expense', {
      description: newDescription,
      amount: parseFloat(newAmount),
      entryType,
      category: newCategory,
      classification: newClassification,
      notes: newNotes
    }, [newCategory, newClassification].filter(Boolean));

    setNewDescription('');
    setNewAmount('');
    setNewCategory('General');
    setNewClassification('need');
    setNewNotes('');
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        for (const row of results.data as any) {
          const amount = parseFloat(row.Amount || row.amount || 0);
          if (isNaN(amount)) continue;

          await createItem('expense', {
            description: row.Description || row.description || 'Imported Transaction',
            amount: Math.abs(amount),
            entryType: amount >= 0 ? 'credit' : 'debit',
            category: row.Category || row.category || 'Imported',
            classification: 'need', // Default for imports
            notes: row.Notes || row.notes || ''
          }, [row.Category || row.category, 'need'].filter(Boolean));
        }
      }
    });
  };

  const totals = useMemo(() => {
    return expenseItems.reduce((acc: { income: number; expenses: number }, item: DecryptedItem & { payload: ExpensePayload }) => {
      if (item.payload.entryType === 'credit') acc.income += item.payload.amount;
      else acc.expenses += item.payload.amount;
      return acc;
    }, { income: 0, expenses: 0 } as { income: number; expenses: number });
  }, [expenseItems]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 pb-20">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Net Balance</p>
            <p className={`text-2xl font-black ${(totals.income - totals.expenses) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${(totals.income - totals.expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-500/10 rounded-xl text-green-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Income</p>
            <p className="text-2xl font-black text-green-500">
              +${totals.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Expenses</p>
            <p className="text-2xl font-black text-red-500">
              -${totals.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Manual Entry Form */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Description</label>
              <input 
                type="text" 
                placeholder="Grocery shopping, Salary, Rent..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl pl-8 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Type</label>
              <div className="flex bg-secondary/50 rounded-xl p-1 border border-border/50">
                <button 
                  type="button"
                  onClick={() => setEntryType('debit')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${entryType === 'debit' ? 'bg-red-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  DEBIT
                </button>
                <button 
                  type="button"
                  onClick={() => setEntryType('credit')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${entryType === 'credit' ? 'bg-green-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  CREDIT
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Category
              </label>
              <select 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary"
              >
                {CURATED_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1 flex items-center gap-1">
                Classification
              </label>
              <div className="flex bg-secondary/50 rounded-xl p-1 border border-border/50">
                <button 
                  type="button"
                  onClick={() => setNewClassification('need')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-tighter transition-all ${newClassification === 'need' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  NEED
                </button>
                <button 
                  type="button"
                  onClick={() => setNewClassification('want')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-tighter transition-all ${newClassification === 'want' ? 'bg-amber-500 text-white shadow-sm' : 'text-muted-foreground'}`}
                >
                  WANT
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Notes
              </label>
              <input 
                type="text" 
                placeholder="Optional notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-end">
              <button 
                type="submit"
                className="w-full bg-primary text-primary-foreground font-black py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> ADD TO LEDGER
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search Ledger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
              <Upload className="w-4 h-4" />
              IMPORT CSV
              <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
            </label>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('vault-export', { detail: 'csv' }))}
              className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              EXPORT CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-[10px] uppercase tracking-[0.2em] font-black border-b border-border">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Debit</th>
                <th className="px-6 py-4 text-right">Credit</th>
                <th className="px-6 py-4 text-right bg-primary/5 text-primary">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
               {expenseItems.map((item: DecryptedItem & { payload: ExpensePayload, balance: number }) => {
                const isHighSpend = item.payload.entryType === 'debit' && item.payload.amount > 500;
                return (
                  <tr key={item.id} className={`hover:bg-muted/30 transition-colors group ${isHighSpend ? 'bg-red-500/5' : ''}`}>
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                      {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-secondary rounded-lg text-[10px] font-black uppercase tracking-wider border border-border/50">
                        {item.payload.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.payload.classification && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${item.payload.classification === 'need' ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-500'}`}>
                          {item.payload.classification}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{item.payload.description}</span>
                          {isHighSpend && (
                            <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">
                              HIGH SPEND
                            </span>
                          )}
                        </div>
                        {item.payload.notes && <span className="text-[10px] text-muted-foreground">{item.payload.notes}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.payload.entryType === 'debit' && (
                        <span className="text-sm font-black text-red-500">
                          -${item.payload.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.payload.entryType === 'credit' && (
                        <span className="text-sm font-black text-green-500">
                          +${item.payload.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right bg-primary/5">
                      <span className={`text-sm font-black ${item.balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        ${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {expenseItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-4 opacity-30">
                      <Wallet className="w-16 h-16" />
                      <p className="font-bold">No transactions found in this vault.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Mobile Card Layout */}
          <div className="md:hidden flex flex-col divide-y divide-border/50">
            {expenseItems.map((item: DecryptedItem & { payload: ExpensePayload, balance: number }) => {
              const isHighSpend = item.payload.entryType === 'debit' && item.payload.amount > 500;
              return (
                <div key={item.id} className={`p-4 flex flex-col gap-3 transition-colors ${isHighSpend ? 'bg-red-500/5' : 'hover:bg-muted/30'}`}>
                  {/* Top Row: Description & Amount */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{item.payload.description}</span>
                        {isHighSpend && (
                          <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">
                            HIGH SPEND
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(item.createdAt), 'MMM dd, yyyy • h:mm a')}
                      </span>
                    </div>
                    <span className={`text-sm font-black ${item.payload.entryType === 'debit' ? 'text-red-500' : 'text-green-500'}`}>
                      {item.payload.entryType === 'debit' ? '-' : '+'}${item.payload.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Middle Row: Badges */}
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-secondary rounded-lg text-[10px] font-black uppercase tracking-wider border border-border/50">
                      {item.payload.category}
                    </span>
                    {item.payload.classification && (
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${item.payload.classification === 'need' ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-500'}`}>
                        {item.payload.classification}
                      </span>
                    )}
                  </div>

                  {/* Bottom Row: Notes & Balance */}
                  <div className="flex justify-between items-end mt-1">
                    <div className="flex-1 pr-4">
                      {item.payload.notes && (
                        <p className="text-[11px] text-muted-foreground italic line-clamp-2">"{item.payload.notes}"</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Bal</p>
                      <span className={`text-sm font-black ${item.balance >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        ${item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {expenseItems.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <Wallet className="w-12 h-12 mb-3" />
                <p className="font-bold text-sm">No transactions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
