import SubscriptionEvent from '../models/SubscriptionEvent.js';

// Поля, изменения которых имеет смысл хранить в истории.
// Служебные (lastNotificationSent, updatedAt) намеренно не логируются.
const TRACKED_FIELDS = [
  'name',
  'cost',
  'currency',
  'cycle',
  'categoryId',
  'paymentDay',
  'fullPaymentDate',
  'endDate',
  'notificationsEnabled',
  'notifyDaysBefore'
];

const normalize = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'object' && value.toString) return value.toString();
  return value;
};

/**
 * Сравнивает документ до и после обновления, возвращает только реально
 * изменившиеся поля в виде { поле: { from, to } }.
 */
export const diffSubscription = (before, after) => {
  const changes = {};

  for (const field of TRACKED_FIELDS) {
    const from = normalize(before?.[field]);
    const to = normalize(after?.[field]);
    if (from !== to) {
      changes[field] = { from, to };
    }
  }

  return changes;
};

/**
 * Пишет событие в лог. Намеренно не бросает наружу: сломанный лог не должен
 * ронять основную операцию — пользователю важнее, что подписка сохранилась.
 */
export const logSubscriptionEvent = async ({ userId, subscription, type, changes = {} }) => {
  try {
    await SubscriptionEvent.create({
      userId,
      subscriptionId: subscription._id,
      subscriptionName: subscription.name,
      type,
      changes
    });
  } catch (error) {
    console.error('Не удалось записать событие подписки:', error.message);
  }
};

/**
 * Пишет событие обновления, только если действительно что-то поменялось.
 */
export const logSubscriptionUpdate = async ({ userId, before, after }) => {
  const changes = diffSubscription(before, after);
  if (Object.keys(changes).length === 0) return;

  await logSubscriptionEvent({ userId, subscription: after, type: 'updated', changes });
};

/**
 * История одной подписки, свежие события первыми.
 */
export const getSubscriptionHistory = (userId, subscriptionId) =>
  SubscriptionEvent.find({ userId, subscriptionId }).sort({ createdAt: -1 }).lean();
