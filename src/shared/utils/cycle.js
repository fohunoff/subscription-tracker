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

/**
 * Дата ближайшего будущего платежа. Зеркало server/utils/cycle.js.
 *
 * Если полной даты нет (старые ежемесячные подписки), считаем от дня месяца:
 * ближайшее его наступление начиная с сегодняшнего дня.
 */
/**
 * Конец дня даты окончания: в сам день подписка ещё действует.
 * Зеркало server/utils/cycle.js.
 */
const endOfDay = (date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getNextPaymentDate = (subscription) => {
  const { months } = getCycleMeta(subscription.cycle);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextDate;

  if (!subscription.fullPaymentDate) {
    if (!subscription.paymentDay) return null;

    nextDate = new Date(today.getFullYear(), today.getMonth(), subscription.paymentDay);
    if (nextDate < today) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  } else {
    nextDate = new Date(subscription.fullPaymentDate);
    nextDate.setHours(0, 0, 0, 0);
    while (nextDate < today) {
      nextDate.setMonth(nextDate.getMonth() + months);
    }
  }

  // За датой окончания платежей больше не будет
  if (subscription.endDate && nextDate > endOfDay(subscription.endDate)) return null;

  return nextDate;
};

/**
 * Срок действия подписки истёк: дата окончания уже прошла. Такая подписка
 * не порождает новых платежей и потому не участвует в суммах — независимо
 * от того, ушла она в архив или осталась в списке (archiveOnEnd).
 */
export const isSubscriptionExpired = (subscription, now = new Date()) => {
  if (!subscription.endDate) return false;
  return now > endOfDay(subscription.endDate);
};

/**
 * Подписки, которые ещё будут списываться. Любая сумма по нескольким подпискам
 * считается по ним: у истёкшей платежей впереди нет, и её стоимость в «расходе
 * в месяц» была бы выдумкой.
 */
export const getBillableSubscriptions = (subscriptions = [], now = new Date()) =>
  subscriptions.filter(subscription => !isSubscriptionExpired(subscription, now));

/**
 * Последний платёж в пределах срока действия. Зеркало server/utils/cycle.js.
 */
export const getLastPaymentDate = (subscription) => {
  if (!subscription.endDate) return null;

  const end = endOfDay(subscription.endDate);
  const { months } = getCycleMeta(subscription.cycle);

  if (!subscription.fullPaymentDate) {
    if (!subscription.paymentDay) return null;

    const candidate = new Date(end.getFullYear(), end.getMonth(), subscription.paymentDay);
    while (candidate > end) {
      candidate.setMonth(candidate.getMonth() - months);
    }
    return candidate;
  }

  const last = new Date(subscription.fullPaymentDate);
  if (last > end) return null;

  for (;;) {
    const step = new Date(last);
    step.setMonth(step.getMonth() + months);
    if (step > end) break;
    last.setTime(step.getTime());
  }

  return last;
};
