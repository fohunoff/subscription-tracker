import React, { useEffect, useRef, useState } from 'react';
import {
  PencilSquareIcon,
  ArchiveBoxIcon,
  TrashIcon,
  BellIcon,
  BellSlashIcon
} from '@heroicons/react/24/outline';
import { formatCurrency } from '../../shared/utils';
import { getCycleMeta, getNextPaymentDate } from '../../shared/utils/cycle';
import { getMonthlyCostInBase } from '../../shared/utils/currency';
import { formatHistoryEvent } from './utils/formatHistoryEvent';

const formatFullDate = (date) =>
  date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

const daysUntilText = (date) => {
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const days = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';

  // 11–14 — исключение из общего правила склонения
  const lastTwo = days % 100;
  const last = days % 10;
  const word =
    lastTwo >= 11 && lastTwo <= 14 ? 'дней' : last === 1 ? 'день' : last >= 2 && last <= 4 ? 'дня' : 'дней';

  return `через ${days} ${word}`;
};

/**
 * Детальная карточка подписки: сводка по цифрам и датам + история изменений
 * из лога (GET /api/subscriptions/:id/history).
 */
function SubscriptionDetails({
  subscription,
  categories = [],
  currencyRates = {},
  baseCurrency = 'RUB',
  onLoadHistory,
  onEdit,
  onArchive,
  onDelete
}) {
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Методы api пересоздаются на каждом рендере AuthContext, поэтому держим
  // колбэк в ref: иначе эффект перезапрашивал бы историю при любом рендере
  // родителя — например, на каждое нажатие клавиши в поиске.
  const loadHistoryRef = useRef(onLoadHistory);
  loadHistoryRef.current = onLoadHistory;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const events = await loadHistoryRef.current(subscription.id);
        if (!cancelled) setHistory(events);
      } catch (error) {
        if (!cancelled) setHistoryError(error.message || 'Не удалось загрузить историю');
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    };

    load();
    // Окно может закрыться до ответа сервера — тогда состояние трогать нельзя
    return () => { cancelled = true; };
  }, [subscription.id]);

  const cycleMeta = getCycleMeta(subscription.cycle);
  const nextPayment = getNextPaymentDate(subscription);
  const monthlyInBase = getMonthlyCostInBase(subscription, currencyRates, baseCurrency);
  const annualInBase = monthlyInBase * 12;

  const categoryName =
    subscription.category?.name || categories.find(cat => cat.id === subscription.categoryId)?.name;

  const isArchived = subscription.status === 'archived';

  const rowClass = 'flex items-baseline justify-between gap-4 py-2';
  const labelClass = 'text-sm text-slate-500 dark:text-slate-400';
  const valueClass = 'text-sm font-medium text-slate-700 dark:text-slate-200 text-right';

  return (
    <div className="space-y-6">
      {/* Заголовок: категория и цикл */}
      <div className="flex items-center gap-2 flex-wrap">
        {subscription.category?.color && (
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: subscription.category.color }}
          />
        )}
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {categoryName || 'Без категории'} · {cycleMeta.label}
        </span>
        {isArchived && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            в архиве
          </span>
        )}
      </div>

      {/* Стоимость */}
      <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4">
        <p className="text-3xl font-bold text-brand-primary">
          {formatCurrency(subscription.cost, subscription.currency)}
          <span className="text-base font-normal text-slate-500 dark:text-slate-400"> / {cycleMeta.shortLabel}</span>
        </p>

        {/* Для месячных подписок в базовой валюте пересчёт не добавляет информации */}
        {(subscription.cycle !== 'monthly' || subscription.currency !== baseCurrency) && (
          <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <p>≈ {formatCurrency(monthlyInBase, baseCurrency)} в месяц</p>
            <p>≈ {formatCurrency(annualInBase, baseCurrency)} в год</p>
          </div>
        )}
      </div>

      {/* Даты и уведомления */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {nextPayment && !isArchived && (
          <div className={rowClass}>
            <span className={labelClass}>Ближайший платёж</span>
            <span className={valueClass}>
              {formatFullDate(nextPayment)}
              <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">
                {daysUntilText(nextPayment)}
              </span>
            </span>
          </div>
        )}

        {subscription.paymentDay && subscription.cycle === 'monthly' && (
          <div className={rowClass}>
            <span className={labelClass}>День оплаты</span>
            <span className={valueClass}>{subscription.paymentDay} число</span>
          </div>
        )}

        {isArchived && subscription.endDate && (
          <div className={rowClass}>
            <span className={labelClass}>Завершена</span>
            <span className={valueClass}>{formatFullDate(new Date(subscription.endDate))}</span>
          </div>
        )}

        <div className={rowClass}>
          <span className={labelClass}>Уведомления</span>
          <span className={`${valueClass} flex items-center gap-1.5 justify-end`}>
            {subscription.notificationsEnabled ? (
              <>
                <BellIcon className="h-4 w-4 text-emerald-600" />
                {subscription.notifyDaysBefore?.length
                  ? `за ${subscription.notifyDaysBefore.join(', ')} дн.`
                  : 'включены'}
              </>
            ) : (
              <>
                <BellSlashIcon className="h-4 w-4 text-slate-400" />
                выключены
              </>
            )}
          </span>
        </div>

        {subscription.createdAt && (
          <div className={rowClass}>
            <span className={labelClass}>Добавлена</span>
            <span className={valueClass}>{formatFullDate(new Date(subscription.createdAt))}</span>
          </div>
        )}
      </div>

      {/* История изменений */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">История</h3>

        {isLoadingHistory ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Загрузка истории…</p>
        ) : historyError ? (
          <p className="text-sm text-brand-danger">{historyError}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Изменений пока нет. Лог ведётся с момента обновления приложения, поэтому
            у давно созданных подписок история начнётся с первой правки.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((rawEvent) => {
              const event = formatHistoryEvent(rawEvent, { categories });
              return (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap w-20 flex-shrink-0">
                    {event.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="min-w-0">
                    {event.changes.length > 0 ? (
                      <ul className="space-y-0.5">
                        {event.changes.map(change => (
                          <li key={change.field} className="text-slate-600 dark:text-slate-300">
                            {change.label}: <span className="text-slate-400 dark:text-slate-500">{change.from}</span>
                            {' → '}
                            <span className="font-medium">{change.to}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">{event.title}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Действия */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => onEdit(subscription)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-sky-700 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/40 transition-colors"
        >
          <PencilSquareIcon className="h-4 w-4" />
          Редактировать
        </button>

        {!isArchived && (
          <button
            type="button"
            onClick={() => onArchive(subscription)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 transition-colors"
          >
            <ArchiveBoxIcon className="h-4 w-4" />
            Завершить
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(subscription)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 transition-colors ml-auto"
        >
          <TrashIcon className="h-4 w-4" />
          Удалить
        </button>
      </div>
    </div>
  );
}

export default SubscriptionDetails;
