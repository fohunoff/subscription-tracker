import React from 'react';
import { CalendarDaysIcon, TrashIcon, CurrencyDollarIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

function SubscriptionItem({ subscription, onDeleteSubscription, onEditSubscription }) {
  const cycleText = subscription.cycle === 'annually' ? 'год' : 'мес.';
  
  let currencySymbol = subscription.currency;
  if (subscription.currency === 'RUB') currencySymbol = '₽';
  else if (subscription.currency === 'USD') currencySymbol = '$';
  else if (subscription.currency === 'EUR') currencySymbol = '€';

  return (
    <li className="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg shadow-sm border border-slate-200 transition-all duration-150 ease-in-out flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-slate-800 truncate" title={subscription.name}>
          {subscription.name}
        </h3>
        <div className="flex items-center space-x-3 text-sm text-slate-600 mt-1">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-4 w-4 mr-1 text-slate-500" />
            <span>{subscription.cost.toFixed(2)} {currencySymbol} / {cycleText}</span>
          </div>
          <div className="flex items-center">
            <CalendarDaysIcon className="h-4 w-4 mr-1 text-slate-500" />
            <span>День оплаты: {subscription.paymentDay}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 self-start sm:self-center">
        <button
          onClick={() => onEditSubscription(subscription)}
          className="p-2 rounded-md text-sky-600 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 transition-colors duration-150"
          aria-label={`Редактировать подписку ${subscription.name}`}
        >
          <PencilSquareIcon className="h-5 w-5" />
        </button>
        <button
          onClick={() => onDeleteSubscription(subscription.id)}
          className="p-2 rounded-md text-brand-danger hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-brand-danger focus:ring-opacity-50 transition-colors duration-150"
          aria-label={`Удалить подписку ${subscription.name}`}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </li>
  );
}

export default SubscriptionItem;