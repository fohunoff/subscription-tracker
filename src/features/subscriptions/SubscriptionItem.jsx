import React from 'react';
import { CalendarDaysIcon, TrashIcon, CurrencyDollarIcon, PencilSquareIcon, BellIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../shared/utils';

// fallback currency symbols
const CURRENCY_SYMBOLS = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  RSD: 'дин.',
};


function SubscriptionItem({ subscription, onDeleteSubscription, onEditSubscription }) {
  const cycleText = subscription.cycle === 'annually' ? 'год' : 'мес.';

  return (
    <li className="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg shadow-sm border border-slate-200 transition-all duration-150 ease-in-out flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-slate-800 truncate" title={subscription.name}>
          {subscription.name}
        </h3>
        <div className="flex items-center space-x-3 text-sm text-slate-600 mt-1">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-4 w-4 mr-1 text-slate-500" />
            <span>{formatCurrency(subscription.cost, subscription.currency)} / {cycleText}</span>
          </div>
          <div className="flex items-center">
            <CalendarDaysIcon className="h-4 w-4 mr-1 text-slate-500" />
            <span>
              {subscription.cycle === 'annually'
                ? (() => {
                    let date;
                    if (subscription.fullPaymentDate) {
                      date = new Date(subscription.fullPaymentDate);
                    } else {
                      // fallback: текущий год, месяц и paymentDay
                      const today = new Date();
                      date = new Date(today.getFullYear(), today.getMonth(), subscription.paymentDay);
                    }
                    return `Дата оплаты: ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} каждого года`;
                  })()
                : `День оплаты: ${subscription.paymentDay} число каждого месяца`
              }
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 self-start sm:self-center">
        {/* Иконка статуса уведомлений */}
        <div
          className={`p-2 rounded-md ${
            subscription.notificationsEnabled
              ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
              : 'text-slate-400 bg-slate-100 dark:bg-slate-700/30'
          }`}
          title={subscription.notificationsEnabled ? `Уведомления включены (за ${subscription.notifyDaysBefore?.join(', ') || 0} дн.)` : 'Уведомления выключены'}
        >
          {subscription.notificationsEnabled ? (
            <BellIcon className="h-5 w-5" />
          ) : (
            <BellSlashIcon className="h-5 w-5" />
          )}
        </div>

        <button
          onClick={() => onEditSubscription(subscription)}
          className="p-2 rounded-md text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/30 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 transition-colors duration-150"
          aria-label={`Редактировать подписку ${subscription.name}`}
        >
          <PencilSquareIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => onDeleteSubscription(subscription.id)}
          className="p-2 rounded-md text-brand-danger hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-brand-danger focus:ring-opacity-50 transition-colors duration-150"
          aria-label={`Удалить подписку ${subscription.name}`}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </li>
  );
}

export default SubscriptionItem;