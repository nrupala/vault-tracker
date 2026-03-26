import { useMemo, useState, useCallback } from 'react';
import { useItems, type DecryptedItem } from '@/lib/core';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Target, Plus, X, FileText, CheckSquare, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'month' | 'week' | 'work-week' | 'day';

interface QuickCreateState {
  isOpen: boolean;
  date: Date | null;
  type: 'note' | 'task' | 'habit';
  title: string;
}

export function CalendarApp({ vaultId, encryptionKey }: { vaultId: string, encryptionKey: CryptoKey }) {
  const { items, createItem } = useItems(vaultId, encryptionKey);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>({
    isOpen: false, date: null, type: 'task', title: ''
  });

  // Helper: get items for a specific date
  const getItemsForDate = useCallback((date: Date): any[] => {
    const dayItems: any[] = [];
    const d = date.getDate(), m = date.getMonth(), y = date.getFullYear();

    items.forEach((item: DecryptedItem) => {
      if (item.type === 'habit') {
        // Habits are matched by their check-in history
        const history = (item.payload as any).checkedInDays || [];
        const matched = history.some((timestamp: number) => {
          const dt = new Date(timestamp);
          return dt.getDate() === d && dt.getMonth() === m && dt.getFullYear() === y;
        });
        if (matched) dayItems.push({ ...item, calendarLabel: item.payload.title });
      } else if (item.type === 'task') {
        // Tasks: prefer dueDate from payload, fall back to createdAt
        const dueDate = (item.payload as any).dueDate;
        const ts = dueDate ? dueDate : item.createdAt;
        const dt = new Date(ts);
        if (dt.getDate() === d && dt.getMonth() === m && dt.getFullYear() === y) {
          dayItems.push({ ...item, calendarLabel: (item.payload as any).title });
        }
      } else {
        // Notes use createdAt
        const dt = new Date(item.createdAt);
        if (dt.getDate() === d && dt.getMonth() === m && dt.getFullYear() === y) {
          dayItems.push({ ...item, calendarLabel: (item.payload as any).title });
        }
      }
    });
    return dayItems;
  }, [items]);

  // Helper: compute heat score
  const getHeatScore = (dayItems: any[]): number => {
    return Math.min(dayItems.reduce((acc: number, item: any) => {
      if (item.type === 'task' && (item.payload as any).isCompleted) return acc + 2;
      if (item.type === 'habit') return acc + 3;
      if (item.type === 'note') return acc + 1;
      return acc + 1;
    }, 0), 10);
  };

  // ===== MONTH VIEW DATA =====
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, fullDate: null, items: [], heatScore: 0 });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayItems = getItemsForDate(date);
      days.push({ day: i, fullDate: date, items: dayItems, heatScore: getHeatScore(dayItems) });
    }
    return days;
  }, [currentDate, items]);

  // ===== WEEK VIEW DATA =====
  const weekData = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayItems = getItemsForDate(date);
      days.push({ day: date.getDate(), fullDate: date, items: dayItems, heatScore: getHeatScore(dayItems) });
    }
    return days;
  }, [currentDate, items]);

  // ===== WORK WEEK VIEW DATA =====
  const workWeekData = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    // Go to previous Monday (or keep today if Monday)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
    const days = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayItems = getItemsForDate(date);
      days.push({ day: date.getDate(), fullDate: date, items: dayItems, heatScore: getHeatScore(dayItems) });
    }
    return days;
  }, [currentDate, items]);

  // ===== DAY VIEW DATA =====
  const dayData = useMemo(() => {
    const dayItems = getItemsForDate(currentDate);
    return { day: currentDate.getDate(), fullDate: currentDate, items: dayItems, heatScore: getHeatScore(dayItems) };
  }, [currentDate, items]);

  // Navigation
  const navigate = (direction: number) => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + direction);
    else if (viewMode === 'week') d.setDate(d.getDate() + (direction * 7));
    else d.setDate(d.getDate() + direction);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  // Quick Create
  const openQuickCreate = (date: Date) => {
    setQuickCreate({ isOpen: true, date, type: 'task', title: '' });
  };

  const handleQuickCreate = async () => {
    if (!quickCreate.title.trim() || !quickCreate.date) return;
    const ts = quickCreate.date.getTime();
    let payload: any;

    if (quickCreate.type === 'note') {
      payload = { title: quickCreate.title, content: '', format: 'markdown' };
    } else if (quickCreate.type === 'task') {
      payload = { title: quickCreate.title, isCompleted: false, dueDate: ts };
    } else {
      payload = { title: quickCreate.title, checkedInDays: [], frequency: 'daily' };
    }

    await createItem(quickCreate.type, payload);
    setQuickCreate({ isOpen: false, date: null, type: 'task', title: '' });
  };

  // Format header label
  const getHeaderLabel = () => {
    if (viewMode === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    if (viewMode === 'work-week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 4);
      return `${start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const heatColors = [
    'bg-card', 'bg-emerald-500/5', 'bg-emerald-500/10', 'bg-emerald-500/15',
    'bg-emerald-500/20', 'bg-emerald-500/25', 'bg-emerald-500/30', 'bg-emerald-500/40',
    'bg-emerald-500/50', 'bg-emerald-500/60', 'bg-emerald-500/70',
  ];

  const isToday = (date: Date | null) => date ? new Date().toDateString() === date.toDateString() : false;

  // ===== Render a single day cell =====
  const renderDayCell = (d: any, compact: boolean = false) => {
    const heatClass = d.heatScore ? heatColors[d.heatScore] : 'bg-card';
    const minH = compact ? 'min-h-[80px]' : 'min-h-[100px] sm:min-h-[120px]';

    return (
      <div
        key={d.fullDate?.toISOString() || Math.random()}
        className={`${minH} border border-border rounded-2xl p-2 transition-all hover:border-primary/30 relative group ${!d.day ? 'opacity-20 border-transparent bg-transparent' : `shadow-sm ${heatClass}`}`}
      >
        {d.day && (
          <>
            <div className="flex justify-between items-start mb-1">
              <span className={`text-xs sm:text-sm font-bold ${isToday(d.fullDate) ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center' : 'text-foreground'}`}>
                {d.day}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); openQuickCreate(d.fullDate!); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-secondary transition-all"
                title="Add item"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-0.5">
              {d.items?.slice(0, compact ? 2 : 3).map((item: any) => (
                <div
                  key={item.id}
                  className={`text-[9px] sm:text-[10px] truncate px-1 py-0.5 rounded flex items-center gap-1 font-medium ${
                    item.type === 'task' ? 'bg-green-500/10 text-green-500' :
                    item.type === 'habit' ? 'bg-purple-500/10 text-purple-500' :
                    'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {item.type === 'task' ? <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> :
                   item.type === 'habit' ? <Target className="w-2.5 h-2.5 shrink-0" /> : null}
                  <span className="truncate">{item.calendarLabel}</span>
                </div>
              ))}
              {(d.items?.length || 0) > (compact ? 2 : 3) && (
                <div className="text-[9px] text-muted-foreground italic pl-1">
                  +{(d.items?.length || 0) - (compact ? 2 : 3)} more
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 rounded-xl">
            <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Calendar</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Your schedule, fully private.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* View Mode Toggle */}
          <div className="flex bg-secondary border border-border rounded-xl overflow-hidden text-xs font-bold">
            {(['month', 'week', 'work-week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-2 capitalize transition-colors ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-xl shadow-sm">
            <button onClick={() => navigate(-1)} className="p-1.5 sm:p-2 hover:bg-secondary rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button onClick={goToToday} className="px-2 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider hover:bg-secondary rounded-lg transition-colors">
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 sm:p-2 hover:bg-secondary rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Date Label */}
      <div className="text-sm sm:text-base font-semibold text-muted-foreground">{getHeaderLabel()}</div>

      {/* ===== MONTH VIEW ===== */}
      {viewMode === 'month' && (
        <div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground py-1 sm:py-2 tracking-widest">
                <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
                <span className="sm:hidden">{day}</span>
              </div>
            ))}
            {monthData.map((d) => renderDayCell(d, true))}
          </div>
        </div>
      )}

      {/* ===== WEEK VIEW ===== */}
      {viewMode === 'week' && (
        <div>
          <div className="hidden sm:grid grid-cols-7 gap-2">
            {weekData.map((d, i) => (
              <div key={i} className="text-center text-[10px] uppercase font-bold text-muted-foreground py-2 tracking-widest">
                {d.fullDate.toLocaleDateString('default', { weekday: 'short' })}
              </div>
            ))}
            {weekData.map((d) => renderDayCell(d, false))}
          </div>
          {/* Mobile: Stack days vertically */}
          <div className="sm:hidden flex flex-col gap-3">
            {weekData.map((d) => (
              <div key={d.fullDate.toISOString()} className={`border border-border rounded-2xl p-3 transition-all ${isToday(d.fullDate) ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isToday(d.fullDate) ? 'bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center' : ''}`}>
                      {d.day}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {d.fullDate.toLocaleDateString('default', { weekday: 'long', month: 'short' })}
                    </span>
                  </div>
                  <button
                    onClick={() => openQuickCreate(d.fullDate)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {d.items.length > 0 ? (
                  <div className="space-y-1">
                    {d.items.map((item: any) => (
                      <div key={item.id} className={`text-xs px-2 py-1.5 rounded-lg flex items-center gap-2 font-medium ${
                        item.type === 'task' ? 'bg-green-500/10 text-green-500' :
                        item.type === 'habit' ? 'bg-purple-500/10 text-purple-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {item.type === 'task' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> :
                         item.type === 'habit' ? <Target className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                        {item.calendarLabel}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">No activity</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== WORK WEEK VIEW ===== */}
      {viewMode === 'work-week' && (
        <div>
          <div className="hidden sm:grid grid-cols-5 gap-2">
            {workWeekData.map((d, i) => (
              <div key={i} className="text-center text-[10px] uppercase font-bold text-muted-foreground py-2 tracking-widest">
                {d.fullDate.toLocaleDateString('default', { weekday: 'short' })}
              </div>
            ))}
            {workWeekData.map((d) => renderDayCell(d, false))}
          </div>
          {/* Mobile: Stack days vertically */}
          <div className="sm:hidden flex flex-col gap-3">
            {workWeekData.map((d) => (
              <div key={d.fullDate.toISOString()} className={`border border-border rounded-2xl p-3 transition-all ${isToday(d.fullDate) ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${isToday(d.fullDate) ? 'bg-primary text-primary-foreground w-7 h-7 rounded-full flex items-center justify-center' : ''}`}>
                      {d.day}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {d.fullDate.toLocaleDateString('default', { weekday: 'long', month: 'short' })}
                    </span>
                  </div>
                  <button
                    onClick={() => openQuickCreate(d.fullDate)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {d.items.length > 0 ? (
                  <div className="space-y-1">
                    {d.items.map((item: any) => (
                      <div key={item.id} className={`text-xs px-2 py-1.5 rounded-lg flex items-center gap-2 font-medium ${
                        item.type === 'task' ? 'bg-green-500/10 text-green-500' :
                        item.type === 'habit' ? 'bg-purple-500/10 text-purple-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {item.type === 'task' ? <CheckCircle2 className="w-3 h-3 shrink-0" /> :
                         item.type === 'habit' ? <Target className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
                        {item.calendarLabel}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">No activity</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== DAY VIEW ===== */}
      {viewMode === 'day' && (
        <div className="bg-card w-full border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[70vh] sm:h-[80vh]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border bg-muted/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className={`text-xl sm:text-2xl font-bold transition-colors ${isToday(dayData.fullDate) ? 'bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center' : ''}`}>
                {dayData.day}
              </span>
              <span className="text-sm sm:text-base text-muted-foreground font-medium">
                {dayData.fullDate.toLocaleDateString('default', { weekday: 'long', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <button
              onClick={() => openQuickCreate(dayData.fullDate)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {/* Hourly Timeline */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            <div className="relative flex flex-col w-full isolate">
              {/* Current Time Indicator Line */}
              {isToday(dayData.fullDate) && (
                <div 
                  className="absolute left-14 sm:left-20 right-0 z-30 pointer-events-none flex items-center transition-all duration-1000"
                  style={{ top: `${(new Date().getHours() * 80) + (new Date().getMinutes() / 60 * 80)}px` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute -left-1.5 z-40"></div>
                  <div className="w-full border-t border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] z-40"></div>
                </div>
              )}

              {/* Time Slots */}
              {Array.from({ length: 24 }).map((_, hour) => {
                const hourLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
                
                const currentItems = dayData.items.filter((item: any) => {
                  let ts = item.createdAt;
                  if (item.type === 'task' && item.payload.dueDate) ts = item.payload.dueDate;
                  return new Date(ts).getHours() === hour;
                });

                return (
                  <div key={hour} className="flex min-h-[80px] border-b border-border/40 group hover:bg-muted/5 transition-colors">
                    {/* Time Label Column */}
                    <div className="w-14 sm:w-20 pt-2 shrink-0 border-r border-border/40 text-right pr-2 sm:pr-4 relative">
                      <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/40 inline-block -translate-y-1/2 bg-card px-1">{hourLabel}</span>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 relative p-1.5 sm:p-2.5 flex flex-col gap-1.5 break-inside-avoid">
                      {currentItems.map((item: any) => (
                        <div key={item.id} className={`px-3 py-2 sm:py-2.5 rounded-xl border shadow-sm text-xs font-bold flex justify-between items-center transition-all hover:scale-[1.01] cursor-pointer z-10 ${
                          item.type === 'task' ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' :
                          item.type === 'habit' ? 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400' :
                          'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
                        }`}>
                          <div className="flex items-center gap-2 truncate">
                            {item.type === 'task' ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> :
                             item.type === 'habit' ? <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                            <span className="truncate">{item.calendarLabel}</span>
                          </div>
                          <span className="text-[9px] sm:text-[10px] uppercase font-black opacity-50 tracking-widest bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded ml-2 shrink-0">{item.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== QUICK CREATE MODAL ===== */}
      <AnimatePresence>
        {quickCreate.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
            onClick={() => setQuickCreate({ ...quickCreate, isOpen: false })}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Quick Add</h3>
                <button
                  onClick={() => setQuickCreate({ ...quickCreate, isOpen: false })}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {quickCreate.date?.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>

              {/* Type selector */}
              <div className="flex gap-2">
                {([
                  { type: 'note' as const, icon: FileText, label: 'Note', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
                  { type: 'task' as const, icon: CheckSquare, label: 'Task', color: 'text-green-500 bg-green-500/10 border-green-500/30' },
                  { type: 'habit' as const, icon: Activity, label: 'Habit', color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
                ]).map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setQuickCreate({ ...quickCreate, type: opt.type })}
                    className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-bold ${
                      quickCreate.type === opt.type ? opt.color : 'border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Title */}
              <input
                type="text"
                placeholder={`Enter ${quickCreate.type} title...`}
                value={quickCreate.title}
                onChange={(e) => setQuickCreate({ ...quickCreate, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
                className="w-full bg-secondary border border-border px-4 py-3 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                autoFocus
              />

              <button
                onClick={handleQuickCreate}
                disabled={!quickCreate.title.trim()}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Create {quickCreate.type}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
