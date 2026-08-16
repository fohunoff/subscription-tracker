import process from 'process';
import mongoose from 'mongoose';

import { env } from './config.js';
import app from './app.js';
import { initBot, startBot, stopBot } from './telegram/bot.js';
import { startScheduler, stopScheduler } from './telegram/scheduler.js';
import { initializeCurrencyRates } from './services/currencyService.js';

// =====================
// ПОДКЛЮЧЕНИЕ К MONGODB
// =====================

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongodbUri);
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    console.log('💡 Убедитесь что MongoDB запущена и MONGODB_URI настроен');
    process.exit(1);
  }
};

// =====================
// ЗАПУСК СЕРВЕРА
// =====================

const startServer = async () => {
  try {
    await connectDB();

    const PORT = env.port;

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT} (${env.nodeEnv})`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Разрешённые origin: ${env.allowedOrigins.join(', ')}`);
      // JWT_SECRET и GOOGLE_CLIENT_ID проверены в config.js до старта —
      // сюда выполнение доходит только если они заданы.
      console.log('✅ Обязательные переменные окружения настроены');

      if (!env.telegramBotToken) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN не установлен, Telegram уведомления не будут работать');
      }
      if (!env.telegramBotUsername) {
        console.warn('⚠️  TELEGRAM_BOT_USERNAME не установлен');
      }

      // Инициализируем курсы валют
      initializeCurrencyRates();

      // Запускаем Telegram бота ПОСЛЕ запуска HTTP сервера
      const bot = initBot(env.telegramBotToken);
      if (bot) {
        startBot(); // Без await - запускаем в фоне
        startScheduler(); // Запускаем scheduler для уведомлений
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} получен, завершаю сервер...`);

      // Останавливаем scheduler и Telegram бота
      stopScheduler();
      await stopBot();

      server.close(async (err) => {
        if (err) {
          console.error('Ошибка при закрытии сервера:', err);
          process.exit(1);
        }
        try {
          await mongoose.connection.close();
          console.log('🔌 Подключение к MongoDB закрыто');
          console.log('Сервер успешно остановлен');
          process.exit(0);
        } catch (dbErr) {
          console.error('Ошибка при закрытии MongoDB:', dbErr);
          process.exit(1);
        }
      });
      setTimeout(() => {
        console.error('Принудительное завершение процесса');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Не удалось запустить сервер:', error.message);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export default app;
