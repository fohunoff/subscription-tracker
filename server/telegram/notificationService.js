import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Category from '../models/Category.js';
import { sendNotification } from './bot.js';

/**
 * Получить дату следующего платежа для подписки
 */
function getNextPaymentDate(subscription) {
  if (!subscription.fullPaymentDate) return null;

  const startDate = new Date(subscription.fullPaymentDate);
  const today = new Date();
  let nextDate = new Date(startDate);

  if (subscription.cycle === 'monthly') {
    // Добавляем месяцы пока не найдем будущую дату
    while (nextDate <= today) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  } else if (subscription.cycle === 'annually') {
    // Добавляем годы пока не найдем будущую дату
    while (nextDate <= today) {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
  }

  return nextDate;
}

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
