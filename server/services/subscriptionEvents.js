import SubscriptionEvent from '../models/SubscriptionEvent.js';

// Поля, изменения которых имеет смысл хранить в истории.
// Служебные (lastNotificationSent, updatedAt) намеренно не логируются.
const TRACKED_FIELDS = [
  'name',
  'cost',
  'currency',
  'cycle',
  'url',
  'categoryId',
  'paymentDay',
  'fullPaymentDate',
  'endDate',
  'archiveOnEnd',
  'notificationsEnabled',
  'notifyDaysBefore'
];

const normalize = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(',');

  // Ссылка на категорию приходит в двух видах: снимок «до» берётся из
  // toObject() и содержит обычный объект, «после» — populated-документ
  // mongoose. Их строковые представления различаются («[object Object]»
  // против inspect-вывода), поэтому сравнивать нужно идентификаторы —
  // иначе любая правка подписки выглядела бы как смена категории.
  if (typeof value === 'object') {
    return String(value._id ?? value);
  }

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
 *
 * Вторая ступень сортировки обязательна: события окончания срока (платёж →
 * истёк → архив) пишутся в одну миллисекунду, и по одному createdAt порядок
 * между ними случайный. ObjectId в пределах процесса монотонно растёт, поэтому
 * _id восстанавливает исходную последовательность.
 */
export const getSubscriptionHistory = (userId, subscriptionId) =>
  SubscriptionEvent.find({ userId, subscriptionId }).sort({ createdAt: -1, _id: -1 }).lean();
