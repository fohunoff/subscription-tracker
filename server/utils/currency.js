// Пересчёт стоимости подписок в одну валюту. Зеркало src/shared/utils/currency.js —
// формула должна совпадать, иначе цифры в приложении и в Telegram разойдутся.

import { getMonthlyCost, getAnnualCost } from './cycle.js';

// Единственный список валют на сервере: enum в моделях и валидация подписок
// берут коды отсюда, чтобы новая валюта добавлялась в одном месте.
// Клиентский аналог — CURRENCIES в src/shared/utils/currency.js.
export const CURRENCY_CODES = ['RUB', 'USD', 'EUR', 'RSD'];

export const isValidCurrency = (currency) => CURRENCY_CODES.includes(currency);

export const DEFAULT_BASE_CURRENCY = 'RUB';

/**
 * Курсы в CurrencyRate заданы относительно рубля: значение — сколько рублей
 * стоит единица валюты (RUB: 1). Поэтому пересчёт всегда идёт через рубль.
 */
const convert = (amount, fromCurrency, rates = {}, baseCurrency = DEFAULT_BASE_CURRENCY) => {
  const rate = rates[fromCurrency] || 1;
  const rateToBase = rates[baseCurrency] || 1;
  return (amount * rate) / rateToBase;
};

/**
 * Месячная стоимость подписки в базовой валюте.
 *
 * Любая сумма по нескольким подпискам обязана идти через эту функцию:
 * в списке смешаны RUB, USD, EUR и RSD, и сложение сырых `getMonthlyCost`
 * даёт число без валюты, которое всё равно чем-нибудь подпишут.
 */
export const getMonthlyCostInBase = (subscription, rates, baseCurrency) =>
  convert(getMonthlyCost(subscription), subscription.currency, rates, baseCurrency);

/**
 * Годовая стоимость подписки в базовой валюте.
 */
export const getAnnualCostInBase = (subscription, rates, baseCurrency) =>
  convert(getAnnualCost(subscription), subscription.currency, rates, baseCurrency);

/**
 * Месячные и годовые суммы, разложенные по валютам подписок.
 * Зеркало getTotalsByCurrency из src/shared/utils/currency.js.
 *
 * Единственное законное сложение сырых стоимостей: суммируем внутри одной
 * валюты, курсы не участвуют — в отличие от итога в базовой валюте, эти числа
 * не меняются от того, каким сегодня пришёл курс.
 *
 * Порядок — алфавитный по коду валюты.
 */
export const getTotalsByCurrency = (subscriptions = []) => {
  const totals = new Map();

  for (const subscription of subscriptions) {
    const currency = subscription.currency || DEFAULT_BASE_CURRENCY;
    const current = totals.get(currency) || { monthly: 0, annual: 0, count: 0 };
    totals.set(currency, {
      monthly: current.monthly + getMonthlyCost(subscription),
      annual: current.annual + getAnnualCost(subscription),
      count: current.count + 1
    });
  }

  return [...totals.entries()]
    .map(([currency, sums]) => ({ currency, ...sums }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
};
