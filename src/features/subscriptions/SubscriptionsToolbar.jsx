import React from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

/**
 * Поиск по подпискам и переключатель представления.
 * Вид запоминается между сессиями (см. useViewMode в App).
 */
function SubscriptionsToolbar({ searchQuery, onSearchChange, viewMode, onViewModeChange, foundCount }) {
  const buttonBase =
    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50';
  const activeClass = 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm';
  const inactiveClass = 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск по названию или категории"
          aria-label="Поиск по подпискам"
          className="block w-full text-sm rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 pl-10 pr-9 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Очистить поиск"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {searchQuery && (
          <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Найдено: {foundCount}
          </span>
        )}

        <div className="inline-flex bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1" role="group" aria-label="Вид отображения">
          <button
            type="button"
            onClick={() => onViewModeChange('categories')}
            className={`${buttonBase} ${viewMode === 'categories' ? activeClass : inactiveClass}`}
            aria-pressed={viewMode === 'categories'}
          >
            <Squares2X2Icon className="h-4 w-4" />
            Категории
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`${buttonBase} ${viewMode === 'list' ? activeClass : inactiveClass}`}
            aria-pressed={viewMode === 'list'}
          >
            <ListBulletIcon className="h-4 w-4" />
            Списком
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionsToolbar;
