import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Category from '../models/Category.js';
import { sendNotification } from './bot.js';
import {
  getMonthlyCost,
  getNextPaymentDate,
  getPaymentDateInMonth,
  getCycleMeta
} from '../utils/cycle.js';

/**
 * Получить количество дней до даты
 */
function getDaysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Форматировать сумму с валютой
 */
function formatAmount(cost, currency) {
  const symbols = {
    'RUB': '₽',
    'USD': '$',
    'EUR': '€',
    'RSD': 'дин.'
  };
  return `${cost} ${symbols[currency] || currency}`;
}

/**
 * Форматировать дату
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Получить текущее время в формате HH:MM
 */
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Проверить и отправить уведомления для всех пользователей
 */
export async function checkAndSendNotifications() {
  const currentTime = getCurrentTime();
  console.log(`[Notification Service] Checking for notifications at ${currentTime}...`);

  try {
    // Получаем всех пользователей с подключенным Telegram и совпадающим временем уведомлений
    const users = await User.find({
      telegramChatId: { $exists: true, $ne: null },
      notificationTime: currentTime
    });

    console.log(`[Notification Service] Found ${users.length} users to notify at ${currentTime}`);

    for (const user of users) {
      try {
        await sendNotificationsForUser(user);
      } catch (error) {
        console.error(`[Notification Service] Error sending notifications for user ${user.email}:`, error);
      }
    }

    console.log('[Notification Service] Finished checking notifications');
  } catch (error) {
    console.error('[Notification Service] Error in checkAndSendNotifications:', error);
  }
}

/**
 * Отправить уведомления для конкретного пользователя
 */
async function sendNotificationsForUser(user) {
  // Получаем все подписки пользователя с включенными уведомлениями
  const subscriptions = await Subscription.find({
    userId: user._id,
    status: { $ne: 'archived' }, // архивные подписки не напоминают о себе
    notificationsEnabled: true,
    'notifyDaysBefore.0': { $exists: true } // Есть хотя бы один день для уведомления
  });

  if (subscriptions.length === 0) {
    return;
  }

  // Группируем подписки по дням до платежа
  const notificationGroups = {};

  for (const subscription of subscriptions) {
    const nextPaymentDate = getNextPaymentDate(subscription);
    if (!nextPaymentDate) continue;

    const daysUntil = getDaysUntil(nextPaymentDate);

    // Проверяем, нужно ли отправлять уведомление
    for (const notifyDays of subscription.notifyDaysBefore) {
      if (daysUntil === notifyDays) {
        // Проверяем, не отправляли ли уже сегодня
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastNotification = subscription.lastNotificationSent
          ? new Date(subscription.lastNotificationSent)
          : null;

        if (lastNotification) {
          lastNotification.setHours(0, 0, 0, 0);
          if (lastNotification.getTime() === today.getTime()) {
            // Уже отправляли сегодня
            continue;
          }
        }

        if (!notificationGroups[notifyDays]) {
          notificationGroups[notifyDays] = [];
        }

        notificationGroups[notifyDays].push({
          subscription,
          nextPaymentDate
        });
      }
    }
  }

  // Отправляем уведомления по группам
  for (const [days, items] of Object.entries(notificationGroups)) {
    await sendGroupedNotification(user, parseInt(days), items);

    // Обновляем lastNotificationSent для всех подписок
    for (const { subscription } of items) {
      subscription.lastNotificationSent = new Date();
      await subscription.save();
    }
  }
}

/**
 * Отправить групповое уведомление
 */
