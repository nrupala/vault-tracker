import { useMemo } from 'react';
import { useItems } from '../hooks/useItems';
import { BarChart3, TrendingUp, CheckCircle2, Flame, Award, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export function AnalyticsApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items } = useItems(vaultId, encryptionKey);

  const stats = useMemo(() => {
    const tasks = items.filter(i => i.type === 'task');
    const habits = items.filter(i => i.type === 'habit');
    const notes = items.filter(i => i.type === 'note');

    const completedTasks = tasks.filter(t => (t.payload as any).isCompleted).length;
    const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const totalStreaks = habits.reduce((acc, h) => acc + ((h.payload as any).streak || 0), 0);
    const avgStreak = habits.length > 0 ? Math.round(totalStreaks / habits.length) : 0;
    const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => (h.payload as any).streak || 0)) : 0;

    const priorityDist = tasks.reduce((acc: any, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});

    return {
      totalItems: items.length,
      taskStats: { total: tasks.length, completed: completedTasks, rate: taskCompletionRate },
      habitStats: { total: habits.length, avgStreak, maxStreak },
      noteCount: notes.length,
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
            <h3 className="font-bold text-lg">Task Priorities</h3>
          </div>
          <div className="space-y-4">
            {['critical', 'high', 'medium', 'low'].map(p => {
              const count = stats.priorityDist[p] || 0;
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

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
            <Shield className="w-16 h-16 text-primary/20 mb-4" />
            <h3 className="font-bold text-xl mb-2">Zero-Trust Intelligence</h3>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              All analytics are calculated on-device. No data ever leaves your browser. Your habits and productivity patterns remain 100% private to you.
            </p>
        </div>
      </div>
    </div>
  );
}
