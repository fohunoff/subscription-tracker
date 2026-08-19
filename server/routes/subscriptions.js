import { Router } from 'express';
import Subscription from '../models/Subscription.js';
import Category from '../models/Category.js';
import { validateSubscriptionData } from '../utils/index.js';
import { normalizeSiteUrl } from '../utils/url.js';
import { isValidCycle, CYCLE_VALUES, getNextPaymentDateAfter } from '../utils/cycle.js';
import {
  logSubscriptionEvent,
  logSubscriptionUpdate,
  getSubscriptionHistory
} from '../services/subscriptionEvents.js';
import { logDuePayments } from '../services/subscriptionLifecycle.js';
import { syncEstimatedPayments } from '../services/paymentBackfill.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();

/**
 * Единый формат подписки для клиента. Раньше он был скопирован в трёх местах,
 * из-за чего новые поля приходилось добавлять в каждое.
 */
const formatSubscription = (sub) => ({
  id: sub._id.toString(),
  name: sub.name,
  cost: sub.cost,
  currency: sub.currency,
  cycle: sub.cycle,
  url: sub.url || null,
  paymentDay: sub.paymentDay,
  fullPaymentDate: sub.fullPaymentDate,
  status: sub.status || 'active',
  endDate: sub.endDate,
  // У документов, созданных до появления поля, значения нет — в архив по
  // окончании срока их всё равно отправляем, это поведение по умолчанию.
  archiveOnEnd: sub.archiveOnEnd !== false,
  archivedAt: sub.archivedAt,
  categoryId: sub.categoryId._id.toString(),
  category: {
    id: sub.categoryId._id.toString(),
    name: sub.categoryId.name,
    hasReminders: sub.categoryId.hasReminders,
    color: sub.categoryId.color
  },
  notificationsEnabled: sub.notificationsEnabled || false,
  notifyDaysBefore: sub.notifyDaysBefore || [],
  lastNotificationSent: sub.lastNotificationSent,
  createdAt: sub.createdAt,
  updatedAt: sub.updatedAt
});

/**
 * Фильтр по статусу. Документы, созданные до появления поля status, не имеют его
 * вовсе — поэтому активные выбираются как «не archived», а не «status: active».
 */
const statusFilter = (status) =>
  status === 'archived' ? { status: 'archived' } : { status: { $ne: 'archived' } };

