import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Настройка __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
config({ path: join(__dirname, '.env') });

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Простое хранилище в памяти (замените на базу данных в продакшене)
const users = new Map();
const subscriptions = new Map(); // userId -> [subscriptions]

// Middleware
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

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Токен не предоставлен' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истек' });
    }
    return res.status(403).json({ message: 'Неверный токен' });
  }
};

// Вспомогательные функции
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET || 'fallback-secret-key',
    { expiresIn: '7d' }
  );
};

const getUserSubscriptions = (userId) => {
  return subscriptions.get(userId) || [];
};

const setUserSubscriptions = (userId, userSubs) => {
  subscriptions.set(userId, userSubs);
};

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const validateSubscriptionData = (data) => {
  const { name, cost, currency, cycle, paymentDay } = data;
  
  if (!name?.trim()) {
    throw new Error('Название подписки обязательно');
  }
  
  if (!cost || isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
    throw new Error('Стоимость должна быть положительным числом');
  }
  
  if (!currency) {
    throw new Error('Валюта обязательна');
  }
  
  if (!cycle || !['monthly', 'annually'].includes(cycle)) {
    throw new Error('Цикл оплаты должен быть monthly или annually');
  }
  
  if (!paymentDay || isNaN(parseInt(paymentDay))) {
    throw new Error('День оплаты обязателен');
  }
  
  return true;
};

// =====================
// МАРШРУТЫ АВТОРИЗАЦИИ
// =====================

// Google OAuth авторизация
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Токен Google не предоставлен' });
    }

    // Верифицируем Google токен
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { 
      sub: googleId, 
      email, 
      name, 
      picture,
      email_verified 
    } = payload;

    // Проверяем подтверждение email
    if (!email_verified) {
      return res.status(400).json({
        message: 'Email не подтвержден в Google аккаунте'
      });
    }

    // Находим или создаем пользователя
    let user = users.get(googleId);
    
    if (!user) {
      user = {
        id: googleId,
        googleId,
        email,
        name,
        avatar: picture,
        provider: 'google',
        isEmailVerified: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      users.set(googleId, user);
      
      // Инициализируем пустой массив подписок для нового пользователя
      setUserSubscriptions(googleId, []);
      
      console.log(`Новый пользователь зарегистрирован: ${email}`);
    } else {
      // Обновляем данные существующего пользователя
      user.lastLogin = new Date().toISOString();
      user.avatar = picture; // Обновляем аватар
      user.name = name; // Обновляем имя
      users.set(googleId, user);
    }

    // Создаем JWT токен
    const authToken = generateToken(user);

    res.json({
      success: true,
      token: authToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Google OAuth ошибка:', error);
    
    if (error.message?.includes('Token used too early')) {
      return res.status(400).json({
        message: 'Токен Google используется слишком рано. Попробуйте еще раз через несколько секунд.'
      });
    }
    
    res.status(401).json({
      success: false,
      message: 'Неверный Google токен'
    });
  }
});

// Получение текущего пользователя
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.get(req.user.userId);
  
  if (!user) {
    return res.status(404).json({ message: 'Пользователь не найден' });
  }
  
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }
  });
});

// Выход
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // В простой реализации просто подтверждаем выход
  // В реальном приложении здесь можно добавить токен в blacklist
  res.json({ 
    success: true,
    message: 'Выход выполнен успешно' 
  });
});

// =====================
// МАРШРУТЫ ПОДПИСОК
// =====================

