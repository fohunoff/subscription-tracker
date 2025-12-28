import process from 'process';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import categoriesRoutes from './routes/categories.js';
import statsRoutes from './routes/stats.js';
import healthRoutes from './routes/health.js';
import telegramRoutes from './routes/telegram.js';
import { initBot, startBot, stopBot } from './telegram/bot.js';

// Настройка __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
config({ path: join(__dirname, '.env') });

const app = express();

// =====================
// MIDDLEWARE
// =====================

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Логирование запросов в development режиме
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// =====================
// ПОДКЛЮЧЕНИЕ К MONGODB
// =====================

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/subscription-tracker', {
      // Новые опции подключения для Mongoose 6+
    });
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    console.log('💡 Убедитесь что MongoDB запущена и MONGODB_URI настроен');
    process.exit(1);
  }
};

// =====================
// ROUTES
// =====================
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/telegram', telegramRoutes);

// =====================
// ОБРАБОТКА ОШИБОК
// =====================

// 404 для неизвестных маршрутов
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Маршрут не найден',
    path: req.originalUrl,
    method: req.method
  });
});

// Глобальный обработчик ошибок
app.use((error, req, res) => {
  console.error('Необработанная ошибка:', error);
  res.status(500).json({
    message: 'Внутренняя ошибка сервера',
    ...(process.env.NODE_ENV === 'development' && { error: error.message, stack: error.stack })
  });
});

// =====================
// ЗАПУСК СЕРВЕРА
// =====================

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      // Проверяем переменные окружения
      const requiredEnvVars = ['GOOGLE_CLIENT_ID'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        console.warn('⚠️  Отсутствуют переменные окружения:', missingVars.join(', '));
        console.warn('💡 Создайте .env файл с необходимыми переменными');
      } else {
        console.log('✅ Все переменные окружения настроены');
      }
      if (!process.env.JWT_SECRET) {
        console.warn('⚠️  JWT_SECRET не установлен, используется fallback ключ');
      }
      // Проверка Telegram переменных
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN не установлен, Telegram уведомления не будут работать');
      }
      if (!process.env.TELEGRAM_BOT_USERNAME) {
        console.warn('⚠️  TELEGRAM_BOT_USERNAME не установлен');
      }

      // Запускаем Telegram бота ПОСЛЕ запуска HTTP сервера
      const bot = initBot(process.env.TELEGRAM_BOT_TOKEN);
      if (bot) {
        startBot(); // Без await - запускаем в фоне
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} получен, завершаю сервер...`);

      // Останавливаем Telegram бота
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