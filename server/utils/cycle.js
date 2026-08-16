// Единственное место, где описаны циклы оплаты. Добавление нового цикла должно
// сводиться к правке CYCLES — расчёты ниже опираются на months, а не на перечисление
// вариантов через if/else.

export const CYCLES = {
  monthly: { months: 1, label: 'Ежемесячно', shortLabel: 'мес.', perLabel: 'в месяц', icon: '📆' },
  quarterly: { months: 3, label: 'Раз в квартал', shortLabel: 'кв.', perLabel: 'в квартал', icon: '🗓' },
  annually: { months: 12, label: 'Ежегодно', shortLabel: 'год', perLabel: 'в год', icon: '📅' },
};

export const CYCLE_VALUES = Object.keys(CYCLES);

export const isValidCycle = (cycle) => Object.prototype.hasOwnProperty.call(CYCLES, cycle);

export const getCycleMeta = (cycle) => CYCLES[cycle] || CYCLES.monthly;

/**
 * Сколько подписка стоит в пересчёте на месяц.
 * Для квартальной — треть суммы, для годовой — двенадцатая часть.
 */
export const getMonthlyCost = (subscription) =>
  subscription.cost / getCycleMeta(subscription.cycle).months;

/**
 * Сколько подписка стоит в пересчёте на год.
 */
export const getAnnualCost = (subscription) =>
  subscription.cost * (12 / getCycleMeta(subscription.cycle).months);

/**
 * Дата ближайшего будущего платежа: отсчитываем от fullPaymentDate шагами
 * длиной в цикл. Для квартальных подписок fullPaymentDate обязательна —
 * без неё неизвестно, в какие месяцы приходится списание.
 */
export const getPaymentDateInMonth = (subscription, month, year) => {
  if (!subscription.fullPaymentDate) return null;

  const { months } = getCycleMeta(subscription.cycle);
  const startDate = new Date(subscription.fullPaymentDate);
  const paymentDay = startDate.getDate();

  // Платёж попадает в месяц, если расстояние от месяца старта кратно длине цикла.
  // Для ежемесячных это любой месяц начиная со старта, для квартальных — каждый третий.
  const monthsFromStart =
    (year - startDate.getFullYear()) * 12 + (month - startDate.getMonth());

  if (monthsFromStart < 0 || monthsFromStart % months !== 0) return null;

  return new Date(year, month, paymentDay);
};

export const getNextPaymentDate = (subscription) => {
  if (!subscription.fullPaymentDate) return null;

  const { months } = getCycleMeta(subscription.cycle);
  const today = new Date();
  const nextDate = new Date(subscription.fullPaymentDate);

  // Шаг в месяцах: setMonth сам переносит через границу года.
  while (nextDate <= today) {
    nextDate.setMonth(nextDate.getMonth() + months);
  }

  return nextDate;
};
