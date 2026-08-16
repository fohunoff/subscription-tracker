// Форматирование сумм для сообщений бота. Символы валют раньше были продублированы
// в handlers.js и notificationService.js — одинаковые сообщения должны выглядеть
// одинаково независимо от того, кто их отправил: команда или планировщик.

const CURRENCY_SYMBOLS = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  RSD: 'дин.'
};

export const currencySymbol = (currency) => CURRENCY_SYMBOLS[currency] || currency;

/**
 * Сумма с символом валюты, как она задана у подписки.
 */
export const formatAmount = (cost, currency) => `${cost} ${currencySymbol(currency)}`;
