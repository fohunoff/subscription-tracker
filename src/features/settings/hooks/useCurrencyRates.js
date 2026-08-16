import { useState, useEffect } from 'react';
import { API_URL } from '../../../shared/config';

const FALLBACK_CURRENCY_RATES = {
  RUB: 1,
  USD: 90,
  EUR: 98,
  RSD: 0.83,
};

export function useCurrencyRates() {
  const [currencyRates, setCurrencyRates] = useState(FALLBACK_CURRENCY_RATES);
  const [isRatesLoading, setIsRatesLoading] = useState(true);
  const [lastRatesUpdate, setLastRatesUpdate] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      setIsRatesLoading(true);
      try {
        const res = await fetch(`${API_URL}/currency-rates/latest`);
        const data = await res.json();

        if (data && data.success && data.rates) {
          setCurrencyRates(data.rates);
          setLastRatesUpdate(data.fetchedAt ? new Date(data.fetchedAt) : null);
        }
      } catch (error) {
        console.error('Ошибка загрузки курсов валют:', error);
        // Используем fallback курсы
      } finally {
        setIsRatesLoading(false);
      }
    };

    fetchRates();
  }, []);

  return { currencyRates, isRatesLoading, lastRatesUpdate };
}
