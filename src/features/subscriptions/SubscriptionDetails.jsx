import React, { useEffect, useRef, useState } from 'react';
import { BellIcon, BellSlashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { formatCurrency, getSiteHost } from '../../shared/utils';
import { ServiceIcon } from '../../shared';
import {
  getCycleMeta,
  getNextPaymentDate,
  getLastPaymentDate,
  isSubscriptionExpired
} from '../../shared/utils/cycle';
import { getMonthlyCostInBase } from '../../shared/utils/currency';
import { formatHistoryEvent } from './utils/formatHistoryEvent';

// Сколько записей истории показывать до нажатия «показать всю»
const HISTORY_PREVIEW_SIZE = 12;

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
 *
 * Кнопки действий живут отдельно — в `SubscriptionDetailsActions`, который
 * рендерится в закреплённом футере панели.
 */
function SubscriptionDetails({
  subscription,
  categories = [],
  currencyRates = {},
  baseCurrency = 'RUB',
  onLoadHistory
}) {
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  // Платежи пишутся в лог автоматически, поэтому у давней подписки история —
  // это десятки записей. Показываем последние, остальное по требованию.
  const [showAllHistory, setShowAllHistory] = useState(false);

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

  const siteHost = getSiteHost(subscription.url);
  const isArchived = subscription.status === 'archived';
  // Срок истёк, но подписка осталась в списке — archiveOnEnd выключен
  const isExpired = !isArchived && isSubscriptionExpired(subscription);
  const lastPayment = getLastPaymentDate(subscription);

  const rowClass = 'flex items-baseline justify-between gap-4 py-2';
  const labelClass = 'text-sm text-slate-500 dark:text-slate-400';
  const valueClass = 'text-sm font-medium text-slate-700 dark:text-slate-200 text-right';

  return (
    <div className="space-y-6">
      {/* Заголовок: иконка сервиса, категория, цикл и ссылка на сайт.
          Название подписки сюда не дублируется — оно в шапке панели */}
      <div className="flex items-start gap-3">
        <ServiceIcon
          url={subscription.url}
          name={subscription.name}
          color={subscription.category?.color}
          size="lg"
        />

        <div className="min-w-0 flex-1 space-y-1">
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
            {isExpired && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                срок истёк
              </span>
            )}
          </div>

          {/* Ссылка живёт только здесь, а не на карточке: в списке она увела бы
              со страницы по случайному промаху мимо кнопок */}
          {siteHost && (
            <a
              href={subscription.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline break-all"
            >
              {siteHost}
              <ArrowTopRightOnSquareIcon className="h-4 w-4 flex-shrink-0" />
            </a>
          )}
        </div>
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

      {/* Даты по ходу жизни подписки: старт → окончание → ближайшее списание.
          Ближайший платёж вынесен из списка в акцентный блок — это единственная
          дата, ради которой панель открывают чаще всего */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {/* Дата старта: от неё считаются все платежи, включая восстановленные
            бэкфиллом, — без неё непонятно, откуда в истории взялся первый */}
        {subscription.fullPaymentDate && (
          <div className={rowClass}>
            <span className={labelClass}>Первый платёж</span>
            <span className={valueClass}>{formatFullDate(new Date(subscription.fullPaymentDate))}</span>
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

        {!isArchived && subscription.endDate && (
          <div className={rowClass}>
            <span className={labelClass}>{isExpired ? 'Срок истёк' : 'Действует до'}</span>
            <span className={valueClass}>
              {formatFullDate(new Date(subscription.endDate))}
              <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">
                {subscription.archiveOnEnd !== false
                  ? (isExpired ? 'уйдёт в архив при ближайшей проверке' : 'после окончания уйдёт в архив')
                  : 'остаётся в списке после окончания'}
              </span>
            </span>
          </div>
        )}

        {/* Последний платёж имеет смысл только при заданном сроке: без него
            подписка длится бессрочно и «последнего» списания не существует */}
        {lastPayment && !isArchived && (
          <div className={rowClass}>
            <span className={labelClass}>{isExpired ? 'Последний платёж' : 'Последний платёж будет'}</span>
            <span className={valueClass}>{formatFullDate(lastPayment)}</span>
          </div>
        )}
      </div>

      {nextPayment && !isArchived && (
        <div className="flex items-baseline justify-between gap-4 rounded-lg border border-brand-primary/30 bg-brand-primary/5 dark:bg-brand-primary/10 px-4 py-3">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Ближайший платёж</span>
          <span className="text-right">
            <span className="text-base font-semibold text-brand-primary">{formatFullDate(nextPayment)}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {daysUntilText(nextPayment)}
            </span>
          </span>
        </div>
      )}

      <div className="divide-y divide-slate-200 dark:divide-slate-700">
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
      </div>

      {/* Дата добавления в трекер ничего не говорит о самой подписке —
          мелкой подписью, а не строкой наравне с датами платежей */}
      {subscription.createdAt && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Добавлена в трекер {formatFullDate(new Date(subscription.createdAt))}
        </p>
      )}

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
            {(showAllHistory ? history : history.slice(0, HISTORY_PREVIEW_SIZE)).map((rawEvent) => {
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
                      <>
                        <span className="text-slate-600 dark:text-slate-300">{event.title}</span>
                        {event.details.map((detail) => (
                          <span
                            key={detail}
                            className="block text-xs text-slate-400 dark:text-slate-500"
                          >
                            {detail}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!isLoadingHistory && !showAllHistory && history.length > HISTORY_PREVIEW_SIZE && (
          <button
            type="button"
            onClick={() => setShowAllHistory(true)}
            className="mt-3 text-sm text-brand-primary hover:underline"
          >
            Показать всю историю ({history.length})
          </button>
        )}
      </div>
    </div>
  );
}

export default SubscriptionDetails;
