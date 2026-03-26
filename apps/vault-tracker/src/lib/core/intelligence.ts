import { DecryptedItem } from './useItems';

export interface Recommendation {
  id: string;
  type: 'security' | 'financial' | 'productivity' | 'habit';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export function deriveRecommendations(items: DecryptedItem[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 1. Financial Intelligence (Ledger)
  const expenses = items.filter(i => i.type === 'expense');
  if (expenses.length > 0) {
    const wants = expenses.filter(i => i.payload.classification === 'want');
    const totalWants = wants.reduce((sum, i) => sum + (i.payload.amount || 0), 0);
    const totalSpent = expenses.reduce((sum, i) => sum + (i.payload.amount || 0), 0);

    if (totalSpent > 0 && (totalWants / totalSpent) > 0.4) {
      recommendations.push({
        id: 'fin-01',
        type: 'financial',
        title: 'High Discretionary Spending',
        description: 'Your "Wants" account for over 40% of your total spending. Consider reviewing your subscriptions.',
        priority: 'high'
      });
    }
  }

  // 2. Productivity Intelligence (Tasks)
  const tasks = items.filter(i => i.type === 'task' && i.payload.status === 'todo');
  const overdueTasks = tasks.filter(t => t.payload.dueDate && new Date(t.payload.dueDate).getTime() < Date.now());
  
  if (overdueTasks.length > 3) {
    recommendations.push({
      id: 'prod-01',
      type: 'productivity',
      title: 'Task Overload',
      description: `You have ${overdueTasks.length} overdue tasks. Consider rescheduling or delegating some items.`,
      priority: 'medium'
    });
  }

  // 3. Habit Intelligence (Habits)
  const habits = items.filter(i => i.type === 'habit');
  const lowStreaks = habits.filter(h => (h.payload.streak || 0) < 3);
  
  if (habits.length > 0 && lowStreaks.length / habits.length > 0.6) {
    recommendations.push({
      id: 'habit-01',
      type: 'habit',
      title: 'Consistency Opportunity',
      description: 'More than 60% of your habits have a streak under 3 days. Focusing on one key habit might help.',
      priority: 'low'
    });
  }

  // 4. Security Intelligence (Meta)
  if (items.length > 100) {
    recommendations.push({
      id: 'sec-01',
      type: 'security',
      title: 'Maintenance Recommended',
      description: 'Your vault has over 100 items. Periodic exports are recommended to ensure data safety.',
      priority: 'medium'
    });
  }

  return recommendations;
}