// Получение всех подписок пользователя
app.get('/api/subscriptions', authenticateToken, (req, res) => {
  try {
    const userSubs = getUserSubscriptions(req.user.userId);
    res.json({
      success: true,
      subscriptions: userSubs
    });
  } catch (error) {
    console.error('Ошибка получения подписок:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создание новой подписки
app.post('/api/subscriptions', authenticateToken, (req, res) => {
  try {
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = req.body;
    
    // Валидация
    validateSubscriptionData(req.body);

    const newSubscription = {
      id: generateId(),
      name: name.trim(),
      cost: parseFloat(cost),
      currency,
      cycle,
      paymentDay: parseInt(paymentDay),
      fullPaymentDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const userSubs = getUserSubscriptions(req.user.userId);
    userSubs.push(newSubscription);
    setUserSubscriptions(req.user.userId, userSubs);

    res.status(201).json({
      success: true,
      subscription: newSubscription,
      message: 'Подписка создана успешно'
    });
  } catch (error) {
    console.error('Ошибка создания подписки:', error);
    res.status(400).json({ message: error.message });
  }
});

// Обновление подписки
app.put('/api/subscriptions/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = req.body;
    
    const userSubs = getUserSubscriptions(req.user.userId);
    const subscriptionIndex = userSubs.findIndex(sub => sub.id === id);
    
    if (subscriptionIndex === -1) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    // Частичная валидация обновляемых полей
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (cost !== undefined) {
      const parsedCost = parseFloat(cost);
      if (isNaN(parsedCost) || parsedCost <= 0) {
        throw new Error('Стоимость должна быть положительным числом');
      }
      updateData.cost = parsedCost;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (cycle !== undefined) {
      if (!['monthly', 'annually'].includes(cycle)) {
        throw new Error('Цикл оплаты должен быть monthly или annually');
      }
      updateData.cycle = cycle;
    }
    if (paymentDay !== undefined) {
      const parsedDay = parseInt(paymentDay);
      if (isNaN(parsedDay)) {
        throw new Error('День оплаты должен быть числом');
      }
      updateData.paymentDay = parsedDay;
    }
    if (fullPaymentDate !== undefined) updateData.fullPaymentDate = fullPaymentDate;

    // Обновляем подписку
    const updatedSubscription = {
      ...userSubs[subscriptionIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    userSubs[subscriptionIndex] = updatedSubscription;
    setUserSubscriptions(req.user.userId, userSubs);

    res.json({
      success: true,
      subscription: updatedSubscription,
      message: 'Подписка обновлена успешно'
    });
  } catch (error) {
    console.error('Ошибка обновления подписки:', error);
    res.status(400).json({ message: error.message });
  }
});

// Удаление подписки
app.delete('/api/subscriptions/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    const userSubs = getUserSubscriptions(req.user.userId);
    const subscriptionIndex = userSubs.findIndex(sub => sub.id === id);
    
    if (subscriptionIndex === -1) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    const deletedSubscription = userSubs.splice(subscriptionIndex, 1)[0];
    setUserSubscriptions(req.user.userId, userSubs);

    res.json({
      success: true,
      message: `Подписка "${deletedSubscription.name}" удалена успешно`
    });
  } catch (error) {
    console.error('Ошибка удаления подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Импорт подписок из JSON
app.post('/api/subscriptions/import', authenticateToken, (req, res) => {
  try {
    const { subscriptions: importedSubs } = req.body;
    
    if (!Array.isArray(importedSubs)) {
      return res.status(400).json({ 
        message: 'Данные для импорта должны быть массивом' 
      });
    }

    const userSubs = getUserSubscriptions(req.user.userId);
    let addedCount = 0;
    const errors = [];

    importedSubs.forEach((sub, index) => {
      try {
        // Проверяем, нет ли уже такой подписки
        const exists = userSubs.some(existing => 
          existing.name === sub.name && 
          existing.cost === sub.cost && 
          existing.paymentDay === (sub.payment_day || sub.paymentDay)
        );

        if (!exists && sub.name && sub.cost) {
          // Нормализуем данные
          const normalizedSub = {
            id: generateId(),
            name: sub.name.trim(),
            cost: parseFloat(sub.cost),
            currency: sub.currency || 'RUB',
            cycle: sub.cycle || 'monthly',
            paymentDay: parseInt(sub.payment_day || sub.paymentDay),
            fullPaymentDate: sub.next_payment_date || sub.fullPaymentDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Валидируем данные
          validateSubscriptionData(normalizedSub);
          
          userSubs.push(normalizedSub);
          addedCount++;
        }
      } catch (error) {
        errors.push(`Подписка ${index + 1}: ${error.message}`);
      }
    });

    setUserSubscriptions(req.user.userId, userSubs);

    const response = {
      success: true,
      message: `Импортировано ${addedCount} подписок`,
      addedCount,
      totalCount: userSubs.length
    };

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

// =====================
// УТИЛИТЫ И СТАТИСТИКА
// =====================

// Статистика пользователя
app.get('/api/stats', authenticateToken, (req, res) => {
  try {
    const userSubs = getUserSubscriptions(req.user.userId);
    
    const stats = {
      totalSubscriptions: userSubs.length,
      totalMonthlyCost: userSubs.reduce((total, sub) => {
        const monthlyCost = sub.cycle === 'annually' ? sub.cost / 12 : sub.cost;
        return total + monthlyCost;
      }, 0),
      totalAnnualCost: userSubs.reduce((total, sub) => {
        const annualCost = sub.cycle === 'monthly' ? sub.cost * 12 : sub.cost;
        return total + annualCost;
      }, 0),
      byCurrency: userSubs.reduce((acc, sub) => {
        acc[sub.currency] = (acc[sub.currency] || 0) + 1;
        return acc;
      }, {}),
      byCycle: userSubs.reduce((acc, sub) => {
        acc[sub.cycle] = (acc[sub.cycle] || 0) + 1;
        return acc;
      }, {}),
      averageCost: userSubs.length > 0 ? 
        userSubs.reduce((total, sub) => {
          const monthlyCost = sub.cycle === 'annually' ? sub.cost / 12 : sub.cost;
          return total + monthlyCost;
        }, 0) / userSubs.length : 0
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Проверка здоровья сервера
app.get('/api/health', (req, res) => {
  const totalSubscriptions = Array.from(subscriptions.values())
    .reduce((total, subs) => total + subs.length, 0);

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    },
    users: users.size,
    subscriptions: totalSubscriptions,
    version: process.env.npm_package_version || '1.0.0',
    node: process.version
  });
});

// Экспорт данных пользователя
app.get('/api/export', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.userId);
    const userSubs = getUserSubscriptions(req.user.userId);
    
    const exportData = {
      user: {
        name: user.name,
        email: user.email,
        exportedAt: new Date().toISOString()
      },
      subscriptions: userSubs.map(sub => ({
        name: sub.name,
        cost: sub.cost,
        currency: sub.currency,
        cycle: sub.cycle,
        paymentDay: sub.paymentDay,
        fullPaymentDate: sub.fullPaymentDate
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="subscriptions-export.json"');
    res.json(exportData);
  } catch (error) {
    console.error('Ошибка экспорта данных:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

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
app.use((error, req, res, next) => {
  console.error('Необработанная ошибка:', error);
  res.status(500).json({ 
    message: 'Внутренняя ошибка сервера',
    ...(process.env.NODE_ENV === 'development' && { error: error.message, stack: error.stack })
  });
});

// =====================
// ЗАПУСК СЕРВЕРА
// =====================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
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
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} получен, завершаю сервер...`);
  
  server.close((err) => {
    if (err) {
      console.error('Ошибка при закрытии сервера:', err);
      process.exit(1);
    }
    
    console.log('Сервер успешно остановлен');
    process.exit(0);
  });
  
  // Принудительное завершение через 10 секунд
  setTimeout(() => {
    console.error('Принудительное завершение процесса');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

export default app;