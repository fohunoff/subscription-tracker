import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SubscriptionForm from './components/SubscriptionForm';
import SubscriptionList from './components/SubscriptionList';
import ExportData from './components/ExportData';
import Modal from './components/Modal'; // <--- Импортируем Modal
import { PlusIcon } from '@heroicons/react/24/solid'; // Для кнопки открытия модалки
import { useToast } from './components/ToastProvider';

const AppIcon = ({ className = "w-10 h-10 text-brand-primary" }) => (
  <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="15" width="70" height="70" rx="8" fill="#2563EB"/>
    <rect x="15" y="15" width="70" height="20" rx="8" ry="8" fill="#1D4ED8"/>
    <circle cx="30" cy="25" r="3" fill="white"/>
    <circle cx="40" cy="25" r="3" fill="white"/>
    <circle cx="50" cy="25" r="3" fill="white"/>
    <rect x="30" y="45" width="40" height="30" rx="4" fill="#FFFF00"/>
    <circle cx="50" cy="60" r="8" fill="#FFFFFF"/>
    <path d="M46 60 L50 64 L56 58" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
);

const FALLBACK_CURRENCY_RATES = {
  RUB: 1,
  USD: 90,
  EUR: 98,
};
const CURRENCY_SYMBOLS = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
};


function App() {
  const [subscriptions, setSubscriptions] = useState(() => {
    const savedSubs = localStorage.getItem('subscriptions');
    try {
      return savedSubs ? JSON.parse(savedSubs) : [];
    } catch (error) {
      console.error("Ошибка парсинга подписок из localStorage:", error);
      return [];
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false); // <--- Состояние для модалки
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [currencyRates, setCurrencyRates] = useState(FALLBACK_CURRENCY_RATES);
  const [isRatesLoading, setIsRatesLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    function handleToastEvent(e) {
      if (e.detail && e.detail.msg) showToast(e.detail.msg, e.detail.type);
    }
    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, [showToast]);

  const fetchRates = async () => {
    setIsRatesLoading(true);
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=RUB&symbols=USD,EUR');
      const data = await res.json();

      console.log('Fetched rates:', data);

      if (data && data.error) {
        showToast(data.error.info || 'Что-то пошло не так', 'error');
      }

      if (data && data.rates) {
        setCurrencyRates({
          RUB: 1,
          USD: 1 / data.rates.USD,
          EUR: 1 / data.rates.EUR,
        });
        console.log('SHOW TOAST');
        
        showToast('Курсы валют обновлены', 'success');
      }
    } catch {
      showToast('Ошибка обновления курсов валют', 'error');
    } finally {
      setIsRatesLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // eslint-disable-next-line
  }, []);

  const handleAddSubscription = (newSub) => {
    setSubscriptions(prevSubs => [...prevSubs, { ...newSub, id: uuidv4() }]);
    setIsModalOpen(false);
    showToast('Подписка добавлена!', 'success');
  };

  const handleDeleteSubscription = (idToDelete) => {
    setSubscriptions(prevSubs => prevSubs.filter(sub => sub.id !== idToDelete));
    showToast('Подписка удалена', 'success');
  };

  const handleOpenEditModal = (subscription) => {
    setEditingSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleUpdateSubscription = (id, updatedSubData) => {
    setSubscriptions(prevSubs => prevSubs.map(sub => sub.id === id ? { ...sub, ...updatedSubData } : sub));
    setIsModalOpen(false);
    setEditingSubscription(null);
    showToast('Изменения сохранены', 'success');
  };

  // Добавим обработчик импорта в App
  const handleImportSubscriptions = (importedSubs) => {
    setSubscriptions(prev => [
      ...prev,
      ...importedSubs.filter(
        imported => !prev.some(sub => sub.name === imported.name && sub.cost === imported.cost && sub.paymentDay === imported.paymentDay)
      )
    ]);
    showToast('Подписки импортированы!', 'success');
  };

  const totalMonthlyCost = useMemo(() => {
    return subscriptions.reduce((total, sub) => {
      let monthlyCost = sub.cost;
      if (sub.cycle === 'annually') {
        monthlyCost = monthlyCost / 12;
      }
      const rate = currencyRates[sub.currency] || 1;
      return total + monthlyCost * rate;
    }, 0);
  }, [subscriptions, currencyRates]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        
        <header className="mb-10 flex flex-col items-center text-center">
          <AppIcon className="w-16 h-16 mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight">
            Трекер Подписок
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Управляйте своими расходами на подписки легко и эффективно.
          </p>
        </header>

        <main className="space-y-8">
          {/* Секция списка подписок и кнопка добавления */}
          <section aria-labelledby="subscriptions-list-heading" className="bg-white shadow-xl rounded-xl p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
              <h2 id="subscriptions-list-heading" className="text-2xl font-semibold text-slate-700 mb-4 sm:mb-0">
                Мои подписки
              </h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {subscriptions.length > 0 && (
                  <div className="text-left sm:text-right order-2 sm:order-1">
                      <span className="text-sm text-slate-500 block">Итого в месяц:</span>
                      <p className="text-3xl font-bold text-brand-primary">
                          {totalMonthlyCost.toFixed(2)} <span className="text-xl font-medium text-slate-600">RUB</span>
                          <button onClick={fetchRates} disabled={isRatesLoading} className="ml-2 text-xs text-sky-600 underline disabled:opacity-50">{isRatesLoading ? 'Обновление...' : 'Обновить курсы'}</button>
                      </p>
                  </div>
                )}
                <button
                  onClick={() => setIsModalOpen(true)} // <--- Открываем модалку
                  className="order-1 sm:order-2 w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
                >
                  <PlusIcon className="h-5 w-5" />
                  Добавить
                </button>
              </div>
            </div>
            <SubscriptionList
              subscriptions={subscriptions}
              onDeleteSubscription={handleDeleteSubscription}
              onEditSubscription={handleOpenEditModal}
            />
             {subscriptions.length > 0 && (
                <p className="text-xs text-slate-500 mt-6 text-right">
                    * Годовые подписки конвертированы в месячную стоимость. Конвертация других валют не реализована.
                </p>
             )}
          </section>
          
          {/* Секция экспорта для Telegram */}
          <section aria-labelledby="telegram-export-heading" className="bg-white shadow-xl rounded-xl p-6 md:p-8">
            <h2 id="telegram-export-heading" className="text-2xl font-semibold text-slate-700 mb-3">
              Уведомления в Telegram
            </h2>
            <p className="text-slate-600 mb-4">
              Экспортируйте данные для вашего Telegram-бота, чтобы получать своевременные напоминания о предстоящих платежах.
            </p>
            <ExportData subscriptions={subscriptions} onImport={handleImportSubscriptions} />
          </section>
        </main>

        <footer className="mt-16 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Трекер Подписок. Разработано с Tailwind CSS.</p>
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
    </div>
  );
}

export default App;