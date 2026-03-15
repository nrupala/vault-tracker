import { useMemo, useState } from 'react';
import { useItems, type DecryptedItem } from '@vault/core';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Target } from 'lucide-react';

export function CalendarApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items } = useItems(vaultId, encryptionKey);
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, fullDate: null, items: [], heatScore: 0 });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayItems: any[] = [];

      items.forEach((item: DecryptedItem) => {
        if (item.type === 'habit') {
          const history = (item.payload as any).checkedInDays || [];
          const matched = history.some((timestamp: number) => {
            const d = new Date(timestamp);
            return d.getDate() === i && d.getMonth() === month && d.getFullYear() === year;
          });
          if (matched) dayItems.push({ ...item, calendarLabel: item.payload.title });
        } else {
          const d = new Date(item.createdAt);
          if (d.getDate() === i && d.getMonth() === month && d.getFullYear() === year) {
            dayItems.push({ 
              ...item, 
              calendarLabel: item.type === 'note' ? (item.payload as any).title : (item.payload as any).title 
            });
          }
        }
      });

      const score = dayItems.reduce((acc: number, item: any) => {
        if (item.type === 'task' && (item.payload as any).isCompleted) return acc + 2;
        if (item.type === 'habit') return acc + 3;
        if (item.type === 'note') return acc + 1;
        return acc + 1;
      }, 0);

      days.push({ 
        day: i, 
        fullDate: date, 
        items: dayItems,
        heatScore: Math.min(score, 10) 
      });
    }
    
    return days;
  }, [currentDate, items]);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 rounded-xl">
              <CalendarIcon className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
            <p className="text-sm text-muted-foreground">Your schedule, fully private.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-xl shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 font-bold min-w-[140px] text-center">
            {monthName} {year}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[10px] uppercase font-bold text-muted-foreground py-2 tracking-widest">
            {day}
          </div>
        ))}
        
        {calendarData.map((d: any, i: number) => {
          const heatColors = [
            'bg-card',
            'bg-emerald-500/5',
            'bg-emerald-500/10',
            'bg-emerald-500/15',
            'bg-emerald-500/20',
            'bg-emerald-500/25',
            'bg-emerald-500/30',
            'bg-emerald-500/40',
            'bg-emerald-500/50',
            'bg-emerald-500/60',
            'bg-emerald-500/70',
          ];
          const heatClass = d.heatScore ? heatColors[d.heatScore] : 'bg-card';

          return (
            <div 
              key={i} 
              className={`min-h-[120px] border border-border rounded-2xl p-2 transition-all hover:border-primary/30 ${!d.day ? 'opacity-20 border-transparent bg-transparent' : `shadow-sm ${heatClass}`}`}
            >
              {d.day && (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold ${new Date().toDateString() === d.fullDate?.toDateString() ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center -mt-1 -ml-1' : 'text-foreground'}`}>
                      {d.day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {d.items?.slice(0, 3).map((item: any) => (
                      <div 
                        key={item.id} 
                        className={`text-[10px] truncate px-1.5 py-0.5 rounded flex items-center gap-1 font-medium ${
                          item.type === 'task' ? 'bg-green-500/10 text-green-500' :
                          item.type === 'habit' ? 'bg-purple-500/10 text-purple-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}
                      >
                        {item.type === 'task' ? <CheckCircle2 className="w-2.5 h-2.5" /> : 
                         item.type === 'habit' ? <Target className="w-2.5 h-2.5" /> : null}
                        {item.calendarLabel}
                      </div>
                    ))}
                    {(d.items?.length || 0) > 3 && (
                      <div className="text-[9px] text-muted-foreground italic pl-1">
                        +{(d.items?.length || 0) - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