// Получение подписок пользователя. ?status=archived — архив, иначе активные.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({
      userId: req.userDoc._id,
      ...statusFilter(req.query.status)
    })
      .populate('categoryId')
      .sort({ createdAt: -1 });

    res.json({ success: true, subscriptions: subscriptions.map(formatSubscription) });
  } catch (error) {
    console.error('Ошибка получения подписок:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создание новой подписки
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, cost, currency, cycle, url, paymentDay, fullPaymentDate, endDate, archiveOnEnd, categoryId, notificationsEnabled, notifyDaysBefore } = req.body;

    // Проверяем, что категория существует и принадлежит пользователю
    const category = await Category.findOne({
      _id: categoryId,
      userId: req.userDoc._id
    });

    if (!category) {
      return res.status(400).json({ message: 'Указанная категория не найдена' });
    }

    // Валидация данных подписки (с учетом того, нужны ли напоминания)
    const subscriptionData = {
      name: name?.trim(),
      cost: parseFloat(cost),
      currency,
      cycle,
      // Ссылка необязательна; нормализация бросит ошибку на неразбираемой строке
      url: normalizeSiteUrl(url),
      categoryId
    };

    // Если категория имеет напоминания, то обязательны поля даты
    if (category.hasReminders) {
      if (!paymentDay && !fullPaymentDate) {
        return res.status(400).json({ message: 'Для категории с напоминаниями требуется указать дату оплаты' });
      }
      subscriptionData.paymentDay = parseInt(paymentDay);
      subscriptionData.fullPaymentDate = fullPaymentDate;
    }

    // Дата окончания необязательна: подписка без неё длится бессрочно
    if (endDate) {
      const parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ message: 'Некорректная дата окончания' });
      }
      subscriptionData.endDate = parsedEndDate;
      subscriptionData.archiveOnEnd = archiveOnEnd !== false;
    }

    // Добавляем настройки уведомлений
    if (notificationsEnabled !== undefined) {
      subscriptionData.notificationsEnabled = notificationsEnabled;
    }
    if (notifyDaysBefore !== undefined && Array.isArray(notifyDaysBefore)) {
      subscriptionData.notifyDaysBefore = notifyDaysBefore;
    }

    validateSubscriptionData(subscriptionData, category.hasReminders);

    const newSubscription = await Subscription.create({
      userId: req.userDoc._id,
      ...subscriptionData,
      // Автоматически в лог попадают только платежи, случившиеся после того,
      // как подписку завели: у списаний до этого момента неизвестна тогдашняя
      // цена, и восстанавливать их — дело отдельного бэкфилла.
      paymentsLoggedThrough: new Date()
    });

    await logSubscriptionEvent({
      userId: req.userDoc._id,
      subscription: newSubscription,
      type: 'created'
    });

    // Дата старта бывает намного раньше дня, когда подписку завели в трекере:
    // «плачу за это с 2015 года» — обычный случай, а не край. Достраиваем её
    // прошлое сразу, иначе в тратах подписка появилась бы только с сегодняшнего
    // дня и до запуска скрипта руками выглядела бы как потеря истории.
    const estimatedPayments = await syncEstimatedPayments(newSubscription);

    // Получаем созданную подписку с категорией
    const populatedSubscription = await Subscription.findById(newSubscription._id).populate('categoryId');

    res.status(201).json({
      success: true,
      subscription: formatSubscription(populatedSubscription),
      // Сколько прошлых платежей восстановлено — клиент говорит об этом в тосте:
      // сумма трат выросла не сама по себе
      estimatedPayments,
      message: 'Подписка создана успешно'
    });
  } catch (error) {
    console.error('Ошибка создания подписки:', error);
    res.status(400).json({ message: error.message });
  }
});

