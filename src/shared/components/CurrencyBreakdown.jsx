import React, { useMemo } from 'react';
import { formatCurrency } from '../utils';
import { getTotalsByCurrency } from '../utils/currency';

/**
 * Месячный расход в валютах самих подписок: «4 000 RSD / 32 000 ₽».
 *
 * Итог в базовой валюте зависит от курса на сегодня и завтра будет другим при
 * тех же подписках — эта строка показывает суммы, которые действительно
 * списываются. Копейки убраны намеренно: строка справочная и должна читаться
 * с одного взгляда.
 *
 * Скрывается, когда всё и так видно из основной цифры: единственная валюта
 * совпадает с базовой.
 */
const CurrencyBreakdown = ({ subscriptions, baseCurrency, className = '', separator = ' / ' }) => {
  const totals = useMemo(() => getTotalsByCurrency(subscriptions), [subscriptions]);

  if (totals.length === 0) return null;
  if (totals.length === 1 && totals[0].currency === baseCurrency) return null;

  return (
    <p className={className}>
      {totals
        .map(({ currency, monthly }) =>
          formatCurrency(monthly, currency, 'ru-RU', { maximumFractionDigits: 0 })
        )
        .join(separator)}
    </p>
  );
};

export default CurrencyBreakdown;
