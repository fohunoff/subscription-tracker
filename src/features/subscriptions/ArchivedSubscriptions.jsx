import React, { useEffect, useState } from 'react';
import {
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { formatCurrency } from '../../shared/utils';
import { getCycleMeta } from '../../shared/utils/cycle';

/**
 * Завершённые подписки. Живут отдельно от категорий и не участвуют
 * ни в суммах, ни в уведомлениях, но сохраняют все настройки —
 * восстановление возвращает подписку в прежнем виде.
 */
function ArchivedSubscriptions({
  archivedSubscriptions,
  isLoading,
  onLoad,
  onRestore,
  onDelete,
  searchQuery = '',
  matchCount = 0
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const hasQuery = Boolean(searchQuery.trim());

  // Поиск охватывает и архив, поэтому при вводе запроса подгружаем его,
  // даже если раздел ни разу не открывали.
  useEffect(() => {
    if (hasQuery && !hasLoaded) {
      setHasLoaded(true);
      onLoad();
    }
  }, [hasQuery, hasLoaded, onLoad]);

  // При активном поиске раздел раскрыт, если в нём есть совпадения
  const expanded = hasQuery ? matchCount > 0 : isExpanded;

  // Архив грузим только когда его действительно открывают
  const toggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !hasLoaded) {
      setHasLoaded(true);
      onLoad();
    }
  };

  const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <section aria-labelledby="archive-heading" className="bg-white dark:bg-slate-800 rounded-xl p-6 md:p-8">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <h2 id="archive-heading" className="text-2xl font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <ArchiveBoxIcon className="h-6 w-6 text-slate-400" />
          Архив подписок
          {hasLoaded && archivedSubscriptions.length > 0 && (
            <span className="text-base font-normal text-slate-500 dark:text-slate-400">
              ({archivedSubscriptions.length})
            </span>
          )}
        </h2>
        <ChevronDownIcon
          className={`h-6 w-6 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-300">Загрузка архива...</p>
            </div>
          ) : archivedSubscriptions.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              {hasQuery
                ? 'В архиве ничего не найдено.'
                : 'Архив пуст. Завершённые подписки попадут сюда и сохранят все настройки.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {archivedSubscriptions.map((sub) => (
                <li
                  key={sub.id}
                  className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-600 dark:text-slate-300 truncate" title={sub.name}>
                      {sub.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {formatCurrency(sub.cost, sub.currency)} / {getCycleMeta(sub.cycle).shortLabel}
                      {sub.category?.name && ` · ${sub.category.name}`}
                    </p>
                    {formatDate(sub.endDate) && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Завершена: {formatDate(sub.endDate)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      onClick={() => onRestore(sub.id)}
                      className="p-2 rounded-md text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 transition-colors duration-150"
                      aria-label={`Восстановить подписку ${sub.name}`}
                      title="Восстановить со всеми настройками"
                    >
                      <ArrowUturnLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onDelete(sub)}
                      className="p-2 rounded-md text-brand-danger hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-brand-danger focus:ring-opacity-50 transition-colors duration-150"
                      aria-label={`Удалить подписку ${sub.name} навсегда`}
                      title="Удалить навсегда"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default ArchivedSubscriptions;
