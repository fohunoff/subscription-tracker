import cron from 'node-cron';
import Subscription from '../models/Subscription.js';
import { isSubscriptionExpired, isLastPayment, getPaymentDatesBetween } from '../utils/cycle.js';
import { logSubscriptionEvent } from './subscriptionEvents.js';

/**
 * Записывает в историю платежи, которые уже случились, но ещё не отмечены.
 *
 * Ручного чек-листа «оплачено» в приложении намеренно нет: подписки списываются
 * сами, отмечать нечего, а заброшенный через пару месяцев чек-лист занижал бы
 * статистику незаметно. Вместо этого планировщик фиксирует каждое списание
 * с ценой и валютой на момент платежа — подорожание подписки не переписывает
 * прошлое, и «сколько уже потрачено» считается по фактам, а не по текущей цене.
 *
 * Граница — paymentsLoggedThrough. Пока её нет (подписки, заведённые до этой
 * возможности), учёт начинается с текущего момента: восстановить прошлое —
 * задача разового бэкфилла, который умеет читать лог изменений цены.
 */
export const logDuePayments = async (subscription, now = new Date()) => {
  if (!subscription.paymentsLoggedThrough) {
    subscription.paymentsLoggedThrough = now;
    return [];
  }

  const dates = getPaymentDatesBetween(subscription, subscription.paymentsLoggedThrough, now);

  for (const paidAt of dates) {
    await logSubscriptionEvent({
      userId: subscription.userId,
      subscription,
      type: 'payment',
      changes: {
        amount: subscription.cost,
        currency: subscription.currency,
        paidAt: paidAt.toISOString(),
        // Отмечаем последнее списание по подписке с заданным сроком:
        // в истории видно, что дальше платежей не будет
        isLast: isLastPayment(subscription, paidAt)
      }
    });
  }

  subscription.paymentsLoggedThrough = now;
  return dates;
};

/**
 * Наступление даты окончания подписки.
 *
 * Живёт вне telegram/: срок действия истекает независимо от того, подключён ли
 * бот, — планировщик уведомлений стартует только вместе с ботом и для этой
 * задачи не годится.
 *
 * Обработка идемпотентна: отметка endHandledAt не даёт обработать окончание
 * дважды. Правка даты окончания сбрасывает её (см. PUT /subscriptions/:id),
 * поэтому продлённая подписка снова будет обработана в свой срок.
 */
export const processEndedSubscription = async (subscription, now = new Date()) => {
  // Последнее списание записывается тем же механизмом, что и остальные:
  // отдельная запись здесь дала бы дубль, если планировщик успел раньше.
  const payments = await logDuePayments(subscription, now);

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

  return { archived: willArchive, payments };
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

/**
 * Обходит активные подписки и дописывает в лог состоявшиеся платежи.
 *
 * Идёт по всем активным, а не только по тем, у кого «пора»: дату платежа
 * запросом не выразить — она считается шагами цикла от fullPaymentDate.
 * Подписок у пользователя десятки, а не миллионы, поэтому полный обход раз
 * в час дешевле любой схемы с предвычисленной датой следующего списания.
 */
export const logDuePaymentsForAll = async (now = new Date()) => {
  try {
    const subscriptions = await Subscription.find({ status: { $ne: 'archived' } });

    let logged = 0;

    for (const subscription of subscriptions) {
      try {
        const payments = await logDuePayments(subscription, now);
        // Сохраняем даже когда платежей не было: сдвинулась отметка
        await subscription.save();
        logged += payments.length;
      } catch (error) {
        console.error(
          `[Lifecycle] Не удалось записать платежи подписки ${subscription._id}:`,
          error.message
        );
      }
    }

    if (logged > 0) {
      console.log(`[Lifecycle] Записано платежей: ${logged}`);
    }

    return logged;
  } catch (error) {
    console.error('[Lifecycle] Ошибка записи платежей:', error);
    return 0;
  }
};

/**
 * Обе задачи разом. Порядок важен: сначала платежи по действующим подпискам,
 * потом окончание срока — иначе истёкшая подписка успела бы уйти в архив
 * до того, как её последнее списание попало в историю.
 */
export const runLifecycleTasks = async (now = new Date()) => {
  const logged = await logDuePaymentsForAll(now);
  const ended = await processEndedSubscriptions(now);
  return { logged, ended };
};

let lifecycleTask = null;

/**
 * Проверка раз в час: точность до минуты здесь не нужна — подписка истекает
 * в конце дня, и разница в пару часов ни на что не влияет. Один прогон делаем
 * сразу при старте, чтобы простой сервера не оставлял подписки необработанными.
 */
export const startLifecycleScheduler = () => {
  runLifecycleTasks();

  lifecycleTask = cron.schedule('5 * * * *', async () => {
    await runLifecycleTasks();
  });

  console.log('[Lifecycle] Планировщик платежей и окончания подписок запущен (каждый час)');
};

export const stopLifecycleScheduler = () => {
  if (lifecycleTask) {
    lifecycleTask.stop();
    console.log('[Lifecycle] Планировщик платежей и окончания подписок остановлен');
  }
};
