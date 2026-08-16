import React from 'react';
import { DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SubscriptionItem from './SubscriptionItem';
import { getNextPaymentDate } from '../../shared/utils/cycle';

const MONTH_FORMAT = { day: 'numeric', month: 'long' };

/**
 * Сплошной список подписок, отсортированный по дате ближайшего платежа:
 * квартальные и годовые встают между месячными в своём месяце.
 * Подписки группируются по месяцу платежа, чтобы лента читалась как календарь.
 */
function FlatSubscriptionList({
  subscriptions,
  categories = [],
  onDeleteSubscription,
  onEditSubscription,
  onArchiveSubscription,
  emptyMessage
}) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 px-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
        <DocumentMagnifyingGlassIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
        <p className="text-xl font-medium text-slate-600 dark:text-slate-300">
          {emptyMessage || 'Список подписок пуст.'}
        </p>
      </div>
    );
  }

  // Группировка по месяцу ближайшего платежа. Подписки без даты собираются
  // в отдельную группу в конце.
  const groups = [];
  const groupIndexByKey = new Map();

  subscriptions.forEach((sub) => {
    const nextDate = getNextPaymentDate(sub);
    const key = nextDate ? `${nextDate.getFullYear()}-${nextDate.getMonth()}` : 'no-date';

    if (!groupIndexByKey.has(key)) {
      groupIndexByKey.set(key, groups.length);
      groups.push({
        key,
        title: nextDate
          ? nextDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
          : 'Без даты платежа',
        items: []
      });
    }

    groups[groupIndexByKey.get(key)].items.push({ subscription: sub, nextDate });
  });

  const categoryName = (sub) =>
    sub.category?.name || categories.find(cat => cat.id === sub.categoryId)?.name;

  return (
    <div className="space-y-8">
      {groups.map(group => (
        <div key={group.key}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            {group.title}
          </h3>
          <ul className="space-y-4">
            {group.items.map(({ subscription, nextDate }) => (
              <li key={subscription.id}>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1 ml-1">
                  {nextDate && (
                    <span className="font-medium">
                      {nextDate.toLocaleDateString('ru-RU', MONTH_FORMAT)}
                    </span>
                  )}
                  {categoryName(subscription) && (
                    <>
                      {nextDate && <span aria-hidden="true">·</span>}
                      <span>{categoryName(subscription)}</span>
                    </>
                  )}
                </div>
                <SubscriptionItem
                  as="div"
                  subscription={subscription}
                  onDeleteSubscription={onDeleteSubscription}
                  onEditSubscription={onEditSubscription}
                  onArchiveSubscription={onArchiveSubscription}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default FlatSubscriptionList;
