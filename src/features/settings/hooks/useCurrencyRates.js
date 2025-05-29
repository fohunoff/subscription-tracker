import { useState, useCallback } from 'react';
import { useLocalStorage } from '../../../shared/hooks';

const FALLBACK_CURRENCY_RATES = {
  RUB: 1,
  USD: 90,
  EUR: 98,
  RSD: 0.83,
};

export function useCurrencyRates() {
  const [currencyRates, setCurrencyRates] = useState(FALLBACK_CURRENCY_RATES);
  const [isRatesLoading, setIsRatesLoading] = useState(false);
  const [lastRatesUpdate, setLastRatesUpdateRaw] = useLocalStorage('lastRatesUpdate', null);
  const setLastRatesUpdate = (date) => setLastRatesUpdateRaw(date ? date.toISOString() : null);

  const fetchRates = useCallback(async (showToast) => {
    setIsRatesLoading(true);
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=RUB&symbols=USD,EUR,RSD');
      const data = await res.json();
      if (data && data.error) {
        showToast && showToast(data.error.info || 'Что-то пошло не так', 'error');
      }
      if (data && data.rates) {
        setCurrencyRates({
          RUB: 1,
          USD: 1 / data.rates.USD,
          EUR: 1 / data.rates.EUR,
          RSD: 1 / data.rates.RSD,
        });
        const now = new Date();
        setLastRatesUpdate(now);
        showToast && showToast('Курсы валют обновлены', 'success');
      }
    } catch {
      showToast && showToast('Ошибка обновления курсов валют', 'error');
    } finally {
      setIsRatesLoading(false);
    }
  }, [setLastRatesUpdate]);

  return { currencyRates, isRatesLoading, lastRatesUpdate: lastRatesUpdate ? new Date(lastRatesUpdate) : null, fetchRates };
}
