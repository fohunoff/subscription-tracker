import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Category from '../models/Category.js';
import {
  getPaymentDateInMonth,
  getCycleMeta,
  isSubscriptionExpired,
  isLastPayment,
  isWithinTerm
} from '../utils/cycle.js';
import { getMonthlyCostInBase } from '../utils/currency.js';
import { getLatestCurrencyRates } from '../services/currencyService.js';
import { formatAmount, currencySymbol } from './format.js';

/**
 * Обработчик команды /start с токеном подключения
 * Формат: /start ABC123
 */
export const handleStart = async (ctx) => {
  try {
    const chatId = ctx.chat.id.toString();
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;

    // Получаем токен из команды /start
    const token = ctx.message.text.split(' ')[1];

    if (!token) {
      await ctx.reply(
        '👋 Добро пожаловать в Subscription Tracker Notifier!\n\n' +
        'Чтобы подключить уведомления:\n' +
        '1. Откройте настройки в веб-приложении\n' +
        '2. Нажмите "Подключить Telegram"\n' +
        '3. Перейдите по ссылке с токеном\n\n' +
        'Или используйте команду:\n' +
        '/start ВАШ_ТОКЕН'
      );
      return;
    }

    // Ищем пользователя по токену
    const user = await User.findOne({
      telegramConnectionToken: token,
      telegramConnectionTokenExpires: { $gt: new Date() }
    });

    if (!user) {
      await ctx.reply(
        '❌ Токен недействителен или истек.\n\n' +
        'Пожалуйста, сгенерируйте новый токен в настройках приложения.'
      );
      return;
    }

    // Проверяем, не подключен ли уже этот chat_id к другому пользователю
    const existingUser = await User.findOne({
      telegramChatId: chatId,
      _id: { $ne: user._id }
    });

    if (existingUser) {
      await ctx.reply(
        '⚠️ Этот Telegram аккаунт уже подключен к другому пользователю.\n\n' +
        'Если это ваш аккаунт, сначала отключите его в настройках того профиля.'
      );
      return;
    }

    // Подключаем Telegram к пользователю
    user.telegramChatId = chatId;
    user.telegramUsername = username;
    user.telegramConnectedAt = new Date();
    user.telegramConnectionToken = null;
    user.telegramConnectionTokenExpires = null;

    await user.save();

    await ctx.reply(
      `✅ Отлично, ${firstName}!\n\n` +
      'Telegram успешно подключен к вашему аккаунту.\n' +
      'Теперь вы будете получать уведомления о предстоящих платежах.\n\n' +
      'Доступные команды:\n' +
      '/status - Проверить статус подключения\n' +
      '/help - Справка'
    );

  } catch (error) {
    console.error('Ошибка в handleStart:', error);
    await ctx.reply(
      '❌ Произошла ошибка при подключении.\n' +
      'Попробуйте позже или обратитесь в поддержку.'
    );
  }
};

/**
 * Обработчик команды /status - показывает статус подключения
 */
export const handleStatus = async (ctx) => {
  try {
    const chatId = ctx.chat.id.toString();

    const user = await User.findOne({ telegramChatId: chatId });

    if (!user) {
      await ctx.reply(
        '❌ Ваш Telegram не подключен к аккаунту.\n\n' +
        'Используйте /start с токеном из настроек приложения.'
      );
      return;
    }

    const connectedDate = user.telegramConnectedAt
      ? new Date(user.telegramConnectedAt).toLocaleString('ru-RU')
      : 'Неизвестно';

    await ctx.reply(
      `✅ Статус подключения\n\n` +
      `👤 Пользователь: ${user.name}\n` +
      `📧 Email: ${user.email}\n` +
      `📅 Подключено: ${connectedDate}\n\n` +
      `Уведомления активны!`
    );

  } catch (error) {
    console.error('Ошибка в handleStatus:', error);
    await ctx.reply('❌ Произошла ошибка при проверке статуса.');
  }
};

/**
 * Обработчик команды /help - справка
 */
