// Единый список валют для селектов. Набор кодов должен совпадать с enum
// в server/models/Subscription.js и проверкой в server/utils/index.js.

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
