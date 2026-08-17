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
 * Курсы по дням для пересчёта прошлых платежей.
 *
 * Платёж двухлетней давности нельзя считать по сегодняшнему курсу, поэтому
 * берётся ближайший известный на его дату. Записи пишутся раз в час — для
 * истории трат такая точность избыточна, и на день оставляется последняя.
 *
 * Возвращает массив по возрастанию даты: [{ day, time, rates }].
 */
export async function getDailyRatesHistory() {
  try {
    const daily = await CurrencyRate.aggregate([
      { $sort: { fetchedAt: 1 } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fetchedAt' } },
          rates: { $last: '$rates' },
          fetchedAt: { $last: '$fetchedAt' }
        }
      },
      { $sort: { fetchedAt: 1 } }
    ]);

    return daily.map(entry => ({
      day: entry._id,
      time: new Date(entry.fetchedAt).getTime(),
      rates: entry.rates instanceof Map ? Object.fromEntries(entry.rates) : { ...entry.rates }
    }));
  } catch (error) {
    console.error('[Currency Service] Error building rates history:', error);
    return [];
  }
}

/**
 * Курсы на дату: последние известные на этот момент. До начала сбора курсов
 * берутся самые ранние из имеющихся — другой опоры для старых платежей нет,
 * и это честнее, чем считать их по сегодняшнему курсу.
 */
export function ratesAtDate(history, date, fallback = FALLBACK_RATES) {
  if (!history || history.length === 0) return fallback;

  const time = new Date(date).getTime();

  // Бинарный поиск последней записи, не позже указанного момента
  let low = 0;
  let high = history.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (history[mid].time <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found === -1 ? history[0].rates : history[found].rates;
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