export const handleHelp = async (ctx) => {
  await ctx.reply(
    '📖 Справка - Subscription Tracker Notifier\n\n' +
    '🔔 Этот бот отправляет уведомления о предстоящих платежах по подпискам.\n\n' +
    'Доступные команды:\n' +
    '/start ТОКЕН - Подключить Telegram к аккаунту\n' +
    '/status - Проверить статус подключения\n' +
    '/month - Показать все подписки текущего месяца\n' +
    '/help - Показать эту справку\n\n' +
    '📅 Автоматические уведомления:\n' +
    '• Напоминания за N дней до платежа (настраивается для каждой подписки)\n' +
    '• Месячный отчёт 1 числа каждого месяца со всеми предстоящими платежами\n\n' +
    'Для настройки уведомлений используйте веб-приложение.'
  );
};


/**
 * Обработчик команды /month - показывает все подписки текущего месяца
 */
export const handleMonth = async (ctx) => {
  try {
    const chatId = ctx.chat.id.toString();

    // Находим пользователя
    const user = await User.findOne({ telegramChatId: chatId });

    if (!user) {
      await ctx.reply(
        '❌ Ваш Telegram не подключен к аккаунту.\n\n' +
        'Используйте /start с токеном из настроек приложения.'
      );
      return;
    }

    // Получаем все подписки пользователя
    const subscriptions = await Subscription.find({
      userId: user._id,
      status: { $ne: 'archived' } // архив в отчёт не попадает
    }).populate('categoryId');

    if (subscriptions.length === 0) {
      await ctx.reply(
        '📭 У вас пока нет подписок.\n\n' +
        'Добавьте подписки в веб-приложении, чтобы отслеживать расходы.'
      );
      return;
    }

    // Получаем текущий месяц и год
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Фильтруем подписки, у которых платёж в текущем месяце
    const monthSubscriptions = [];
    const paidSubscriptions = [];
    const upcomingSubscriptions = [];

    for (const sub of subscriptions) {
      // Истёкшая подписка платежей больше не порождает, даже если осталась
      // в списке (archiveOnEnd выключен)
      if (isSubscriptionExpired(sub)) continue;

      const paymentDateInMonth = getPaymentDateInMonth(sub, currentMonth, currentYear);

      if (paymentDateInMonth && isWithinTerm(sub, paymentDateInMonth)) {
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
      await ctx.reply(
        `📅 В ${now.toLocaleString('ru-RU', { month: 'long' })} ${currentYear} нет запланированных платежей.\n\n` +
        `Всего подписок: ${subscriptions.length}`
      );
      return;
    }

    // Итог складывается из подписок в разных валютах, поэтому пересчитываем
    // в базовую валюту пользователя (пока не выбрана — в валюту курсов).
    const { rates, baseCurrency: ratesCurrency } = await getLatestCurrencyRates();
    const baseCurrency = user.baseCurrency || ratesCurrency;

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

          // Приводим к месячной стоимости в базовой валюте независимо от цикла
          totalCost += getMonthlyCostInBase(sub, rates, baseCurrency);

          // Иконка уведомлений
          const notifyIcon = sub.notificationsEnabled ? '🔔' : '🔕';

          // Цикл платежа
          const cycleMeta = getCycleMeta(sub.cycle);

          text += `  ${notifyIcon} ${sub.name}\n`;
          text += `     ${amount} ${cycleMeta.icon} ${cycleMeta.perLabel}\n`;
          text += `     💳 Платёж: ${dateStr}\n`;

          if (isLastPayment(sub, paymentDate)) {
            text += sub.archiveOnEnd !== false
              ? '     ⚠️ Последний платёж, дальше в архив\n'
              : '     ⚠️ Последний платёж, срок действия истекает\n';
          }

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
    message += `💰 <b>Примерная сумма:</b> ~${Math.round(totalMonthCost)} ${currencySymbol(baseCurrency)}`;

    if (paidSubscriptions.length > 0 && upcomingSubscriptions.length > 0) {
      message += `\n\n<i>✅ Оплачено: ${paidSubscriptions.length} | ⏳ Ожидается: ${upcomingSubscriptions.length}</i>`;
    }

    await ctx.reply(message, { parse_mode: 'HTML' });

  } catch (error) {
    console.error('Ошибка в handleMonth:', error);
    await ctx.reply('❌ Произошла ошибка при получении подписок.');
  }
};

/**
 * Обработчик неизвестных команд
 */
export const handleUnknown = async (ctx) => {
  await ctx.reply(
    'Неизвестная команда.\n\n' +
    'Используйте /help для просмотра доступных команд.'
  );
};
