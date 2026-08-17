// Единый список валют для селектов. Набор кодов должен совпадать с enum
// в server/models/Subscription.js и проверкой в server/utils/index.js.

import { getMonthlyCost } from './cycle';

export const CURRENCIES = {
  RUB: { symbol: '₽', label: 'RUB (₽)' },
  USD: { symbol: '$', label: 'USD ($)' },
  EUR: { symbol: '€', label: 'EUR (€)' },
  RSD: { symbol: 'дин.', label: 'RSD (дин.)' },
};

export const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const DEFAULT_CURRENCY = 'RUB';

/**
 * Месячная стоимость подписки в базовой валюте.
 *
 * Курсы заданы относительно рубля (сколько рублей стоит единица валюты,
 * RUB: 1), поэтому пересчёт идёт через рубль. Складывать `getMonthlyCost`
 * напрямую нельзя: в списке смешаны RUB, USD, EUR и RSD — любая сумма по
 * нескольким подпискам должна проходить через эту функцию.
 */
export const getMonthlyCostInBase = (subscription, currencyRates = {}, baseCurrency = DEFAULT_CURRENCY) => {
  const rate = currencyRates[subscription.currency] || 1;
  const rateToBase = currencyRates[baseCurrency] || 1;
  return (getMonthlyCost(subscription) * rate) / rateToBase;
};

/**
 * Месячные суммы, разложенные по валютам подписок: «4000 RSD / 32000 RUB».
 *
 * Единственное место, где сырые `getMonthlyCost` складываются напрямую, и это
 * законно: суммируем только внутри одной валюты, курсы не участвуют вовсе.
 * Пересчёт в базовую валюту зависит от курса на сегодня, а такая разбивка —
 * нет: она показывает, сколько списывается по каждой валюте на самом деле.
 *
 * Порядок валют — алфавитный по коду, чтобы строка не переставлялась при
 * добавлении и удалении подписок.
 */
export const getTotalsByCurrency = (subscriptions = []) => {
  const totals = new Map();

  subscriptions.forEach((subscription) => {
    const currency = subscription.currency || DEFAULT_CURRENCY;
    totals.set(currency, (totals.get(currency) || 0) + getMonthlyCost(subscription));
  });

  return [...totals.entries()]
    .map(([currency, monthly]) => ({ currency, monthly }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
};
