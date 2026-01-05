import CurrencyRate from '../models/CurrencyRate.js';

// Резервные курсы на случай недоступности API
const FALLBACK_RATES = {
  RUB: 1,
  USD: 95.50,
  EUR: 103.20,
  RSD: 0.87
};

/**
 * Получить курсы валют из внешнего API
 */
async function fetchCurrencyRatesFromAPI() {
  try {
    // Используем ExchangeRate-API (бесплатный, без регистрации)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/RUB');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Конвертируем курсы к формату: 1 валюта = X рублей
    // API возвращает: 1 RUB = X валюты, нам нужно инвертировать
    const rates = {
      RUB: 1,
      USD: data.rates.USD ? 1 / data.rates.USD : FALLBACK_RATES.USD,
      EUR: data.rates.EUR ? 1 / data.rates.EUR : FALLBACK_RATES.EUR,
      RSD: data.rates.RSD ? 1 / data.rates.RSD : FALLBACK_RATES.RSD
    };

    console.log('[Currency Service] Successfully fetched rates from API:', rates);
    return rates;

  } catch (error) {
    console.error('[Currency Service] Error fetching rates from API:', error.message);
    throw error;
  }
}

/**
 * Обновить курсы валют в БД
 */
export async function updateCurrencyRates() {
  try {
    console.log('[Currency Service] Starting currency rates update...');

    let rates;
    let source = 'exchangerate-api.com';

    try {
      rates = await fetchCurrencyRatesFromAPI();
    } catch {
      console.warn('[Currency Service] API unavailable, using fallback rates');
      rates = FALLBACK_RATES;
      source = 'fallback';
    }

    // Сохраняем курсы в БД
    const currencyRate = new CurrencyRate({
      rates: new Map(Object.entries(rates)),
      baseCurrency: 'RUB',
      source,
      fetchedAt: new Date()
    });

    await currencyRate.save();

    console.log('[Currency Service] Currency rates updated successfully');
    return currencyRate;

  } catch (error) {
    console.error('[Currency Service] Error updating currency rates:', error);
    throw error;
  }
}

/**
 * Получить последние курсы валют из БД
 */
export async function getLatestCurrencyRates() {
  try {
    // Получаем последнюю запись
    const latestRate = await CurrencyRate.findOne()
      .sort({ fetchedAt: -1 })
      .lean();

    if (!latestRate) {
      console.warn('[Currency Service] No rates in DB, returning fallback rates');
      return {
        rates: FALLBACK_RATES,
        baseCurrency: 'RUB',
        source: 'fallback',
        fetchedAt: new Date()
      };
    }

    // Конвертируем Map обратно в объект
    const rates = {};
    if (latestRate.rates instanceof Map) {
      latestRate.rates.forEach((value, key) => {
        rates[key] = value;
      });
    } else {
      // Если rates уже объект (после lean())
      Object.assign(rates, latestRate.rates);
    }

    return {
      rates,
      baseCurrency: latestRate.baseCurrency,
      source: latestRate.source,
      fetchedAt: latestRate.fetchedAt
    };

  } catch (error) {
    console.error('[Currency Service] Error getting latest rates:', error);
    // В случае ошибки возвращаем fallback
    return {
      rates: FALLBACK_RATES,
      baseCurrency: 'RUB',
      source: 'fallback',
      fetchedAt: new Date()
    };
  }
}

/**
 * Инициализация: создать первую запись если БД пуста
 */
export async function initializeCurrencyRates() {
  try {
    const count = await CurrencyRate.countDocuments();

    if (count === 0) {
      console.log('[Currency Service] No currency rates in DB, initializing...');
      await updateCurrencyRates();
    } else {
      console.log('[Currency Service] Currency rates already initialized');
    }
  } catch (error) {
    console.error('[Currency Service] Error initializing currency rates:', error);
  }
}

export default {
  updateCurrencyRates,
  getLatestCurrencyRates,
  initializeCurrencyRates
};