// Обновление подписки
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cost, currency, cycle, url, paymentDay, fullPaymentDate, endDate, archiveOnEnd, categoryId, notificationsEnabled, notifyDaysBefore } = req.body;

    const subscription = await Subscription.findOne({ _id: id, userId: req.userDoc._id }).populate('categoryId');
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    // Снимок до изменений — для лога
    const before = subscription.toObject();

    const updateData = {};

    // Проверяем, изменилась ли категория
    let targetCategory = subscription.categoryId;
    if (categoryId && categoryId !== subscription.categoryId._id.toString()) {
      const newCategory = await Category.findOne({
        _id: categoryId,
        userId: req.userDoc._id
      });
      if (!newCategory) {
        return res.status(400).json({ message: 'Указанная категория не найдена' });
      }
      targetCategory = newCategory;
      updateData.categoryId = categoryId;
    }

    if (name !== undefined) {
      if (!name.trim()) throw new Error('Название не может быть пустым');
      updateData.name = name.trim();
    }
    if (cost !== undefined) {
      const parsedCost = parseFloat(cost);
      if (isNaN(parsedCost) || parsedCost <= 0) {
        throw new Error('Стоимость должна быть положительным числом');
      }
      updateData.cost = parsedCost;
    }
    if (currency !== undefined) {
      if (!['RUB', 'USD', 'EUR', 'RSD'].includes(currency)) {
        throw new Error('Недопустимая валюта');
      }
      updateData.currency = currency;
    }
    if (cycle !== undefined) {
      if (!isValidCycle(cycle)) {
        throw new Error(`Цикл оплаты должен быть одним из: ${CYCLE_VALUES.join(', ')}`);
      }
      updateData.cycle = cycle;
    }
    if (url !== undefined) {
      // Пустая строка снимает ссылку, поэтому пишем результат как есть —
      // включая null: undefined mongoose выбросил бы из update, и очистить
      // однажды сохранённую ссылку стало бы нечем.
      updateData.url = normalizeSiteUrl(url);
    }
    if (endDate !== undefined) {
      let parsedEndDate = null;
      if (endDate) {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          throw new Error('Некорректная дата окончания');
        }
      }

      // Явный null, а не undefined: undefined mongoose выбрасывает из update,
      // и снять однажды поставленную дату было бы невозможно.
      updateData.endDate = parsedEndDate;

      // Дату перенесли — значит наступление срока нужно обработать заново
      // (записать платёж, архивировать), даже если старую уже отработали.
      const previousEnd = subscription.endDate ? new Date(subscription.endDate).getTime() : null;
      if (previousEnd !== (parsedEndDate ? parsedEndDate.getTime() : null)) {
        updateData.endHandledAt = null;
      }
    }
    if (archiveOnEnd !== undefined) {
      updateData.archiveOnEnd = Boolean(archiveOnEnd);
    }

    // Обработка полей даты в зависимости от типа категории
    if (targetCategory.hasReminders) {
      if (paymentDay !== undefined) {
        const parsedDay = parseInt(paymentDay);
        if (isNaN(parsedDay)) {
          throw new Error('День оплаты должен быть числом');
        }
        updateData.paymentDay = parsedDay;
      }
      if (fullPaymentDate !== undefined) {
        updateData.fullPaymentDate = fullPaymentDate;
      }
    } else {
      // Если категория без напоминаний, очищаем поля дат
      updateData.paymentDay = undefined;
      updateData.fullPaymentDate = undefined;
    }

    // Обновление настроек уведомлений
    if (notificationsEnabled !== undefined) {
      updateData.notificationsEnabled = notificationsEnabled;
    }
    if (notifyDaysBefore !== undefined && Array.isArray(notifyDaysBefore)) {
      updateData.notifyDaysBefore = notifyDaysBefore;
    }

    // Квартальной подписке нужна полная дата — проверяем на итоговом состоянии,
    // иначе смену цикла на quarterly можно было бы протащить без даты.
    const resultingCycle = updateData.cycle ?? subscription.cycle;
    const resultingFullDate = updateData.fullPaymentDate ?? subscription.fullPaymentDate;
    if (resultingCycle === 'quarterly' && !resultingFullDate) {
      throw new Error('Для квартальной подписки укажите полную дату платежа');
    }

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('categoryId');

    await logSubscriptionUpdate({
      userId: req.userDoc._id,
      before,
      after: updatedSubscription
    });

    // Даты прошлых платежей считаются от даты старта шагами цикла: сменилось
    // любое из двух — восстановленная история перестала соответствовать данным.
    // Пересобираем только оценки, наблюдённые платежи не трогаем.
    const startChanged =
      String(before.fullPaymentDate ?? null) !== String(updatedSubscription.fullPaymentDate ?? null);
    const cycleChanged = before.cycle !== updatedSubscription.cycle;

    let recalculatedPayments = 0;
    if (startChanged || cycleChanged) {
      recalculatedPayments = await syncEstimatedPayments(updatedSubscription, { reset: true });
    }

    res.json({
      success: true,
      subscription: formatSubscription(updatedSubscription),
      // Клиент сообщает о пересчёте: сумма трат за прошлые месяцы изменилась
      // не потому, что что-то сломалось, а из-за правки даты старта
      recalculatedPayments,
      message: 'Подписка обновлена успешно'
    });
  } catch (error) {
    console.error('Ошибка обновления подписки:', error);
    res.status(400).json({ message: error.message });
  }
});

