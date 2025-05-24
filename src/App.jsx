import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import SubscriptionForm from './components/SubscriptionForm';
import SubscriptionList from './components/SubscriptionList';
import ExportData from './components/ExportData';
import Modal from './components/Modal'; // <--- Импортируем Modal
import { PlusIcon } from '@heroicons/react/24/solid'; // Для кнопки открытия модалки

const AppIcon = ({ className = "w-10 h-10 text-brand-primary" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="15" y="35" width="70" height="45" rx="5" className="text-blue-300" fill="currentColor"/>
    <rect x="20" y="30" width="70" height="45" rx="5" className="text-blue-400" fill="currentColor" stroke="#FFFFFF" strokeWidth="3"/>
    <rect x="25" y="25" width="70" height="45" rx="5" className="text-brand-primary" fill="currentColor" stroke="#FFFFFF" strokeWidth="3"/>
    <line x1="35" y1="55" x2="55" y2="55" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    <line x1="35" y1="65" x2="65" y2="65" stroke="white" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);


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

  useEffect(() => {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  const handleAddSubscription = (newSub) => {
    setSubscriptions(prevSubs => [...prevSubs, { ...newSub, id: uuidv4() }]);
    setIsModalOpen(false); // <--- Закрываем модалку после добавления
  };

  const handleDeleteSubscription = (idToDelete) => {
    setSubscriptions(prevSubs => prevSubs.filter(sub => sub.id !== idToDelete));
  };

  const totalMonthlyCost = useMemo(() => {
    return subscriptions.reduce((total, sub) => {
      let monthlyCost = sub.cost;
      if (sub.cycle === 'annually') {
        monthlyCost = monthlyCost / 12;
      }
      return total + monthlyCost;
    }, 0);
  }, [subscriptions]);

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
            <ExportData subscriptions={subscriptions} />
          </section>
        </main>

        <footer className="mt-16 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Трекер Подписок. Разработано с Tailwind CSS.</p>
        </footer>
      </div>

      {/* Модальное окно для добавления подписки */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Добавить новую подписку"
      >
        <SubscriptionForm onAddSubscription={handleAddSubscription} />
      </Modal>
    </div>
  );
}

export default App;