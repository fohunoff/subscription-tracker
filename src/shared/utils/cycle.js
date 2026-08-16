// Клиентская копия описания циклов оплаты. Значения ключей и длительности
// должны совпадать с server/utils/cycle.js — там же валидация и расчёты для API.

export const CYCLES = {
  monthly: { months: 1, label: 'Ежемесячно', shortLabel: 'мес.', perLabel: 'в месяц' },
  quarterly: { months: 3, label: 'Раз в квартал', shortLabel: 'кв.', perLabel: 'в квартал' },
  annually: { months: 12, label: 'Ежегодно', shortLabel: 'год', perLabel: 'в год' },
};

export const CYCLE_OPTIONS = Object.entries(CYCLES).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export const getCycleMeta = (cycle) => CYCLES[cycle] || CYCLES.monthly;

/**
 * Стоимость подписки в пересчёте на месяц: квартальная делится на 3,
 * годовая — на 12.
 */
export const getMonthlyCost = (subscription) =>
  subscription.cost / getCycleMeta(subscription.cycle).months;

/**
 * Цикл, для которого одного дня месяца недостаточно: нужна полная дата,
 * иначе неизвестно, в какие именно месяцы приходится платёж.
 * Совпадает с проверкой на сервере (server/utils/index.js).
 */
export const cycleRequiresFullDate = (cycle) => cycle === 'quarterly';
