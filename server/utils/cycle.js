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

/**
 * Первый платёж строго после указанной даты.
 *
 * Отдельно от getNextPaymentDate, потому что нужен не только «следующий от
 * сегодня»: при возврате из архива важно, наступил ли платёж после даты
 * завершения подписки — от этого зависит, вернули её или восстанавливают
 * после перерыва.
 *
 * В отличие от getNextPaymentDate умеет считать и от одного дня месяца:
 * у ежемесячных подписок, заведённых до появления fullPaymentDate, полной даты
 * нет вовсе, а ответ «платежей не бывает» здесь означал бы неверный вывод.
 */
export const getNextPaymentDateAfter = (subscription, from) => {
  const { months } = getCycleMeta(subscription.cycle);
  const after = new Date(from);
  if (isNaN(after.getTime())) return null;

  if (!subscription.fullPaymentDate) {
    if (!subscription.paymentDay) return null;

    const candidate = new Date(after.getFullYear(), after.getMonth(), subscription.paymentDay);
    // Шаг в длину цикла: для квартальных без полной даты месяцы списания
    // всё равно неизвестны, но такие подписки не проходят валидацию.
    while (candidate <= after) {
      candidate.setMonth(candidate.getMonth() + months);
    }
    return candidate;
  }

  const nextDate = new Date(subscription.fullPaymentDate);
  // Шаг в месяцах: setMonth сам переносит через границу года.
  while (nextDate <= after) {
    nextDate.setMonth(nextDate.getMonth() + months);
  }

  return nextDate;
};

/**
 * Конец дня даты окончания: в сам день подписка ещё действует, истекает она
 * в его конце. Иначе платёж, попадающий ровно на дату окончания, оказался бы
 * «за сроком».
 */
const endOfDay = (date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Срок действия подписки истёк: дата окончания уже прошла.
 *
 * Истёкшая подписка не порождает новых платежей, поэтому не участвует
 * в суммах, статистике и уведомлениях — независимо от того, ушла она в архив
 * (archiveOnEnd) или осталась в списке.
 */
export const isSubscriptionExpired = (subscription, now = new Date()) => {
  if (!subscription.endDate) return false;
  return now > endOfDay(subscription.endDate);
};

/**
 * Последний платёж в пределах срока действия — тот, после которого списаний
 * уже не будет. Без даты окончания последнего платежа не существует.
 */
export const getLastPaymentDate = (subscription) => {
  if (!subscription.endDate) return null;

  const end = endOfDay(subscription.endDate);
  const { months } = getCycleMeta(subscription.cycle);

  // У подписок, заведённых до появления fullPaymentDate, есть только день
  // месяца: отсчитываем от месяца окончания назад.
  if (!subscription.fullPaymentDate) {
    if (!subscription.paymentDay) return null;

    const candidate = new Date(end.getFullYear(), end.getMonth(), subscription.paymentDay);
    while (candidate > end) {
      candidate.setMonth(candidate.getMonth() - months);
    }
    return candidate;
  }

  const last = new Date(subscription.fullPaymentDate);
  // Подписку закрыли раньше первого платежа — платить было не за что
  if (last > end) return null;

  for (;;) {
    const step = new Date(last);
    step.setMonth(step.getMonth() + months);
    if (step > end) break;
    last.setTime(step.getTime());
  }

  return last;
};

/**
 * Дата попадает в срок действия подписки (без даты окончания — всегда).
 */
export const isWithinTerm = (subscription, date) =>
  !subscription.endDate || date <= endOfDay(subscription.endDate);

/**
 * Платёж, после которого списаний по подписке уже не будет.
 */
export const isLastPayment = (subscription, paymentDate) => {
  if (!subscription.endDate || !paymentDate) return false;

  const next = getNextPaymentDateAfter(subscription, paymentDate);
  return !next || next > endOfDay(subscription.endDate);
};

// Защита от бесконечного шага по циклу, если в данных окажется что-то странное.
// Это предохранитель, а не бизнес-правило: срабатывание молча обрезает историю
// платежей, поэтому порог заведомо выше любого осмысленного срока подписки.
// Прежние 240 (двадцать лет месячных списаний) стали достижимы, когда бэкфилл
// начал запускаться прямо на создание подписки: дату старта вводит человек,
// и «плачу с 2015 года» — не край диапазона.
const MAX_PAYMENTS_IN_RANGE = 720;

/**
 * Даты платежей в интервале (after, until] — те, что уже случились, но ещё
 * не записаны в лог. За границей срока действия платежей нет, поэтому обход
 * останавливается на дате окончания.
 */
export const getPaymentDatesBetween = (subscription, after, until) => {
  const dates = [];

  let date = getNextPaymentDateAfter(subscription, after);

  while (date && date <= until && isWithinTerm(subscription, date)) {
    dates.push(new Date(date));
    if (dates.length >= MAX_PAYMENTS_IN_RANGE) break;
    date = getNextPaymentDateAfter(subscription, date);
  }

  return dates;
};

export const getNextPaymentDate = (subscription) => {
  // Без полной даты платежа считать нечего: уведомления и расписание опираются
  // именно на неё. Поведение сохранено намеренно — getNextPaymentDateAfter
  // с фолбэком на paymentDay используется только там, где он уместен.
  if (!subscription.fullPaymentDate) return null;

  const next = getNextPaymentDateAfter(subscription, new Date());

  // За датой окончания платежей больше нет. Проверка живёт здесь, а не в
  // getNextPaymentDateAfter: тому нужен «сырой» расчёт по циклу — например,
  // при возврате из архива, где endDate как раз и есть дата завершения.
  if (next && subscription.endDate && next > endOfDay(subscription.endDate)) return null;

  return next;
};
