import React, { useEffect, useState } from 'react';
import { ChartBarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../shared/utils';
import { Skeleton } from '../../shared';
import SpendingChart from './SpendingChart';
import { PERIOD_OPTIONS } from './hooks/useSpending';

const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
];

const fullMonth = (key) => {
  const [year, month] = key.split('-');
  return `${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
};

/**
 * «Сколько уже потрачено» — суммы из лога платежей, а не из текущей цены
 * подписок: в каждой записи сохранена стоимость на момент списания.
 *
 * Данные грузятся при первом раскрытии — как и архив, блок нужен не всем
 * и не в каждый заход.
 */
function SpendingSection({ spending, isLoading, months, onLoad, isDark }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (isExpanded && !hasLoaded) {
      setHasLoaded(true);
      onLoad(months);
    }
  }, [isExpanded, hasLoaded, onLoad, months]);

  const baseCurrency = spending?.baseCurrency || 'RUB';
  const hasPayments = Boolean(spending && spending.paymentsCount > 0);
  // Доля оценок важна для доверия к цифре: часть истории восстановлена
  // бэкфиллом по логу изменений, а не наблюдалась приложением
  const estimatedShare = spending && spending.total > 0
    ? Math.round((spending.estimatedTotal / spending.total) * 100)
    : 0;

  return (
    <section aria-labelledby="spending-heading" className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 md:p-8">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={isExpanded}
      >
        <h2 id="spending-heading" className="text-xl sm:text-2xl font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 flex-shrink-0 text-slate-400" />
          Сколько уже потрачено
        </h2>
        <ChevronDownIcon
          className={`h-6 w-6 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {PERIOD_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onLoad(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  months === option.value
                    ? 'bg-brand-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !hasPayments ? (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">
                За выбранный период платежей не записано.
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                Списания попадают сюда автоматически, начиная с того дня, как подписка
                появилась в трекере. Прошлое можно достроить бэкфиллом — см. DEPLOY.md.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Всего за период
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-brand-primary">
                  {formatCurrency(spending.total, baseCurrency, 'ru-RU', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Платежей: {spending.paymentsCount}
                  {estimatedShare > 0 && (
                    <span className="text-slate-400 dark:text-slate-500">
                      {' · '}
                      {estimatedShare === 100
                        ? 'всё — оценка по истории изменений'
                        : `из них ${estimatedShare}% суммы — оценка`}
                    </span>
                  )}
                </p>
              </div>

              <SpendingChart
                months={spending.months}
                baseCurrency={baseCurrency}
                isDark={isDark}
              />

              {spending.topSubscriptions.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-4">
                    На что ушло больше всего:
                  </h3>
                  <ul className="space-y-2">
                    {spending.topSubscriptions.map(item => (
                      <li key={item.subscriptionId} className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-slate-700 dark:text-slate-200 truncate" title={item.name}>
                          {item.name}
                          <span className="text-slate-400 dark:text-slate-500"> · {item.count}</span>
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatCurrency(item.total, baseCurrency, 'ru-RU', { maximumFractionDigits: 0 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowTable(!showTable)}
                className="mt-6 text-sm text-brand-primary hover:underline"
              >
                {showTable ? 'Скрыть таблицу' : 'Показать таблицей'}
              </button>

              {showTable && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2 font-medium">Месяц</th>
                        <th className="py-2 font-medium text-right">Потрачено</th>
                        <th className="py-2 font-medium text-right">Платежей</th>
                        <th className="py-2 font-medium text-right">Из них оценка</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-200">
                      {spending.months.map(month => (
                        <tr key={month.month} className="border-b border-slate-100 dark:border-slate-700/50">
                          <td className="py-2">{fullMonth(month.month)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(month.total, baseCurrency, 'ru-RU', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 text-right tabular-nums">{month.count}</td>
                          <td className="py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                            {month.estimated > 0
                              ? formatCurrency(month.estimated, baseCurrency, 'ru-RU', { maximumFractionDigits: 0 })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {spending.ratesKnownFrom && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                  Суммы пересчитаны в {baseCurrency} по курсу на дату платежа.
                  Курсы известны с {fullMonth(spending.ratesKnownFrom.slice(0, 7))} —
                  более ранние платежи считаются по самому раннему известному курсу.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default SpendingSection;
