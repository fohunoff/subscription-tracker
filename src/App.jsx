import React, { useEffect, useMemo } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionForm, SubscriptionList } from './features/subscriptions';
import { ExportData } from './features/telegram';
import { Modal } from './shared';
import { SettingsModal } from './features/settings';
import { LoginPage, UserMenu } from './shared';
import { useToast } from './features/notifications';
import { Cog6ToothIcon, PlusIcon, TagIcon } from '@heroicons/react/24/solid';
import { useCurrencyRates, useTheme } from './features/settings/hooks';
import { useSubscriptions } from './features/subscriptions/hooks';
import { formatCurrency } from './shared/utils';
import { useCategories } from './features/categories/hooks/useCategories';
import CategoryForm from './features/categories/CategoryForm';
import CategorySection from './features/categories/CategorySection';


// Google Client ID из environment переменных
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function AppContent() {
  const { isAuthenticated, loading, api } = useAuth();
  const { showToast } = useToast();
  const { currencyRates, isRatesLoading, lastRatesUpdate, fetchRates } = useCurrencyRates();
  const {
    subscriptions,
    setSubscriptions,
    isLoadingData,
    loadSubscriptions,
  } = useSubscriptions(api, showToast);

  const {
    categories,
    isLoadingCategories,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories(api, showToast);

  console.log(categories);
  
  // ✅ ВСЕ ХУКИ ДОЛЖНЫ БЫТЬ В НАЧАЛЕ, ДО ЛЮБЫХ УСЛОВНЫХ ВОЗВРАТОВ
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalType, setModalType] = React.useState('subscription'); // 'subscription' или 'category'
  const [editingSubscription, setEditingSubscription] = React.useState(null);
  const [editingCategory, setEditingCategory] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [baseCurrency, setBaseCurrency] = React.useState(localStorage.getItem('baseCurrency') || 'RUB');
  const [theme, setTheme] = useTheme('light');
  // const [isSubsOpen, setIsSubsOpen] = React.useState(true);

  // ✅ ВСЕ useEffect ХУКИ
  // Загружаем подписки после авторизации
  useEffect(() => {
    if (isAuthenticated && api) {
      loadCategories();
      loadSubscriptions();
    }
  }, [isAuthenticated, api, loadCategories, loadSubscriptions]);

  // Настройки валюты
  useEffect(() => {
    localStorage.setItem('baseCurrency', baseCurrency);
  }, [baseCurrency]);

  // Обработчик toast событий
  useEffect(() => {
    function handleToastEvent(e) {
      if (e.detail && e.detail.msg) showToast(e.detail.msg, e.detail.type);
    }
    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, [showToast]);

  // Загрузка курсов валют при старте
  // useEffect(() => {
  //   fetchRates();
  // }, []);

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

  // Группируем подписки по категориям
  const categoriesWithSubscriptions = useMemo(() => {
    return categories.map(category => ({
      ...category,
      subscriptions: subscriptions.filter(sub => sub.categoryId === category.id)
    }));
  }, [categories, subscriptions]);

  // ✅ ФУНКЦИИ (НЕ ХУКИ)
  const openAddSubscriptionModal = (category = null) => {
    setModalType('subscription');
    setSelectedCategory(category);
    setEditingSubscription(null);
    setIsModalOpen(true);
  };

  const openAddCategoryModal = () => {
    setModalType('category');
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleAddSubscription = async (newSub) => {
    if (!api) return;

    try {
      const createdSubscription = await api.createSubscription(newSub);
      setSubscriptions(prev => [...prev, createdSubscription]);
      setIsModalOpen(false);
      setSelectedCategory(null);
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
    setModalType('subscription');
    setEditingSubscription(subscription);
    setSelectedCategory(null);
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

  const handleOpenEditCategoryModal = (category) => {
    setModalType('category');
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleAddCategory = async (newCategory) => {
    try {
      await addCategory(newCategory);
      setIsModalOpen(false);
    } catch (error) {
      // Ошибка уже обработана в хуке
    }
  };

  const handleUpdateCategory = async (id, updatedCategoryData) => {
    try {
      await updateCategory(id, updatedCategoryData);
      setIsModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      // Ошибка уже обработана в хуке
    }
  };

  const handleDeleteCategory = async (idToDelete) => {
    try {
      await deleteCategory(idToDelete);
    } catch (error) {
      // Ошибка уже обработана в хуке
    }
  };

  const handleImportSubscriptions = async (importedSubs, targetCategoryId = null) => {
    if (!api) return;

    try {
      const result = await api.importSubscriptions(importedSubs, targetCategoryId);
      await loadSubscriptions(); // Перезагружаем список
      showToast(`Импортировано ${result.addedCount} подписок!`, 'success');
    } catch (error) {
      console.error('Ошибка импорта подписок:', error);
      showToast(error.message || 'Ошибка импорта подписок', 'error');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubscription(null);
    setEditingCategory(null);
    setSelectedCategory(null);
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

          {/* Управление категориями */}
          <section className="">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-4 sm:mb-0 flex items-center gap-2">
                {/* <TagIcon className="h-6 w-6 text-brand-primary" />
                Категории */}
                {isLoadingCategories && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={openAddCategoryModal}
                  className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                >
                  <PlusIcon className="h-4 w-4" />
                  Категория
                </button>
                
                <button
                  onClick={() => openAddSubscriptionModal()}
                  className="flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
                >
                  <PlusIcon className="h-4 w-4" />
                  Подписка
                </button>
              </div>
            </div>

          {/* Общая статистика */}
          {subscriptions.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-xl p-6 md:p-8 mb-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Общие расходы
                </h2>
                <p className="text-4xl font-bold text-brand-primary mb-2">
                  {formatCurrency(totalMonthlyCost, baseCurrency)}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Итого в месяц • {subscriptions.length} подписок
                </p>
              </div>
            </section>
          )}

            {isLoadingCategories ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-300">Загрузка категорий...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {categoriesWithSubscriptions.map((category) => (
                  <CategorySection
                    key={category.id}
                    category={category}
                    subscriptions={category.subscriptions}
                    currencyRates={currencyRates}
                    baseCurrency={baseCurrency}
                    onDeleteSubscription={handleDeleteSubscription}
                    onEditSubscription={handleOpenEditModal}
                    onAddSubscription={() => openAddSubscriptionModal(category)}
                    onEditCategory={handleOpenEditCategoryModal}
                    onDeleteCategory={handleDeleteCategory}
                    isLoadingData={isLoadingData}
                  />
                ))}
                
                {categories.length === 0 && (
                  <div className="text-center py-12 px-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <TagIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                    <p className="text-xl font-medium text-slate-600 dark:text-slate-300">Категории не созданы.</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Добавьте первую категорию для организации подписок.</p>
                  </div>
                )}
              </div>
            )}
          </section>
          
          {/* Секция экспорта для Telegram */}
          <section aria-labelledby="telegram-export-heading" className="bg-white dark:bg-slate-800 rounded-xl p-6 md:p-8">
            <h2 id="telegram-export-heading" className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Уведомления в Telegram
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              Экспортируйте данные для вашего Telegram-бота, чтобы получать своевременные напоминания о предстоящих платежах.
            </p>
            <ExportData 
              subscriptions={subscriptions} 
              onImport={handleImportSubscriptions}
              categories={categories}
            />
          </section>
        </main>
        
        <footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400 mb-2 sm:mb-4 md:mb-6 lg:mb-8 flex-shrink-0">
          <p>© {new Date().getFullYear()} Трекер расходов. Разработано с React + Express + TailwindCSS.</p>
        </footer>
      </div>

      {/* Модальное окно */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          modalType === 'category' 
            ? (editingCategory ? "Редактировать категорию" : "Добавить новую категорию")
            : (editingSubscription ? "Редактировать подписку" : "Добавить новую подписку")
        }
      >
        {modalType === 'category' ? (
          <CategoryForm
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            initialData={editingCategory}
            isEditMode={!!editingCategory}
            onClose={closeModal}
          />
        ) : (
          <SubscriptionForm
            onAddSubscription={handleAddSubscription}
            onUpdateSubscription={handleUpdateSubscription}
            initialData={editingSubscription}
            isEditMode={!!editingSubscription}
            categories={categories}
            selectedCategory={selectedCategory}
          />
        )}
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