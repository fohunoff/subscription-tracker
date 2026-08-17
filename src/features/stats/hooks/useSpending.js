import { useCallback, useState } from 'react';

/**
 * Сколько уже потрачено — данные считает сервер по логу платежей
 * (GET /api/stats/spending), здесь только загрузка и выбранный период.
 */
export const PERIOD_OPTIONS = [
  { value: 6, label: '6 месяцев' },
  { value: 12, label: '12 месяцев' },
  { value: 24, label: '2 года' },
];

export const DEFAULT_PERIOD = 12;

// Период считается от первого числа месяца: иначе «12 месяцев» отрезали бы
// начало самого раннего месяца и первый столбец графика выглядел бы провалом.
const periodStart = (months) => {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));
  return start;
};

export function useSpending(api, showToast) {
  const [spending, setSpending] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [months, setMonths] = useState(DEFAULT_PERIOD);

  const loadSpending = useCallback(async (periodMonths = DEFAULT_PERIOD) => {
    if (!api) return;

    setIsLoading(true);
    setMonths(periodMonths);
    try {
      const data = await api.getSpending({ from: periodStart(periodMonths).toISOString() });
      setSpending(data);
    } catch (error) {
      console.error('Ошибка загрузки статистики трат:', error);
      showToast && showToast('Не удалось загрузить статистику трат', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [api, showToast]);

  return { spending, isLoading, months, loadSpending };
}
