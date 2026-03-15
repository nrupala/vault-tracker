import { useMemo } from 'react';
import { useItems, type DecryptedItem } from '@vault/core';
import { BarChart3, TrendingUp, CheckCircle2, Flame, Award, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export function AnalyticsApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items } = useItems(vaultId, encryptionKey);

  const stats = useMemo(() => {
    const tasks = items.filter((i: DecryptedItem) => i.type === 'task');
    const habits = items.filter((i: DecryptedItem) => i.type === 'habit');
    const notes = items.filter((i: DecryptedItem) => i.type === 'note');

    const completedTasks = tasks.filter((t: DecryptedItem) => (t.payload as any).isCompleted).length;
    const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const totalStreaks = habits.reduce((acc: number, h: DecryptedItem) => acc + ((h.payload as any).streak || 0), 0);
    const avgStreak = habits.length > 0 ? Math.round(totalStreaks / habits.length) : 0;
    const maxStreak = habits.length > 0 ? Math.max(...habits.map((h: DecryptedItem) => (h.payload as any).streak || 0)) : 0;

    const priorityDist = tasks.reduce((acc: Record<string, number>, t: DecryptedItem) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const expenses = items.filter((i: DecryptedItem) => i.type === 'expense');
    const debits = expenses.filter((e: DecryptedItem) => (e.payload as any).entryType === 'debit');
    const incomeTotal = expenses.filter((e: DecryptedItem) => (e.payload as any).entryType === 'credit').reduce((acc: number, e: DecryptedItem) => acc + (e.payload as any).amount, 0);
    const expenseTotal = debits.reduce((acc: number, e: DecryptedItem) => acc + (e.payload as any).amount, 0);

    const needsTotal = debits.filter((e: DecryptedItem) => (e.payload as any).classification === 'need').reduce((acc: number, e: DecryptedItem) => acc + (e.payload as any).amount, 0);
    const wantsTotal = debits.filter((e: DecryptedItem) => (e.payload as any).classification === 'want').reduce((acc: number, e: DecryptedItem) => acc + (e.payload as any).amount, 0);

    // Anomaly Detection: Categories taking > 30% of total expenses or having huge individual hits
    const catTotals = debits.reduce((acc: Record<string, number>, e: DecryptedItem) => {
      const cat = (e.payload as any).category || 'General';
      acc[cat] = (acc[cat] || 0) + (e.payload as any).amount;
      return acc;
    }, {} as Record<string, number>);

    const spikes = Object.entries(catTotals)
      .filter(([_, total]) => (total as number) > (expenseTotal * 0.3) && expenseTotal > 0)
      .map(([cat, _]) => cat);

    return {
      totalItems: items.length,
      taskStats: { total: tasks.length, completed: completedTasks, rate: taskCompletionRate },
      habitStats: { total: habits.length, avgStreak, maxStreak },
      noteCount: notes.length,
      financeStats: { 
        income: incomeTotal, 
        expenses: expenseTotal, 
        net: incomeTotal - expenseTotal,
        needs: needsTotal,
        wants: wantsTotal,
        spikes
      },
      priorityDist
    };
  }, [items]);

  const cards = [
    { 
      label: 'Task Completion', 
      value: `${stats.taskStats.rate}%`, 
      sub: `${stats.taskStats.completed} / ${stats.taskStats.total} done`,
      icon: CheckCircle2,
      color: 'bg-green-500/10 text-green-500'
    },
    { 
      label: 'Habit Consistency', 
      value: stats.habitStats.maxStreak.toString(), 
      sub: `Max day streak`,
      icon: Flame,
      color: 'bg-orange-500/10 text-orange-500'
    },
    { 
      label: 'Knowledge Base', 
      value: stats.noteCount.toString(), 
      sub: `Encrypted notes`,
      icon: Zap,
      color: 'bg-blue-500/10 text-blue-500'
    },
    { 
      label: 'Vault Capacity', 
      value: stats.totalItems.toString(), 
      sub: `Total objects`,
      icon: Award,
      color: 'bg-purple-500/10 text-purple-500'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-orange-500/10 rounded-xl">
            <BarChart3 className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">Insights from your local data, encrypted and private.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`p-2 rounded-lg w-fit mb-4 transition-transform group-hover:scale-110 ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <h3 className="text-3xl font-bold mt-1 tracking-tight">{card.value}</h3>
            <p className="text-xs text-muted-foreground/60 mt-1 font-medium italic">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Behavioral Balance</h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-primary font-black">Essentials (Needs)</span>
                <span>${stats.financeStats.needs.toLocaleString()}</span>
              </div>
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden flex">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.financeStats.expenses > 0 ? (stats.financeStats.needs / stats.financeStats.expenses) * 100 : 0}%` }}
                  className="h-full bg-primary"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-amber-500 font-black">Discretionary (Wants)</span>
                <span>${stats.financeStats.wants.toLocaleString()}</span>
              </div>
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden flex">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.financeStats.expenses > 0 ? (stats.financeStats.wants / stats.financeStats.expenses) * 100 : 0}%` }}
                  className="h-full bg-amber-500"
                />
              </div>
            </div>
            
            {stats.financeStats.spikes.length > 0 && (
              <div className="mt-6 p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                <div className="flex items-center gap-2 mb-2 text-red-500 font-black text-[10px] uppercase tracking-widest">
                  <TrendingUp className="w-4 h-4" /> Financial Alerts
                </div>
                <div className="space-y-1">
                  {stats.financeStats.spikes.map((cat: string) => (
                    <p key={cat} className="text-xs font-medium text-red-600">
                      ⚠️ Spike detected in <span className="font-black uppercase">{cat}</span> ({'>'}30% of spend).
                    </p>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Recommendation: Review large transactions in these categories.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Task Priorities</h3>
          </div>
          <div className="space-y-4">
            {['critical', 'high', 'medium', 'low'].map(p => {
              const count = (stats.priorityDist as Record<string, number>)[p] || 0;
              const percent = stats.taskStats.total > 0 ? Math.round((count / stats.taskStats.total) * 100) : 0;
              const pColors: any = {
                critical: 'bg-red-500',
                high: 'bg-orange-500',
                medium: 'bg-yellow-500',
                low: 'bg-blue-500'
              };
              return (
                <div key={p} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-muted-foreground">{p}</span>
                    <span>{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      className={`h-full ${pColors[p]}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border p-8 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-6">
          <div className="flex-1">
            <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Zero-Trust Intelligence
            </h3>
            <p className="text-sm text-muted-foreground">
              All analytics are calculated on-device. No data ever leaves your browser. Your habits, tasks, and financial patterns remain 100% private.
            </p>
          </div>
          <div className="bg-primary/10 px-6 py-4 rounded-2xl border border-primary/20">
            <p className="text-[10px] uppercase font-bold text-primary mb-1">Total Vault Objects</p>
            <p className="text-3xl font-black text-primary">{stats.totalItems}</p>
          </div>
      </div>
    </div>
  );
}
