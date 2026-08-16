import process from 'process';
import { Telegraf } from 'telegraf';
import { handleStart, handleStatus, handleHelp, handleMonth, handleUnknown } from './handlers.js';

let bot = null;

/**
 * Инициализация Telegram бота
 */
export const initBot = (botToken) => {
  if (!botToken) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN не установлен, бот не будет запущен');
    return null;
  }

  try {
    bot = new Telegraf(botToken);

    // Регистрируем обработчики команд
    bot.command('start', handleStart);
    bot.command('status', handleStatus);
    bot.command('month', handleMonth);
    bot.command('help', handleHelp);

    // Обработчик неизвестных команд
    bot.on('message', handleUnknown);

    // Обработка ошибок бота
    bot.catch((err, ctx) => {
      console.error('Ошибка в Telegram боте:', err);
      ctx.reply('Произошла ошибка. Попробуйте позже.');
    });

    console.log('✅ Telegram бот инициализирован');
    return bot;

  } catch (error) {
    console.error('❌ Ошибка инициализации Telegram бота:', error);
    return null;
  }
};

/**
 * Запуск бота (long polling)
 */
export const startBot = async () => {
  if (!bot) {
    console.warn('⚠️  Бот не инициализирован, пропускаем запуск');
    return;
  }

  try {
    await bot.launch();
    console.log('🤖 Telegram бот запущен и готов к работе');

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

  } catch (error) {
    console.error('❌ Ошибка запуска Telegram бота:', error);
  }
};

/**
 * Остановка бота
 */
export const stopBot = async () => {
  if (bot) {
    await bot.stop();
    console.log('🛑 Telegram бот остановлен');
  }
};

/**
 * Получить инстанс бота (для отправки уведомлений)
 */
export const getBot = () => bot;

/**
 * Отправить уведомление пользователю
 */
export const sendNotification = async (chatId, message) => {
  if (!bot) {
    console.error('Бот не инициализирован, не могу отправить уведомление');
    return false;
  }

  try {
    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML'
    });
    return true;
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    return false;
  }
};

export default { initBot, startBot, stopBot, getBot, sendNotification };
