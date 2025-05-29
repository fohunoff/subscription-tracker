import React, { useState, useEffect, useMemo } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionForm, SubscriptionList } from './features/subscriptions';
import { ExportData } from './features/telegram';
import { Modal } from './shared';
import { SettingsModal } from './features/settings';
import { LoginPage, UserMenu } from './shared';
import { useToast } from './features/notifications';
import { Cog6ToothIcon, PlusIcon } from '@heroicons/react/24/solid';

const FALLBACK_CURRENCY_RATES = {
  RUB: 1,
  USD: 90,
  EUR: 98,
  RSD: 0.83,
};

const CURRENCY_SYMBOLS = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  RSD: 'дин.',
};

// Google Client ID из environment переменных
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function AppContent() {
  const { user, isAuthenticated, loading, api } = useAuth();
  const { showToast } = useToast();
  
  // ✅ ВСЕ ХУКИ ДОЛЖНЫ БЫТЬ В НАЧАЛЕ, ДО ЛЮБЫХ УСЛОВНЫХ ВОЗВРАТОВ
  const [subscriptions, setSubscriptions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [currencyRates, setCurrencyRates] = useState(FALLBACK_CURRENCY_RATES);
  const [isRatesLoading, setIsRatesLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState(() => {
    const saved = localStorage.getItem('baseCurrency');
    return saved || 'RUB';
  });
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [lastRatesUpdate, setLastRatesUpdate] = useState(() => {
    const saved = localStorage.getItem('lastRatesUpdate');
    return saved ? new Date(saved) : null;
  });
  const [isSubsOpen, setIsSubsOpen] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // ✅ ВСЕ useEffect ХУКИ
  // Загружаем подписки после авторизации
  useEffect(() => {
    if (isAuthenticated && api) {
      loadSubscriptions();
    }
  }, [isAuthenticated, api]);

  // Настройки валюты
  useEffect(() => {
    localStorage.setItem('baseCurrency', baseCurrency);
  }, [baseCurrency]);

  // Настройки темы
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  // Обработчик toast событий
  useEffect(() => {
    function handleToastEvent(e) {
      if (e.detail && e.detail.msg) showToast(e.detail.msg, e.detail.type);
    }
    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, [showToast]);

  // Загрузка курсов валют при старте
  useEffect(() => {
    fetchRates();
  }, []);

  // ✅ ВСЕ useMemo ХУКИ
  const totalMonthlyCost = useMemo(() => {
    const totalRub = subscriptions.reduce((total, sub) => {
      let monthlyCost = sub.cost;
      if (sub.cycle === 'annually') {
        monthlyCost = monthlyCost / 12;
      }
      const rate = currencyRates[sub.currency] || 1;
      return total + monthlyCost * rate;
    }, 0);
    const rateToBase = currencyRates[baseCurrency] || 1;
    return totalRub / rateToBase;
  }, [subscriptions, currencyRates, baseCurrency]);

  // ✅ ФУНКЦИИ (НЕ ХУКИ)
  const loadSubscriptions = async () => {
    if (!api) return;
    
    setIsLoadingData(true);
    try {
      const userSubscriptions = await api.getSubscriptions();
      setSubscriptions(userSubscriptions);
    } catch (error) {
      console.error('Ошибка загрузки подписок:', error);
      showToast('Ошибка загрузки подписок', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchRates = async () => {
    setIsRatesLoading(true);
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=RUB&symbols=USD,EUR,RSD');
      const data = await res.json();

      if (data && data.error) {
        showToast(data.error.info || 'Что-то пошло не так', 'error');
      }

      if (data && data.rates) {
        setCurrencyRates({
          RUB: 1,
          USD: 1 / data.rates.USD,
          EUR: 1 / data.rates.EUR,
          RSD: 1 / data.rates.RSD,
        });
        const now = new Date();
        setLastRatesUpdate(now);
        localStorage.setItem('lastRatesUpdate', now.toISOString());
        showToast('Курсы валют обновлены', 'success');
      }
    } catch {
      showToast('Ошибка обновления курсов валют', 'error');
    } finally {
      setIsRatesLoading(false);
    }
  };

  const handleAddSubscription = async (newSub) => {
    if (!api) return;

    try {
      const createdSubscription = await api.createSubscription(newSub);
      setSubscriptions(prev => [...prev, createdSubscription]);
      setIsModalOpen(false);
      showToast('Подписка добавлена!', 'success');
    } catch (error) {
      console.error('Ошибка добавления подписки:', error);
      showToast(error.message || 'Ошибка добавления подписки', 'error');
    }
  };

  const handleDeleteSubscription = async (idToDelete) => {
    if (!api) return;

    const sub = subscriptions.find(sub => sub.id === idToDelete);
    const name = sub ? `«${sub.name}»` : '';
    
    if (!window.confirm(`Вы действительно хотите удалить подписку${name ? ' ' + name : ''}?`)) {
      return;
    }

    try {
      await api.deleteSubscription(idToDelete);
      setSubscriptions(prev => prev.filter(sub => sub.id !== idToDelete));
      showToast('Подписка удалена', 'success');
    } catch (error) {
      console.error('Ошибка удаления подписки:', error);
      showToast(error.message || 'Ошибка удаления подписки', 'error');
    }
  };

  const handleOpenEditModal = (subscription) => {
    setEditingSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleUpdateSubscription = async (id, updatedSubData) => {
    if (!api) return;

    try {
      const updatedSubscription = await api.updateSubscription(id, updatedSubData);
      setSubscriptions(prev => prev.map(sub => 
        sub.id === id ? updatedSubscription : sub
      ));
      setIsModalOpen(false);
      setEditingSubscription(null);
      showToast('Изменения сохранены', 'success');
    } catch (error) {
      console.error('Ошибка обновления подписки:', error);
      showToast(error.message || 'Ошибка обновления подписки', 'error');
    }
  };

  const handleImportSubscriptions = async (importedSubs) => {
    if (!api) return;

    try {
      const result = await api.importSubscriptions(importedSubs);
      await loadSubscriptions(); // Перезагружаем список
      showToast(`Импортировано ${result.addedCount} подписок!`, 'success');
    } catch (error) {
      console.error('Ошибка импорта подписок:', error);
      showToast(error.message || 'Ошибка импорта подписок', 'error');
    }
  };

  // ✅ ТЕПЕРЬ УСЛОВНЫЙ РЕНДЕРИНГ В КОНЦЕ, ПОСЛЕ ВСЕХ ХУКОВ
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          <span className="text-lg text-slate-600 dark:text-slate-300">Загрузка...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 font-sans transition-colors">
      {/* Хедер с настройками и пользователем */}
      <div className="fixed top-4 right-4 z-50 flex items-center space-x-3">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="bg-white/80 hover:bg-white shadow-lg rounded-full p-2 border border-slate-200 transition-colors"
          aria-label="Открыть настройки"
          type="button"
        >
          <Cog6ToothIcon className="h-7 w-7 text-slate-600" />
        </button>
        <UserMenu />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl flex-1 flex flex-col">
        
        <header className="mb-10 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight">
            Трекер расходов
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Управляйте своими расходами легко и эффективно.
          </p>
        </header>

        <main className="space-y-8 flex-1">
          {/* Секция списка подписок */}
          <section aria-labelledby="subscriptions-list-heading" className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 select-none cursor-pointer group" onClick={() => setIsSubsOpen(v => !v)}>
              <h2 id="subscriptions-list-heading" className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-4 sm:mb-0 flex items-center gap-2">
                <span>Мои подписки</span>
                {isLoadingData && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                )}
                <svg className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isSubsOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {subscriptions.length > 0 && (
                  <div className="text-left sm:text-right order-2 sm:order-1">
                      <span className="text-sm text-slate-500 dark:text-slate-400 block">Итого в месяц:</span>
                      <p className="text-3xl font-bold text-brand-primary">
                          {totalMonthlyCost.toFixed(2)} <span className="text-xl font-medium text-slate-600 dark:text-slate-300">{CURRENCY_SYMBOLS[baseCurrency] || baseCurrency}</span>
                      </p>
                  </div>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setIsModalOpen(true); }}
                  className="order-1 sm:order-2 w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
                >
                  <PlusIcon className="h-5 w-5" />
                  Добавить
                </button>
              </div>
            </div>
            
            <div
              className={`overflow-hidden transition-all duration-400 ${isSubsOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
              style={{ transitionProperty: 'max-height, opacity' }}
            >
              {isLoadingData ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
                  <p className="text-slate-600 dark:text-slate-300">Загрузка подписок...</p>
                </div>
              ) : (
                <>
                  <SubscriptionList
                    subscriptions={subscriptions}
                    onDeleteSubscription={handleDeleteSubscription}
                    onEditSubscription={handleOpenEditModal}
                  />
                  {subscriptions.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 text-right">
                        * Годовые подписки конвертированы в месячную стоимость.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
          
          {/* Секция экспорта для Telegram */}
          <section aria-labelledby="telegram-export-heading" className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 md:p-8">
            <h2 id="telegram-export-heading" className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Уведомления в Telegram
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Экспортируйте данные для вашего Telegram-бота, чтобы получать своевременные напоминания о предстоящих платежах.
            </p>
            <ExportData 
              subscriptions={subscriptions} 
              onImport={handleImportSubscriptions}
            />
          </section>
        </main>
        
        <footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400 mb-2 sm:mb-4 md:mb-6 lg:mb-8 flex-shrink-0">
          <p>© {new Date().getFullYear()} Трекер расходов. Разработано с React + Express + TailwindCSS.</p>
        </footer>
      </div>

      {/* Модальное окно для добавления подписки */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
        }}
        title={editingSubscription ? "Редактировать подписку" : "Добавить новую подписку"}
      >
        <SubscriptionForm
          onAddSubscription={handleAddSubscription}
          onUpdateSubscription={handleUpdateSubscription}
          initialData={editingSubscription}
          isEditMode={!!editingSubscription}
        />
      </Modal>

      {/* Модальное окно для настроек */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currencyRates={currencyRates}
        isRatesLoading={isRatesLoading}
        fetchRates={fetchRates}
        lastRatesUpdate={lastRatesUpdate}
        baseCurrency={baseCurrency}
        setBaseCurrency={setBaseCurrency}
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
}

function App() {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка конфигурации</h1>
          <p className="text-slate-600">Google Client ID не настроен</p>
          <p className="text-sm text-slate-500 mt-2">
            Добавьте VITE_GOOGLE_CLIENT_ID в ваш .env файл
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;