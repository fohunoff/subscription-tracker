import { useMemo } from 'react';
import { getNextPaymentDate } from '../../../shared/utils/cycle';

/**
 * Поиск идёт по названию подписки и названию её категории — так «музыка»
 * находит всё содержимое категории, а «spot» — конкретный сервис.
 */
export const matchesQuery = (subscription, query, categories = []) => {
  if (!query) return true;

  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  if (subscription.name?.toLowerCase().includes(needle)) return true;

  // У активных подписок категория приходит вложенным объектом, у остальных —
  // только идентификатором, поэтому подстраховываемся списком категорий.
  const categoryName =
    subscription.category?.name ||
    categories.find(cat => cat.id === subscription.categoryId)?.name;

  return Boolean(categoryName?.toLowerCase().includes(needle));
};

/**
 * Сортировка сплошного списка: по дате ближайшего платежа, чтобы годовые и
 * квартальные вставали между месячными в своём месяце. Подписки без даты
 * (категории без напоминаний) уходят в конец, там — по названию.
 */
const byNextPayment = (a, b) => {
  const dateA = getNextPaymentDate(a);
  const dateB = getNextPaymentDate(b);

  if (dateA && dateB) {
    const diff = dateA - dateB;
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  }
  if (dateA) return -1;
  if (dateB) return 1;
  return a.name.localeCompare(b.name);
};

export function useSubscriptionFilters({
  subscriptions,
  archivedSubscriptions,
  categories,
  searchQuery
}) {
  const filteredSubscriptions = useMemo(
    () => subscriptions.filter(sub => matchesQuery(sub, searchQuery, categories)),
    [subscriptions, searchQuery, categories]
  );

  const filteredArchived = useMemo(
    () => archivedSubscriptions.filter(sub => matchesQuery(sub, searchQuery, categories)),
    [archivedSubscriptions, searchQuery, categories]
  );

  const flatSubscriptions = useMemo(
    () => [...filteredSubscriptions].sort(byNextPayment),
    [filteredSubscriptions]
  );

  // При активном поиске категории без совпадений скрываем, чтобы не листать пустые блоки
  const categoriesWithSubscriptions = useMemo(() => {
    const grouped = categories.map(category => ({
      ...category,
      subscriptions: filteredSubscriptions.filter(sub => sub.categoryId === category.id)
    }));

    return searchQuery.trim()
      ? grouped.filter(category => category.subscriptions.length > 0)
      : grouped;
  }, [categories, filteredSubscriptions, searchQuery]);

  return {
    filteredSubscriptions,
    filteredArchived,
    flatSubscriptions,
    categoriesWithSubscriptions,
    hasQuery: Boolean(searchQuery.trim()),
    totalFound: filteredSubscriptions.length + filteredArchived.length
  };
}