async function sendGroupedNotification(user, daysUntil, items) {
  // Группируем по категориям
  const categorizedItems = {};

  for (const { subscription, nextPaymentDate } of items) {
    const categoryId = subscription.categoryId;
    if (!categorizedItems[categoryId]) {
      categorizedItems[categoryId] = [];
    }
    categorizedItems[categoryId].push({ subscription, nextPaymentDate });
  }

  // Получаем названия категорий
  const categoryIds = Object.keys(categorizedItems);
  const categories = await Category.find({ _id: { $in: categoryIds } });
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat._id.toString()] = cat.name;
  });

  // Формируем сообщение
  let message = '';

  if (daysUntil === 0) {
    message = '🔔 <b>Платежи сегодня!</b>\n\n';
  } else if (daysUntil === 1) {
    message = '⏰ <b>Платежи завтра!</b>\n\n';
  } else {
    message = `📅 <b>Платежи через ${daysUntil} ${getDaysWord(daysUntil)}</b>\n\n`;
  }

  // Добавляем подписки по категориям
  for (const [categoryId, categoryItems] of Object.entries(categorizedItems)) {
    const categoryName = categoryMap[categoryId] || 'Без категории';
    message += `<b>${categoryName}</b>\n`;

    for (const { subscription, nextPaymentDate } of categoryItems) {
      const amount = formatAmount(subscription.cost, subscription.currency);
      const dateStr = formatDate(nextPaymentDate);
      message += `  • ${subscription.name}: ${amount} (${dateStr})\n`;
    }
    message += '\n';
  }

  message += '💡 <i>Не забудьте пополнить счёт!</i>';

  // Отправляем уведомление
  try {
    await sendNotification(user.telegramChatId, message);
    console.log(`[Notification Service] Sent notification to user ${user.email} for ${items.length} subscriptions (${daysUntil} days)`);
  } catch (error) {
    console.error(`[Notification Service] Failed to send notification to user ${user.email}:`, error);
    throw error;
  }
}

/**
 * Получить правильное склонение слова "день"
 */
function getDaysWord(days) {
  if (days % 10 === 1 && days % 100 !== 11) {
    return 'день';
  } else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) {
    return 'дня';
  } else {
    return 'дней';
  }
}

/**
 * Проверить и отправить месячные уведомления
 */
export async function checkAndSendMonthlyNotifications() {
  const now = new Date();
  const currentDay = now.getDate();
  const currentTime = getCurrentTime();

  console.log(`[Monthly Notification] Checking for monthly notifications on day ${currentDay} at ${currentTime}...`);

  // Отправляем уведомления только 1 числа каждого месяца
  if (currentDay !== 1) {
    return;
  }

  try {
    // Получаем всех пользователей с включенными месячными уведомлениями
    const users = await User.find({
      telegramChatId: { $exists: true, $ne: null },
      monthlyNotificationsEnabled: true,
      notificationTime: currentTime
    });

    console.log(`[Monthly Notification] Found ${users.length} users to notify with monthly report at ${currentTime}`);

    for (const user of users) {
      try {
        await sendMonthlyNotificationForUser(user);
      } catch (error) {
        console.error(`[Monthly Notification] Error sending monthly notification for user ${user.email}:`, error);
      }
    }

    console.log('[Monthly Notification] Finished sending monthly notifications');
  } catch (error) {
    console.error('[Monthly Notification] Error in checkAndSendMonthlyNotifications:', error);
  }
}

/**
 * Отправить месячное уведомление для конкретного пользователя
 */
