import React from 'react';

/**
 * Заглушки на время загрузки. В отличие от спиннера показывают будущую
 * структуру блока, поэтому при появлении данных страница не «прыгает».
 */

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />;
}

/** Заглушка карточки подписки — повторяет её размеры */
export function SubscriptionSkeleton() {
  return (
    <li className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-9 rounded-md" />)}
      </div>
    </li>
  );
}

export function SubscriptionListSkeleton({ count = 3 }) {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="Загрузка подписок">
      {Array.from({ length: count }, (_, i) => <SubscriptionSkeleton key={i} />)}
    </ul>
  );
}

/** Заглушка блока общих расходов */
export function TotalExpensesSkeleton() {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl p-6 md:p-8 mb-6" aria-busy="true">
      <div className="flex flex-col items-center mb-6 space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Заглушка секции категории */
export function CategorySkeleton() {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl p-6 md:p-8" aria-busy="true">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-7 w-44" />
      </div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-28" />
      </div>
      <SubscriptionListSkeleton count={2} />
    </section>
  );
}

export default Skeleton;
