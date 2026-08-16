import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env, isProduction } from './config.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import categoriesRoutes from './routes/categories.js';
import statsRoutes from './routes/stats.js';
import healthRoutes from './routes/health.js';
import telegramRoutes from './routes/telegram.js';
import currencyRatesRoutes from './routes/currencyRates.js';

const app = express();

// За Nginx: доверяем X-Forwarded-* (нужно для корректного IP в rate-limit)
app.set('trust proxy', 1);

// =====================
// MIDDLEWARE
// =====================

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Запросы без Origin (curl, health-чеки, Telegram) пропускаем
    if (!origin || env.allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    console.warn(`⚠️  CORS: origin ${origin} не входит в FRONTEND_URL`);
    const error = new Error('Origin не разрешён политикой CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Ограничение частоты запросов к чувствительным маршрутам
app.use('/api/auth/google', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Слишком много попыток входа, попробуйте позже' }
}));
app.use('/api/telegram', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Слишком много запросов, попробуйте позже' }
}));

// Логирование запросов вне продакшена
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// =====================
// ROUTES
// =====================

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/currency-rates', currencyRatesRoutes);

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

// Глобальный обработчик ошибок.
// Express распознаёт error-handler по четырём аргументам — next не используется,
// но убирать его нельзя, иначе это станет обычным middleware.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) {
    console.error('Необработанная ошибка:', error);
  }
  res.status(status).json({
    message: status === 500 ? 'Внутренняя ошибка сервера' : error.message,
    ...(!isProduction && { error: error.message, stack: error.stack })
  });
});

export default app;
