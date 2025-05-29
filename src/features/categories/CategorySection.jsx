import React, { useState } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { SubscriptionList } from '../subscriptions';
import { formatCurrency } from '../../shared/utils';

function CategorySection({ 
  category, 
  subscriptions, 
  currencyRates, 
  baseCurrency,
  onDeleteSubscription, 
  onEditSubscription,
  onAddSubscription,
  onEditCategory,
  onDeleteCategory,
  isLoadingData 
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const categorySubscriptions = subscriptions.filter(sub => sub.categoryId === category.id);

  // Рассчитываем общую стоимость подписок в категории
  const totalMonthlyCost = categorySubscriptions.reduce((total, sub) => {
    let monthlyCost = sub.cost;
    if (sub.cycle === 'annually') {
      monthlyCost = monthlyCost / 12;
    }
    const rate = currencyRates[sub.currency] || 1;
    return total + monthlyCost * rate;
  }, 0);

  const totalInBaseCurrency = totalMonthlyCost / (currencyRates[baseCurrency] || 1);

  const handleDeleteCategory = () => {
    if (category.isDefault) {
      alert('Нельзя удалить основную категорию');
      return;
    }

    if (categorySubscriptions.length > 0) {
      alert(`Нельзя удалить категорию, в которой есть подписки (${categorySubscriptions.length})`);
      return;
    }

    if (window.confirm(`Вы действительно хотите удалить категорию "${category.name}"?`)) {
      onDeleteCategory(category.id);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 shadow-xl rounded-xl p-6 md:p-8">
      <div 
        className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 select-none cursor-pointer group" 
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <div 
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <span>{category.name}</span>
            {!category.hasReminders && (
              <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                без напоминаний
              </span>
            )}
            {isLoadingData && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
            )}
            <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isExpanded ? '' : 'rotate-180'}`} />
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {categorySubscriptions.length > 0 && (
            <div className="text-left sm:text-right order-2 sm:order-1">
              <span className="text-sm text-slate-500 dark:text-slate-400 block">
                Итого в месяц ({categorySubscriptions.length}):
              </span>
              <p className="text-2xl font-bold" style={{ color: category.color }}>
                {formatCurrency(totalInBaseCurrency, baseCurrency)}
              </p>
            </div>
          )}

          <div className="order-1 sm:order-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onAddSubscription(category)}
              className="flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
              title="Добавить подписку в эту категорию"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Добавить</span>
            </button>

            <button
              onClick={() => onEditCategory(category)}
              className="p-2 rounded-md text-sky-600 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 transition-colors duration-150"
              title="Редактировать категорию"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>

            {!category.isDefault && (
              <button
                onClick={handleDeleteCategory}
                className="p-2 rounded-md text-brand-danger hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-brand-danger focus:ring-opacity-50 transition-colors duration-150"
                title="Удалить категорию"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-400 ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
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
              subscriptions={categorySubscriptions}
              onDeleteSubscription={onDeleteSubscription}
              onEditSubscription={onEditSubscription}
            />
            {categorySubscriptions.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 text-right">
                * Годовые подписки конвертированы в месячную стоимость.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default CategorySection;