// Архивация подписки («отписался»): настройки сохраняются, из сумм исчезает
router.patch('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { endDate } = req.body;

    const subscription = await Subscription.findOne({ _id: id, userId: req.userDoc._id }).populate('categoryId');
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
    if (subscription.status === 'archived') {
      return res.status(400).json({ message: 'Подписка уже в архиве' });
    }

    const finishedAt = endDate ? new Date(endDate) : new Date();
    if (isNaN(finishedAt.getTime())) {
      return res.status(400).json({ message: 'Некорректная дата окончания' });
    }

    const previousEndDate = subscription.endDate;

    // Списания, случившиеся до архивации, должны попасть в историю: планировщик
    // ходит раз в час и мог не успеть, а архивную подписку он уже не обойдёт.
    await logDuePayments(subscription);

    subscription.status = 'archived';
    subscription.archivedAt = new Date();
    // Перенос в архив — это и есть дата окончания подписки. Уже заданную
    // (пользователь мог указать её заранее) не перебиваем.
    subscription.endDate = subscription.endDate || finishedAt;
    // Уведомления по архивной подписке не нужны, но исходную настройку
    // не трём — она понадобится при восстановлении.
    await subscription.save();

    await logSubscriptionEvent({
      userId: req.userDoc._id,
      subscription,
      type: 'archived',
      changes: {
        endDate: {
          from: previousEndDate ? new Date(previousEndDate).toISOString() : null,
          to: subscription.endDate.toISOString()
        }
      }
    });

    res.json({
      success: true,
      subscription: formatSubscription(subscription),
      message: `Подписка "${subscription.name}" перенесена в архив`
    });
  } catch (error) {
    console.error('Ошибка архивации подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * Возврат подписки из архива со всеми прежними настройками.
 *
 * Различаем два случая, и разница не косметическая: если подписку вернули
 * раньше, чем наступил бы первый платёж после её завершения, — она ничего не
 * пропустила, это тот же непрерывный период («вернули»). Если платёж успел
 * пройти мимо — в оплате был перерыв, и это восстановление подписки после
 * паузы; такую разницу должна показывать и история, и статистика трат.
 *
 * Даты платежей при этом намеренно не сдвигаются: сервер не знает, возобновил
 * пользователь старую подписку или оформил заново, — правку даты оставляем ему,
 * а в ответе подсказываем, что платёж был пропущен.
 */
router.patch('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findOne({ _id: id, userId: req.userDoc._id }).populate('categoryId');
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
    if (subscription.status !== 'archived') {
      return res.status(400).json({ message: 'Подписка не в архиве' });
    }

    // Дата окончания — основной ориентир; archivedAt подстраховывает подписки
    // из категорий без напоминаний, где endDate могло не быть.
    const finishedAt = subscription.endDate || subscription.archivedAt;
    const paymentAfterEnd = finishedAt ? getNextPaymentDateAfter(subscription, finishedAt) : null;
    // Платежа могло не быть вовсе (категория без дат) — тогда пропускать нечего
    const isReturn = !paymentAfterEnd || new Date() < paymentAfterEnd;

    const previousEndDate = subscription.endDate;

    subscription.status = 'active';
    subscription.archivedAt = undefined;
    subscription.endDate = undefined;
    // Срока больше нет — прежняя отметка об обработке окончания не должна
    // мешать, если пользователь задаст новую дату
    subscription.endHandledAt = undefined;
    // Пока подписка лежала в архиве, списаний не было: сдвигаем границу учёта
    // платежей на сегодня, иначе планировщик записал бы платежи за время архива
    subscription.paymentsLoggedThrough = new Date();
    await subscription.save();

    await logSubscriptionEvent({
      userId: req.userDoc._id,
      subscription,
      type: isReturn ? 'returned' : 'restored',
      changes: {
        // Событие возврата должно нести дату, с которой подписка была
        // завершена: сама endDate только что стёрта, и без лога она теряется.
        endDate: {
          from: previousEndDate ? new Date(previousEndDate).toISOString() : null,
          to: null
        },
        ...(isReturn
          ? {}
          : { missedPaymentDate: { from: null, to: paymentAfterEnd.toISOString() } })
      }
    });

    res.json({
      success: true,
      subscription: formatSubscription(subscription),
      restoreType: isReturn ? 'returned' : 'restored',
      missedPaymentDate: isReturn ? null : paymentAfterEnd.toISOString(),
      message: isReturn
        ? `Подписка "${subscription.name}" возвращена из архива`
        : `Подписка "${subscription.name}" восстановлена после перерыва`
    });
  } catch (error) {
    console.error('Ошибка восстановления подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// История изменений подписки
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findOne({ _id: id, userId: req.userDoc._id });
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    const events = await getSubscriptionHistory(req.userDoc._id, id);

    res.json({
      success: true,
      events: events.map(event => ({
        id: event._id.toString(),
        type: event.type,
        changes: event.changes,
        createdAt: event.createdAt
      }))
    });
  } catch (error) {
    console.error('Ошибка получения истории подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Удаление подписки
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSubscription = await Subscription.findOneAndDelete({ _id: id, userId: req.userDoc._id });
    if (!deletedSubscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    await logSubscriptionEvent({
      userId: req.userDoc._id,
      subscription: deletedSubscription,
      type: 'deleted'
    });

    res.json({ success: true, message: `Подписка "${deletedSubscription.name}" удалена успешно` });
  } catch (error) {
    console.error('Ошибка удаления подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Импорт подписок из JSON
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { subscriptions: importedSubs, categoryId } = req.body;
    if (!Array.isArray(importedSubs)) {
      return res.status(400).json({ message: 'Данные для импорта должны быть массивом' });
    }

    // Проверяем, что категория существует
    let targetCategory;
    if (categoryId) {
      targetCategory = await Category.findOne({
        _id: categoryId,
        userId: req.userDoc._id
      });
      if (!targetCategory) {
        return res.status(400).json({ message: 'Указанная категория не найдена' });
      }
    } else {
      // Используем дефолтную категорию
      targetCategory = await Category.findOne({
        userId: req.userDoc._id,
        isDefault: true
      });
      if (!targetCategory) {
        // Создаем дефолтную категорию, если её нет
        targetCategory = await Category.create({
          userId: req.userDoc._id,
          name: 'Мои подписки',
          hasReminders: true,
          color: '#3B82F6',
          isDefault: true,
          order: 0
        });
      }
    }

    let addedCount = 0;
    let estimatedPayments = 0;
    const errors = [];

    for (const [index, sub] of importedSubs.entries()) {
      try {
        const exists = await Subscription.findOne({
          userId: req.userDoc._id,
          name: sub.name,
          cost: sub.cost,
          categoryId: targetCategory._id
        });

        if (!exists && sub.name && sub.cost) {
          const normalizedSub = {
            userId: req.userDoc._id,
            categoryId: targetCategory._id,
            name: sub.name.trim(),
            cost: parseFloat(sub.cost),
            currency: sub.currency || 'RUB',
            cycle: sub.cycle || 'monthly',
            url: normalizeSiteUrl(sub.url)
          };

          // Добавляем поля даты только если категория поддерживает напоминания
          if (targetCategory.hasReminders) {
            normalizedSub.paymentDay = parseInt(sub.payment_day || sub.paymentDay);
            normalizedSub.fullPaymentDate = sub.next_payment_date || sub.fullPaymentDate || null;
          }

          validateSubscriptionData(normalizedSub, targetCategory.hasReminders);
          const created = await Subscription.create({
            ...normalizedSub,
            // Как и при создании вручную: автозапись начинается с этого момента,
            // всё, что было раньше, достраивает бэкфилл ниже
            paymentsLoggedThrough: new Date()
          });
          await logSubscriptionEvent({
            userId: req.userDoc._id,
            subscription: created,
            type: 'created'
          });
          // Импортируют обычно давно существующие подписки — их прошлое нужно
          // в тратах так же, как у заведённых вручную
          estimatedPayments += await syncEstimatedPayments(created);
          addedCount++;
        }
      } catch (error) {
        errors.push(`Подписка ${index + 1}: ${error.message}`);
      }
    }

    const response = {
      success: true,
      message: `Импортировано ${addedCount} подписок в категорию "${targetCategory.name}"`,
      addedCount,
      estimatedPayments
    };

    // Импортируют давно существующие подписки: без этой строки восстановленные
    // траты за прошлые месяцы выглядели бы взявшимися ниоткуда
    if (estimatedPayments > 0) {
      response.message += `, восстановлено прошлых платежей: ${estimatedPayments}`;
    }

    if (errors.length > 0) {
      response.errors = errors;
      response.message += `. Ошибки: ${errors.length}`;
    }

    res.json(response);
  } catch (error) {
    console.error('Ошибка импорта подписок:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;
