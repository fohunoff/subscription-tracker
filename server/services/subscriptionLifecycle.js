import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import { isSubscriptionExpired, getLastPaymentDate } from '../utils/cycle.js';
import { logSubscriptionEvent } from './subscriptionEvents.js';

/**
 * Наступление даты окончания подписки.
 *
 * Живёт вне telegram/: срок действия истекает независимо от того, подключён ли
 * бот, — планировщик уведомлений стартует только вместе с ботом и для этой
 * задачи не годится.
 *
 * Обработка идемпотентна: отметка endHandledAt не даёт записать последний
 * платёж дважды. Правка даты окончания сбрасывает её (см. PUT /subscriptions/:id),
 * поэтому продлённая подписка снова будет обработана в свой срок.
 */
export const processEndedSubscription = async (subscription, now = new Date()) => {
  const lastPayment = getLastPaymentDate(subscription);

  // Последнее списание фиксируем как факт: дальше платежей не будет, а история
  // подписки должна отвечать на вопрос «сколько за неё в итоге отдали».
  if (lastPayment) {
    await logSubscriptionEvent({
      userId: subscription.userId,
      subscription,
      type: 'payment',
      changes: {
        amount: subscription.cost,
        currency: subscription.currency,
        paidAt: lastPayment.toISOString(),
        isLast: true
      }
    });
  }

  const willArchive = subscription.archiveOnEnd !== false;

  await logSubscriptionEvent({
    userId: subscription.userId,
    subscription,
    type: 'ended',
    changes: {
      endDate: { from: null, to: new Date(subscription.endDate).toISOString() },
      archived: willArchive
    }
  });

  subscription.endHandledAt = now;

  if (willArchive) {
    subscription.status = 'archived';
    subscription.archivedAt = now;
  }

  await subscription.save();

  if (willArchive) {
    // Без changes: дата окончания уже записана соседним событием ended,
    // повторять её здесь нечем — она не менялась.
    await logSubscriptionEvent({
      userId: subscription.userId,
      subscription,
      type: 'archived'
    });
  }

  return { archived: willArchive, lastPayment };
};

/**
 * Обходит подписки, у которых срок действия истёк, а наступление даты ещё
 * не обработано.
 */
export const processEndedSubscriptions = async (now = new Date()) => {
  try {
    const candidates = await Subscription.find({
      status: { $ne: 'archived' },
      endDate: { $ne: null, $lte: now },
      // null здесь покрывает и документы, где поля нет вовсе
      endHandledAt: null
    });

    let processed = 0;

    for (const subscription of candidates) {
      // В сам день окончания подписка ещё действует — ждём его конца
      if (!isSubscriptionExpired(subscription, now)) continue;

      try {
        await processEndedSubscription(subscription, now);
        processed += 1;
      } catch (error) {
        console.error(
          `[Lifecycle] Не удалось обработать окончание подписки ${subscription._id}:`,
          error.message
        );
      }
    }

    if (processed > 0) {
      console.log(`[Lifecycle] Обработано подписок с истёкшим сроком: ${processed}`);
    }

    return processed;
  } catch (error) {
    console.error('[Lifecycle] Ошибка обхода подписок с истёкшим сроком:', error);
    return 0;
  }
};

let lifecycleTask = null;

/**
 * Проверка раз в час: точность до минуты здесь не нужна — подписка истекает
 * в конце дня, и разница в пару часов ни на что не влияет. Один прогон делаем
 * сразу при старте, чтобы простой сервера не оставлял подписки необработанными.
 */
export const startLifecycleScheduler = () => {
  processEndedSubscriptions();

  lifecycleTask = cron.schedule('5 * * * *', async () => {
    await processEndedSubscriptions();
  });

  console.log('[Lifecycle] Планировщик окончания подписок запущен (каждый час)');
};

export const stopLifecycleScheduler = () => {
  if (lifecycleTask) {
    lifecycleTask.stop();
    console.log('[Lifecycle] Планировщик окончания подписок остановлен');
  }
};
