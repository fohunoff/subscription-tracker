import React from 'react';
import { CalendarDaysIcon, TrashIcon, CurrencyDollarIcon, PencilSquareIcon, BellIcon, BellSlashIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../shared/utils';
import { ServiceIcon } from '../../shared';
import { getCycleMeta, isSubscriptionExpired } from '../../shared/utils/cycle';

// fallback currency symbols
const CURRENCY_SYMBOLS = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  RSD: 'дин.',
};


// as: тег обёртки. В списке внутри <ul> это <li>, а в сплошном списке карточка
// вкладывается в собственный <li> вместе с подписью даты — там нужен <div>.
// Wrapper используется как JSX-тег ниже, но без eslint-plugin-react линтер
// этого не видит — отсюда отключение правила.
// eslint-disable-next-line no-unused-vars
function SubscriptionItem({ subscription, onDeleteSubscription, onEditSubscription, onArchiveSubscription, onOpenDetails, as: Wrapper = 'li' }) {
  const cycleMeta = getCycleMeta(subscription.cycle);
  const cycleText = cycleMeta.shortLabel;
  // Срок мог истечь, а подписка остаться в списке — если выключен archiveOnEnd
  const isExpired = isSubscriptionExpired(subscription);
  const endDateText = subscription.endDate
    ? new Date(subscription.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  // Для ежемесячных достаточно дня месяца, остальным нужна дата: по ней видно,
  // в какие именно месяцы приходится платёж.
  const isMonthly = subscription.cycle === 'monthly';

  return (
    <Wrapper className="bg-slate-50 hover:bg-slate-100 p-4 rounded-lg shadow-sm border border-slate-200 transition-all duration-150 ease-in-out flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4">
      {/* Иконка внутри кликабельной области, а не отдельной колонкой: по ней
          открываются те же детали, что и по названию, — на телефоне это
          заметно более крупная цель, чем строка текста */}
      <div
        className={`flex-1 min-w-0 flex items-start gap-3 ${onOpenDetails ? 'cursor-pointer' : ''}`}
        onClick={onOpenDetails ? () => onOpenDetails(subscription) : undefined}
        onKeyDown={onOpenDetails ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDetails(subscription);
          }
        } : undefined}
        role={onOpenDetails ? 'button' : undefined}
        tabIndex={onOpenDetails ? 0 : undefined}
        title={onOpenDetails ? 'Открыть детали подписки' : undefined}
      >
        <ServiceIcon
          url={subscription.url}
          name={subscription.name}
          color={subscription.category?.color}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
        {/* На узких экранах название переносится на две строки, а не режется
            многоточием: «Мобильная связь МТС (архивный тариф…)» теряла в
            обрезке больше половины текста, а раскрыть её было негде */}
        <h3 className="text-lg font-semibold text-slate-800 flex items-start gap-2" title={subscription.name}>
          <span className="line-clamp-2 sm:truncate">{subscription.name}</span>
          {isExpired && (
            <span className="flex-shrink-0 text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              срок истёк
            </span>
          )}
        </h3>
        {/* Цена и дата платежа переносятся, а не делят строку пополам: на 390px
            в две колонки каждая из них ужималась до трёх слов на строку */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 mt-1">
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-4 w-4 mr-1 flex-shrink-0 text-slate-500" />
            <span>{formatCurrency(subscription.cost, subscription.currency)} / {cycleText}</span>
          </div>
          <div className="flex items-start">
            <CalendarDaysIcon className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0 text-slate-500" />
            <span>
              {isMonthly
                ? `День оплаты: ${subscription.paymentDay} число каждого месяца`
                : (() => {
                    let date;
                    if (subscription.fullPaymentDate) {
                      date = new Date(subscription.fullPaymentDate);
                    } else {
                      // fallback: текущий год, месяц и paymentDay
                      const today = new Date();
                      date = new Date(today.getFullYear(), today.getMonth(), subscription.paymentDay);
                    }
                    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                    return subscription.cycle === 'quarterly'
                      ? `Оплата: ${dateStr}, далее каждые 3 месяца`
                      : `Дата оплаты: ${dateStr} каждого года`;
                  })()
              }
            </span>
          </div>
        </div>

        {endDateText && (
          <p className={`text-xs mt-1 ${isExpired ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {isExpired
              ? `Срок истёк ${endDateText} — в суммах не учитывается`
              : `Действует до ${endDateText}`}
          </p>
        )}
        </div>
      </div>
      <div className="flex items-center space-x-2 self-start sm:self-center">
        {/* Иконка статуса уведомлений */}
        <button
          onClick={() => onEditSubscription(subscription)}
          className={`p-3 sm:p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors duration-150 ${
            subscription.notificationsEnabled
              ? 'focus:ring-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
              : 'focus:ring-slate-500 text-slate-400 bg-slate-100 dark:bg-slate-700/30'
          }`}
          title={subscription.notificationsEnabled ? `Уведомления включены (за ${subscription.notifyDaysBefore?.join(', ') || 0} дн.)` : 'Уведомления выключены'}
        >
          {subscription.notificationsEnabled ? (
            <BellIcon className="h-5 w-5" />
          ) : (
            <BellSlashIcon className="h-5 w-5" />
          )}
        </button>

        <button
          onClick={() => onEditSubscription(subscription)}
          className="p-3 sm:p-2 rounded-md text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900/30 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 transition-colors duration-150"
          aria-label={`Редактировать подписку ${subscription.name}`}
        >
          <PencilSquareIcon className="h-5 w-5" />
        </button>
        {onArchiveSubscription && (
          <button
            onClick={() => onArchiveSubscription(subscription)}
            className="p-3 sm:p-2 rounded-md text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-50 transition-colors duration-150"
            aria-label={`Завершить подписку ${subscription.name}`}
            title="Завершить подписку — уйдёт в архив с сохранением настроек"
          >
            <ArchiveBoxIcon className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => onDeleteSubscription(subscription.id)}
          className="p-3 sm:p-2 rounded-md text-brand-danger hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-brand-danger focus:ring-opacity-50 transition-colors duration-150"
          aria-label={`Удалить подписку ${subscription.name}`}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </Wrapper>
  );
}

export default SubscriptionItem;