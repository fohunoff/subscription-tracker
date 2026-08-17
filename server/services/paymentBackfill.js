import Subscription from '../models/Subscription.js';
import SubscriptionEvent from '../models/SubscriptionEvent.js';
import { getPaymentDatesBetween } from '../utils/cycle.js';

/**
 * Восстановление прошлых платежей по логу подписки.
 *
 * Планировщик (services/subscriptionLifecycle.js) пишет платежи только с того
 * момента, как подписку завели в трекере, — прошлое он намеренно не выдумывает.
 * Этот бэкфилл достраивает историю назад, до самого первого платежа: даты берёт
 * по циклу от даты старта, а цену — из лога изменений, поэтому подорожание не
 * задним числом применяется ко всем прошлым списаниям.
 *
 * Такие записи помечаются `estimated: true` и отличимы от наблюдённых:
 * достоверность у них ниже — лог ведётся не с начала времён, а курсы валют
 * известны только с момента, когда приложение начало их собирать. Пометка
 * позволяет и пересчитать их заново (см. --reset в scripts/backfill-payments.js),
 * не трогая фактические платежи.
 */

/**
 * Значение поля на конкретную дату по логу изменений.
 *
 * Лог хранит переходы «было → стало», поэтому идём от текущего значения назад:
 * значением на дату D будет `from` самого раннего изменения, случившегося после D.
 */
const valueAtDate = (changes, date, currentValue) => {
  const laterChange = changes.find(change => change.at > date);
  if (!laterChange) return currentValue;
  return laterChange.from;
};

/**
 * Изменения одного поля из лога, по возрастанию даты.
 */
const collectFieldChanges = (events, field) =>
  events
    .filter(event => event.type === 'updated' && event.changes?.[field])
    .map(event => ({
      at: new Date(event.createdAt),
      from: event.changes[field].from,
      to: event.changes[field].to
    }))
    .sort((a, b) => a.at - b.at);

/**
 * Промежутки, когда подписка лежала в архиве и не оплачивалась.
 *
 * Восстанавливаются по логу: archived открывает промежуток, returned/restored
 * закрывает. Незакрытый промежуток означает, что подписка в архиве и сейчас.
 * Глубина ограничена возрастом лога — архивации до его появления не видны.
 */
const collectArchivedIntervals = (events) => {
  const intervals = [];

  for (const event of events) {
    if (event.type === 'archived') {
      const last = intervals[intervals.length - 1];
      if (!last || last.to) intervals.push({ from: new Date(event.createdAt), to: null });
    } else if (event.type === 'returned' || event.type === 'restored') {
      const last = intervals[intervals.length - 1];
      if (last && !last.to) last.to = new Date(event.createdAt);
    }
  }

  return intervals;
};

const isInsideIntervals = (intervals, date) =>
  intervals.some(({ from, to }) => date >= from && (!to || date <= to));

/**
 * Достраивает прошлые платежи одной подписки.
 *
 * Возвращает список записей, которые нужно создать (при apply — уже созданных).
 */
export const backfillSubscriptionPayments = async (subscription, { apply = false, now = new Date() } = {}) => {
  const events = await SubscriptionEvent.find({ subscriptionId: subscription._id })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  // Докуда достраивать: дальше начинается зона автозаписи, а её платежи —
  // наблюдённые, переписывать их оценкой нельзя.
  const until = subscription.paymentsLoggedThrough
    ? new Date(subscription.paymentsLoggedThrough)
    : now;

  const start = subscription.fullPaymentDate
    ? new Date(subscription.fullPaymentDate)
    : new Date(subscription.createdAt);

  // getPaymentDatesBetween отдаёт платежи строго после указанной границы,
  // а первый платёж пропускать не нужно — отступаем на миллисекунду
  const after = new Date(start.getTime() - 1);
  if (after >= until) return [];

  const dates = getPaymentDatesBetween(subscription, after, until);
  if (dates.length === 0) return [];

  const costChanges = collectFieldChanges(events, 'cost');
  const currencyChanges = collectFieldChanges(events, 'currency');
  const archivedIntervals = collectArchivedIntervals(events);

  // Уже записанные платежи (наблюдённые или из прошлого запуска) не трогаем
  const knownPaidAt = new Set(
    events.filter(event => event.type === 'payment').map(event => event.changes?.paidAt)
  );

  const created = [];

  for (const paidAt of dates) {
    const iso = paidAt.toISOString();
    if (knownPaidAt.has(iso)) continue;
    // В архиве подписка не оплачивалась
    if (isInsideIntervals(archivedIntervals, paidAt)) continue;

    const amount = Number(valueAtDate(costChanges, paidAt, subscription.cost));
    const currency = valueAtDate(currencyChanges, paidAt, subscription.currency);

    if (!Number.isFinite(amount) || amount <= 0) continue;

    const changes = { amount, currency, paidAt: iso, estimated: true };
    created.push(changes);

    if (apply) {
      await SubscriptionEvent.create({
        userId: subscription.userId,
        subscriptionId: subscription._id,
        subscriptionName: subscription.name,
        type: 'payment',
        changes,
        // Событие описывает прошлое, поэтому и в ленте должно стоять на своём
        // месте, а не в момент запуска скрипта
        createdAt: paidAt
      });
    }
  }

  return created;
};

/**
 * Бэкфилл по всем подпискам, включая архивные: их платежи — такая же часть
 * истории трат.
 */
export const backfillAllPayments = async ({ apply = false, now = new Date(), onProgress } = {}) => {
  const subscriptions = await Subscription.find({}).sort({ createdAt: 1 });

  let total = 0;

  for (const subscription of subscriptions) {
    const created = await backfillSubscriptionPayments(subscription, { apply, now });
    total += created.length;
    if (onProgress) onProgress(subscription, created);
  }

  return total;
};

/**
 * Удаляет оценочные платежи — все или по одной подписке. Нужно, когда исходные
 * данные изменились (например, поправили дату старта) и прошлое надо построить
 * заново. Наблюдённые платежи остаются на месте.
 */
export const removeEstimatedPayments = async (subscriptionId = null) => {
  const filter = { type: 'payment', 'changes.estimated': true };
  if (subscriptionId) filter.subscriptionId = subscriptionId;

  const result = await SubscriptionEvent.deleteMany(filter);
  return result.deletedCount;
};

/**
 * Пересобирает оценки одной подписки: сносит прежние и строит заново.
 *
 * Вызывается, когда сменилась дата старта или цикл — от них считаются все даты
 * прошлых платежей, и старая оценка после правки описывала бы уже не эту
 * подписку. Ошибки не пробрасываются: правка подписки не должна падать из-за
 * пересчёта истории, а восстановить её всегда можно скриптом с --reset.
 */
export const rebuildEstimatedPayments = async (subscription, { now = new Date() } = {}) => {
  try {
    await removeEstimatedPayments(subscription._id);
    const created = await backfillSubscriptionPayments(subscription, { apply: true, now });
    return created.length;
  } catch (error) {
    console.error(
      `[Backfill] Не удалось пересобрать платежи подписки ${subscription._id}:`,
      error.message
    );
    return 0;
  }
};
