import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  RotateCcw, 
  RefreshCw, 
  Download, 
  Wifi, 
  WifiOff, 
  SlidersHorizontal,
  Info,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, DaySummary } from './types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyeevuA1MTvQ09j-qcUWTPhArFe6k4Szilx6DB1kzEcnceA3ETJ1636AUpj8tRpldiZ8w/exec';
const REFRESH_INTERVAL = 60000;

const EXPENSE_CATEGORIES = [
  'Материал', 'Заливка', 'Установка', 'Доставка', 'Аренда', 'Зарплата', 
  'Ремонт', 'Кредит', 'Обед', 'Проезд', 'Личные расходы', 
  'Бензин Бакытжан', 'Коммунальные услуги', 'Расходники', 'Другие'
];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<string>('all');
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showMobileDatePicker, setShowMobileDatePicker] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('Синхронизация данных...');
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');

  // Load from cache on first mount
  useEffect(() => {
    const cached = localStorage.getItem('evrozabor_transactions');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const mapped = parsed.map((item: any) => ({
          ...item,
          dateObj: new Date(item.dateObj)
        }));
        setTransactions(mapped);
        const cachedTime = localStorage.getItem('evrozabor_last_updated');
        if (cachedTime) {
          setLastUpdated(new Date(cachedTime));
        }
      } catch (e) {
        console.error('Error parsing cached transactions:', e);
      }
    }
    
    fetchAndRender();

    // Set auto refresh interval
    const interval = setInterval(fetchAndRender, REFRESH_INTERVAL);

    // Online/Offline status listeners
    const handleOnline = () => {
      setIsOffline(false);
      triggerToast('Подключение восстановлено. Обновляем данные...', 'success');
      fetchAndRender();
    };
    const handleOffline = () => {
      setIsOffline(true);
      triggerToast('Режим офлайн. Отображаются кешированные данные', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA Install prompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Format helper for numbers
  const formatCurrency = (num: number) => {
    return num.toLocaleString('ru-RU') + ' ₸';
  };

  const formatNumber = (num: number) => {
    if (num === 0) return '0';
    return num.toLocaleString('ru-RU');
  };

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) return new Date(dateStr);
    
    const parts = dateStr.split(' ');
    const dateParts = parts[0].split('.');
    const timeParts = parts[1] ? parts[1].split(':') : ['0', '0', '0'];
    
    return new Date(
      parseInt(dateParts[2], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[0], 10),
      parseInt(timeParts[0], 10) || 0,
      parseInt(timeParts[1], 10) || 0,
      parseInt(timeParts[2], 10) || 0
    );
  };

  const triggerToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    if (type !== 'info') {
      setTimeout(() => setShowToast(false), 4000);
    }
  };

  const fetchAndRender = async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(SCRIPT_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      const rawData = await response.json();
      
      if (Array.isArray(rawData) && rawData.length > 0) {
        const mapped = rawData.map((item: any) => ({
          date: item.date,
          type: item.type,
          category: item.category,
          amount: Number(item.amount) || 0,
          dateObj: parseDate(item.date)
        })).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        
        setTransactions(mapped);
        setLastUpdated(new Date());
        setError(null);
        
        // Cache to localStorage
        localStorage.setItem('evrozabor_transactions', JSON.stringify(mapped));
        localStorage.setItem('evrozabor_last_updated', new Date().toISOString());
        
        triggerToast('Данные успешно синхронизированы', 'success');
      } else {
        throw new Error('Пустой ответ или неверный формат данных');
      }
    } catch (err: any) {
      console.error('Ошибка при загрузке:', err);
      if (err.name === 'AbortError') {
        setError('Превышено время ожидания сервера');
      } else {
        setError(err.message || 'Ошибка соединения с сервером');
      }
      triggerToast('Ошибка обновления. Используются офлайн данные', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

  const formatDateToInput = (d: Date): string => {
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  };

  const handleQuickFilterChange = (filter: string) => {
    setQuickFilter(filter);
    const now = new Date();
    if (filter === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (filter === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateToInput(start));
      setEndDate(formatDateToInput(now));
    } else if (filter === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatDateToInput(start));
      setEndDate(formatDateToInput(end));
    } else if (filter === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setStartDate(formatDateToInput(start));
      setEndDate(formatDateToInput(end));
    }
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
    setQuickFilter('all');
  };

  // Filtering transactions based on dates
  const getFilteredTransactions = () => {
    if (!startDate && !endDate) return transactions;
    
    let start = startDate ? new Date(startDate) : new Date('2000-01-01');
    start.setHours(0, 0, 0, 0);
    
    let end = endDate ? new Date(endDate) : new Date('2100-01-01');
    end.setHours(23, 59, 59, 999);

    return transactions.filter(t => t.dateObj >= start && t.dateObj <= end);
  };

  const filtered = getFilteredTransactions();

  // Metrics calculations
  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory: Record<string, number> = {};

  filtered.forEach(t => {
    if (t.type === 'Приход') {
      totalIncome += t.amount;
    } else if (t.type === 'Расход') {
      totalExpense += t.amount;
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    }
  });
  const balance = totalIncome - totalExpense;

  // Sorting and percentage for Top Expenses
  const sortedExpenses = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxExpense = sortedExpenses[0]?.[1] || 1;

  // Day summary table compilation
  const dailyMap: Record<string, DaySummary> = {};
  filtered.forEach(t => {
    const dateStr = t.dateObj.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = {
        dateObj: new Date(t.dateObj.getFullYear(), t.dateObj.getMonth(), t.dateObj.getDate()),
        dateStr: dateStr,
        income: 0,
        expense: 0,
        cats: {}
      };
      EXPENSE_CATEGORIES.forEach(c => dailyMap[dateStr].cats[c] = 0);
    }

    if (t.type === 'Приход') {
      dailyMap[dateStr].income += t.amount;
    } else if (t.type === 'Расход') {
      dailyMap[dateStr].expense += t.amount;
      if (EXPENSE_CATEGORIES.includes(t.category)) {
        dailyMap[dateStr].cats[t.category] += t.amount;
      } else {
        dailyMap[dateStr].cats['Другие'] += t.amount;
      }
    }
  });

  const dailyArray = Object.values(dailyMap).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  // Table summary totals
  let sumIncome = 0;
  let sumExpense = 0;
  const sumCats: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach(c => sumCats[c] = 0);

  dailyArray.forEach(day => {
    sumIncome += day.income;
    sumExpense += day.expense;
    EXPENSE_CATEGORIES.forEach(c => sumCats[c] += day.cats[c]);
  });
  const sumBalance = sumIncome - sumExpense;

  return (
    <div className="bg-[#FAFBFC] min-h-screen text-slate-900 font-sans leading-relaxed tracking-normal antialiased bg-gradient-to-tr from-slate-50 to-indigo-50/20 pb-12">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            id="toastMessage"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full shadow-xl bg-slate-900 text-white border border-slate-800 text-sm font-medium cursor-pointer"
            onClick={() => setShowToast(false)}
          >
            {toastType === 'info' && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />}
            {toastType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toastType === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{toastMessage}</span>
            <X className="w-3.5 h-3.5 text-slate-400 hover:text-white transition-colors ml-1" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* PWA Prompt Banner */}
        {deferredPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md border border-indigo-400/20"
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-white/10 p-2.5 rounded-xl">
                <Layers className="w-6 h-6 text-indigo-100" />
              </div>
              <div>
                <h4 className="font-semibold text-base sm:text-lg">Установить PWA приложение</h4>
                <p className="text-indigo-100 text-xs sm:text-sm">Пользуйтесь учетом финансов прямо со своего домашнего экрана даже без интернета!</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button 
                onClick={() => setDeferredPrompt(null)}
                className="px-3.5 py-2.5 rounded-xl text-indigo-100 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold uppercase tracking-wider"
              >
                Позже
              </button>
              <button 
                onClick={handleInstallClick}
                className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-xs shadow-sm hover:shadow-md active:scale-95 transition-all uppercase tracking-wider flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Установить
              </button>
            </div>
          </motion.div>
        )}

        {/* Brand and controls */}
        <header className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/45 backdrop-blur-sm p-4 rounded-2xl border border-indigo-50/60 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-800 bg-clip-text text-transparent">Evrozabor Luxe</h1>
                <p className="text-xs text-slate-500 font-medium tracking-wide">Учет финансов и аналитика</p>
              </div>
            </div>
            
            {/* Status Pills Mobile */}
            <div className="md:hidden flex items-center gap-2">
              {isOffline ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                  <WifiOff className="w-3.5 h-3.5" />
                  Офлайн
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                  <Wifi className="w-3.5 h-3.5" />
                  В сети
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            {/* Quick Filters */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 border border-slate-200">
              <button 
                onClick={() => handleQuickFilterChange('all')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickFilter === 'all' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Все
              </button>
              <button 
                onClick={() => handleQuickFilterChange('thisMonth')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickFilter === 'thisMonth' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Месяц
              </button>
              <button 
                onClick={() => handleQuickFilterChange('lastMonth')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickFilter === 'lastMonth' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Прошлый
              </button>
              <button 
                onClick={() => handleQuickFilterChange('thisYear')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickFilter === 'thisYear' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Год
              </button>
            </div>

            {/* Desktop Date Range */}
            <div className="hidden lg:flex items-center bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickFilter('custom');
                }}
                className="bg-transparent border-none text-xs font-medium text-slate-700 outline-none cursor-pointer focus:text-indigo-600"
                placeholder="С"
              />
              <span className="text-slate-400 text-xs">→</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickFilter('custom');
                }}
                className="bg-transparent border-none text-xs font-medium text-slate-700 outline-none cursor-pointer focus:text-indigo-600"
                placeholder="По"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Reset filter button */}
              {(startDate || endDate) && (
                <button 
                  onClick={clearDates}
                  className="flex items-center gap-1 px-3 py-2 border border-rose-200 bg-rose-50/40 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors w-full sm:w-auto justify-center"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Сбросить</span>
                </button>
              )}

              {/* Mobile filter trigger */}
              <button 
                onClick={() => setShowMobileDatePicker(true)}
                className="lg:hidden flex items-center justify-center gap-2 w-11 h-11 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs transition-colors"
                title="Фильтр по датам"
              >
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              </button>

              {/* Status Indicator (Desktop) */}
              <div className="hidden md:flex items-center gap-2">
                {isOffline ? (
                  <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                    <WifiOff className="w-3.5 h-3.5" />
                    Офлайн
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    <Wifi className="w-3.5 h-3.5" />
                    В сети
                  </span>
                )}
              </div>

              {/* Refresh button */}
              <button 
                onClick={fetchAndRender}
                disabled={loading || isOffline}
                className="w-11 h-11 border border-slate-200 bg-white text-slate-700 hover:text-indigo-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl flex items-center justify-center shadow-xs transition-all active:scale-95"
                title={lastUpdated ? `Обновлено: ${lastUpdated.toLocaleTimeString('ru-RU')}` : 'Синхронизировать'}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Network info / Cache indicator when offline */}
        {isOffline && (
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-800">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Автономный режим активен</p>
              <p className="text-amber-700/80 mt-0.5">Данные загружены из локальной памяти устройства. Вы можете продолжить просмотр. Синхронизация восстановится автоматически при подключении к сети.</p>
              {lastUpdated && (
                <p className="text-slate-500 font-mono text-[10px] mt-1">Последнее обновление: {lastUpdated.toLocaleString('ru-RU')}</p>
              )}
            </div>
          </div>
        )}

        {/* KPIs & Side panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main metrics */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* KPI Income */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-emerald-200 transition-all hover:-translate-y-0.5 duration-300">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 to-teal-400" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  Доходы
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div>
                <h3 className={`text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono ${loading && transactions.length === 0 ? 'bg-slate-100 animate-pulse text-transparent rounded' : ''}`}>
                  {loading && transactions.length === 0 ? '000 000 ₸' : formatCurrency(totalIncome)}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Итого за выбранный период</p>
              </div>
            </div>

            {/* KPI Expense */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-rose-200 transition-all hover:-translate-y-0.5 duration-300">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-rose-500 to-pink-500" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  Расходы
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                </div>
              </div>
              <div>
                <h3 className={`text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono ${loading && transactions.length === 0 ? 'bg-slate-100 animate-pulse text-transparent rounded' : ''}`}>
                  {loading && transactions.length === 0 ? '000 000 ₸' : formatCurrency(totalExpense)}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Сумма всех издержек</p>
              </div>
            </div>

            {/* KPI Balance */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs relative overflow-hidden flex flex-col justify-between group hover:border-indigo-200 transition-all hover:-translate-y-0.5 duration-300">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-violet-600" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-500" />
                  Остаток
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                </div>
              </div>
              <div>
                <h3 className={`text-2xl sm:text-3xl font-extrabold bg-gradient-to-tr from-indigo-600 to-violet-700 bg-clip-text text-transparent font-mono ${loading && transactions.length === 0 ? 'bg-slate-100 animate-pulse text-transparent rounded' : ''}`}>
                  {loading && transactions.length === 0 ? '000 000 ₸' : formatCurrency(balance)}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Доходы минус Расходы</p>
              </div>
            </div>

          </div>

          {/* Top Expenses */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-800">Топ 5 категорий расходов</h2>
              </div>

              <div className="space-y-4">
                {loading && transactions.length === 0 ? (
                  <div className="space-y-3">
                    <div className="h-10 bg-slate-100 animate-pulse rounded-xl" />
                    <div className="h-10 bg-slate-100 animate-pulse rounded-xl" />
                    <div className="h-10 bg-slate-100 animate-pulse rounded-xl" />
                  </div>
                ) : sortedExpenses.length === 0 ? (
                  <div className="py-6 text-center text-xs font-medium text-slate-400">
                    Нет данных за выбранный период
                  </div>
                ) : (
                  sortedExpenses.map(([category, amount]) => {
                    const percent = Math.round((amount / maxExpense) * 100);
                    return (
                      <div key={category} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                          <span className="truncate pr-2">{category}</span>
                          <span className="text-slate-800 font-mono font-bold whitespace-nowrap">{formatCurrency(amount)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            {/* Display count of operations */}
            <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span>Активных операций:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-bold">{filtered.length}</span>
            </div>
          </div>

        </div>

        {/* Transactions Table Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 p-4 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-600">
                  <rect width="20" height="14" x="2" y="5" rx="2"/>
                  <line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Операции по дням</h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Детализация начислений и расходов по категориям</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px] relative">
            <table className="w-full text-left border-collapse">
              <thead>
                {/* Headers */}
                <tr className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-30 shadow-[0_1px_0_0_rgba(226,232,240,1)] text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  <th className="sticky left-0 bg-slate-50/90 py-4 px-5 font-bold z-40 text-left border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.015)] whitespace-nowrap">
                    Дата
                  </th>
                  <th className="py-4 px-5 text-right font-bold whitespace-nowrap">Приход</th>
                  <th className="py-4 px-5 text-right font-bold whitespace-nowrap">Расход</th>
                  <th className="py-4 px-5 text-right font-bold whitespace-nowrap">Остаток</th>
                  {EXPENSE_CATEGORIES.map(category => (
                    <th key={category} className="py-4 px-5 text-right font-semibold whitespace-nowrap font-normal">{category}</th>
                  ))}
                </tr>

                {/* Total Summary Row */}
                <tr className="bg-indigo-50/45 text-xs font-bold text-slate-800 border-b-2 border-indigo-100">
                  <th className="sticky left-0 bg-indigo-50/95 py-3.5 px-5 font-extrabold z-40 text-left border-r border-indigo-100 shadow-[2px_0_5px_rgba(99,102,241,0.02)] whitespace-nowrap">
                    Итого
                  </th>
                  <th className="py-3.5 px-5 text-right text-emerald-600 font-extrabold whitespace-nowrap font-mono">{formatNumber(sumIncome)}</th>
                  <th className="py-3.5 px-5 text-right text-rose-600 font-extrabold whitespace-nowrap font-mono">{formatNumber(sumExpense)}</th>
                  <th className="py-3.5 px-5 text-right text-indigo-700 font-extrabold whitespace-nowrap font-mono">{formatNumber(sumBalance)}</th>
                  {EXPENSE_CATEGORIES.map(category => (
                    <th key={category} className="py-3.5 px-5 text-right font-bold whitespace-nowrap font-mono text-slate-700">{formatNumber(sumCats[category])}</th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {loading && transactions.length === 0 ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="sticky left-0 bg-white py-4 px-5 border-r border-slate-100"><div className="h-4 bg-slate-100 animate-pulse rounded w-20" /></td>
                      <td className="py-4 px-5"><div className="h-4 bg-slate-100 animate-pulse rounded w-16 ml-auto" /></td>
                      <td className="py-4 px-5"><div className="h-4 bg-slate-100 animate-pulse rounded w-16 ml-auto" /></td>
                      <td className="py-4 px-5"><div className="h-4 bg-slate-100 animate-pulse rounded w-16 ml-auto" /></td>
                      {EXPENSE_CATEGORIES.map((_, i) => (
                        <td key={i} className="py-4 px-5"><div className="h-4 bg-slate-100 animate-pulse rounded w-12 ml-auto" /></td>
                      ))}
                    </tr>
                  ))
                ) : dailyArray.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={4 + EXPENSE_CATEGORIES.length} 
                      className="py-12 text-center text-slate-400 font-medium"
                    >
                      Нет операций за выбранный период
                    </td>
                  </tr>
                ) : (
                  dailyArray.map((day) => {
                    const dayBalance = day.income - day.expense;
                    return (
                      <tr key={day.dateStr} className="hover:bg-slate-50/55 transition-colors group">
                        <td className="sticky left-0 bg-white group-hover:bg-slate-50 py-3.5 px-5 font-semibold text-slate-600 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.015)] whitespace-nowrap">
                          {day.dateStr}
                        </td>
                        <td className="py-3.5 px-5 text-right text-emerald-600 font-semibold font-mono whitespace-nowrap">
                          {day.income > 0 ? formatNumber(day.income) : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right text-rose-500 font-semibold font-mono whitespace-nowrap">
                          {day.expense > 0 ? formatNumber(day.expense) : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right text-slate-800 font-bold font-mono whitespace-nowrap">
                          {formatNumber(dayBalance)}
                        </td>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <td 
                            key={category} 
                            className={`py-3.5 px-5 text-right font-mono whitespace-nowrap ${day.cats[category] > 0 ? 'text-slate-800 font-medium' : 'text-slate-300'}`}
                          >
                            {day.cats[category] > 0 ? formatNumber(day.cats[category]) : '—'}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile DatePicker Modal Dialog */}
      <AnimatePresence>
        {showMobileDatePicker && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileDatePicker(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative z-10 space-y-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">Выбрать период</h3>
                <button 
                  onClick={() => setShowMobileDatePicker(false)}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Дата начала</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setQuickFilter('custom');
                    }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 bg-slate-50/55"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Дата конца</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setQuickFilter('custom');
                    }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 bg-slate-50/55"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    clearDates();
                    setShowMobileDatePicker(false);
                  }}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 transition-colors"
                >
                  Сбросить
                </button>
                <button 
                  onClick={() => setShowMobileDatePicker(false)}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100"
                >
                  Применить
                </button>
              </div>
            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