async function sendMonthlyNotificationForUser(user) {
  // Проверяем, не отправляли ли уже уведомление в этом месяце
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (user.lastMonthlyNotificationSent) {
    const lastSent = new Date(user.lastMonthlyNotificationSent);
    if (lastSent.getMonth() === currentMonth && lastSent.getFullYear() === currentYear) {
      console.log(`[Monthly Notification] Already sent monthly notification to ${user.email} this month`);
      return;
    }
  }

  // Получаем все подписки пользователя
  const subscriptions = await Subscription.find({
    userId: user._id,
    status: { $ne: 'archived' }
  }).populate('categoryId');

  if (subscriptions.length === 0) {
    console.log(`[Monthly Notification] User ${user.email} has no subscriptions`);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Фильтруем подписки, у которых платёж в текущем месяце
  const monthSubscriptions = [];
  const paidSubscriptions = [];
  const upcomingSubscriptions = [];

  for (const sub of subscriptions) {
    const paymentDateInMonth = getPaymentDateInMonth(sub, currentMonth, currentYear);

    if (paymentDateInMonth) {
      monthSubscriptions.push({ sub, paymentDate: paymentDateInMonth });

      // Разделяем на оплаченные и предстоящие
      if (paymentDateInMonth < today) {
        paidSubscriptions.push({ sub, paymentDate: paymentDateInMonth });
      } else {
        upcomingSubscriptions.push({ sub, paymentDate: paymentDateInMonth });
      }
    }
  }

  if (monthSubscriptions.length === 0) {
    console.log(`[Monthly Notification] User ${user.email} has no subscriptions for current month`);
    return;
  }

  // Функция для группировки подписок по категориям
  const groupByCategory = (items) => {
    const grouped = {};
    for (const item of items) {
      const categoryName = item.sub.categoryId?.name || 'Без категории';
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push(item);
    }
    return grouped;
  };

  // Функция для форматирования списка подписок
  const formatSubscriptionList = (items) => {
    let text = '';
    let totalCost = 0;

    const grouped = groupByCategory(items);

    for (const [categoryName, categoryItems] of Object.entries(grouped)) {
      text += `<b>${categoryName}</b>\n`;

      // Сортируем по дате
      categoryItems.sort((a, b) => a.paymentDate - b.paymentDate);

      for (const { sub, paymentDate } of categoryItems) {
        const dateStr = paymentDate.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short'
        });
        const amount = formatAmount(sub.cost, sub.currency);

        // Приводим к месячной стоимости независимо от цикла
        totalCost += getMonthlyCost(sub);

        // Иконка уведомлений
        const notifyIcon = sub.notificationsEnabled ? '🔔' : '🔕';

        // Цикл платежа
        const cycleMeta = getCycleMeta(sub.cycle);

        text += `  ${notifyIcon} ${sub.name}\n`;
        text += `     ${amount} ${cycleMeta.icon} ${cycleMeta.perLabel}\n`;
        text += `     💳 Платёж: ${dateStr}\n`;

        if (sub.notificationsEnabled && sub.notifyDaysBefore?.length > 0) {
          text += `     ⏰ Напомнить за: ${sub.notifyDaysBefore.join(', ')} дн.\n`;
        }

        text += '\n';
      }
    }

    return { text, totalCost };
  };

  // Формируем сообщение
  let message = `📅 <b>Подписки на ${now.toLocaleString('ru-RU', { month: 'long' })} ${currentYear}</b>\n\n`;

  let totalMonthCost = 0;

  // Раздел оплаченных подписок
  if (paidSubscriptions.length > 0) {
    message += `✅ <b>Уже оплачено (${paidSubscriptions.length})</b>\n\n`;
    const { text, totalCost } = formatSubscriptionList(paidSubscriptions);
    message += text;
    totalMonthCost += totalCost;
  }

  // Раздел предстоящих платежей
  if (upcomingSubscriptions.length > 0) {
    if (paidSubscriptions.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━━\n\n`;
    }
    message += `⏳ <b>Предстоящие платежи (${upcomingSubscriptions.length})</b>\n\n`;
    const { text, totalCost } = formatSubscriptionList(upcomingSubscriptions);
    message += text;
    totalMonthCost += totalCost;
  }

  message += `\n📊 <b>Итого за месяц:</b> ${monthSubscriptions.length} подписок\n`;
  message += `💰 <b>Примерная сумма:</b> ~${Math.round(totalMonthCost)} ₽`;

  if (paidSubscriptions.length > 0 && upcomingSubscriptions.length > 0) {
    message += `\n\n<i>✅ Оплачено: ${paidSubscriptions.length} | ⏳ Ожидается: ${upcomingSubscriptions.length}</i>`;
  }

  // Отправляем уведомление
  try {
    await sendNotification(user.telegramChatId, message);

    // Обновляем дату последнего месячного уведомления
    user.lastMonthlyNotificationSent = new Date();
    await user.save();

    console.log(`[Monthly Notification] Sent monthly notification to user ${user.email} for ${monthSubscriptions.length} subscriptions`);
  } catch (error) {
    console.error(`[Monthly Notification] Failed to send monthly notification to user ${user.email}:`, error);
    throw error;
  }
}
