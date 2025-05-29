import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

// Настройка __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
config({ path: join(__dirname, '.env') });

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
// MONGOOSE МОДЕЛИ
// =====================

// Модель пользователя
const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true
  },
  avatar: String,
  provider: {
    type: String,
    enum: ['google'],
    default: 'google'
  },
  isEmailVerified: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

// Модель подписки
const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['RUB', 'USD', 'EUR', 'RSD'],
    default: 'RUB'
  },
  cycle: {
    type: String,
    required: true,
    enum: ['monthly', 'annually'],
    default: 'monthly'
  },
  paymentDay: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  fullPaymentDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
subscriptionSchema.index({ userId: 1, createdAt: -1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

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

// Middleware для проверки токена
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Токен не предоставлен' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    
    // Проверяем существование пользователя в БД
    const user = await User.findOne({ googleId: decoded.userId });
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    
    req.user = decoded;
    req.userDoc = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истек' });
    }
    return res.status(403).json({ message: 'Неверный токен' });
  }
};

// =====================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================

const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.googleId, // Используем googleId как основной ID
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET || 'fallback-secret-key',
    { expiresIn: '7d' }
  );
};

const validateSubscriptionData = (data) => {
  const { name, cost, currency, cycle, paymentDay } = data;
  
  if (!name?.trim()) {
    throw new Error('Название подписки обязательно');
  }
  
  if (!cost || isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
    throw new Error('Стоимость должна быть положительным числом');
  }
  
  if (!currency || !['RUB', 'USD', 'EUR', 'RSD'].includes(currency)) {
    throw new Error('Недопустимая валюта');
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

    // Находим или создаем пользователя в БД
    let user = await User.findOne({ googleId });
    
    if (!user) {
      user = await User.create({
        googleId,
        email,
        name,
        avatar: picture,
        provider: 'google',
        isEmailVerified: true,
        lastLogin: new Date()
      });
      
      console.log(`Новый пользователь зарегистрирован: ${email}`);
    } else {
      // Обновляем данные существующего пользователя
      user.lastLogin = new Date();
      user.avatar = picture;
      user.name = name;
      await user.save();
    }

    // Создаем JWT токен
    const authToken = generateToken(user);

    res.json({
      success: true,
      token: authToken,
      user: {
        id: user.googleId,
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
  const user = req.userDoc;
  
  res.json({
    user: {
      id: user.googleId,
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
  res.json({ 
    success: true,
    message: 'Выход выполнен успешно' 
  });
});

// =====================
// МАРШРУТЫ ПОДПИСОК
// =====================

// Получение всех подписок пользователя
app.get('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ 
      userId: req.userDoc._id 
    }).sort({ createdAt: -1 });

    // Преобразуем для фронтенда
    const formattedSubs = subscriptions.map(sub => ({
      id: sub._id.toString(),
      name: sub.name,
      cost: sub.cost,
      currency: sub.currency,
      cycle: sub.cycle,
      paymentDay: sub.paymentDay,
      fullPaymentDate: sub.fullPaymentDate,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt
    }));

    res.json({
      success: true,
      subscriptions: formattedSubs
    });
  } catch (error) {
    console.error('Ошибка получения подписок:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создание новой подписки
app.post('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = req.body;
    
    // Валидация
    validateSubscriptionData(req.body);

    const newSubscription = await Subscription.create({
      userId: req.userDoc._id,
      name: name.trim(),
      cost: parseFloat(cost),
      currency,
      cycle,
      paymentDay: parseInt(paymentDay),
      fullPaymentDate
    });

    res.status(201).json({
      success: true,
      subscription: {
        id: newSubscription._id.toString(),
        name: newSubscription.name,
        cost: newSubscription.cost,
        currency: newSubscription.currency,
        cycle: newSubscription.cycle,
        paymentDay: newSubscription.paymentDay,
        fullPaymentDate: newSubscription.fullPaymentDate,
        createdAt: newSubscription.createdAt,
        updatedAt: newSubscription.updatedAt
      },
      message: 'Подписка создана успешно'
    });
  } catch (error) {
    console.error('Ошибка создания подписки:', error);
    res.status(400).json({ message: error.message });
  }
});

// Обновление подписки
app.put('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = req.body;
    
    // Находим подписку пользователя
    const subscription = await Subscription.findOne({ 
      _id: id, 
      userId: req.userDoc._id 
    });
    
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    // Подготавливаем данные для обновления
    const updateData = {};
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
    if (fullPaymentDate !== undefined) {
      updateData.fullPaymentDate = fullPaymentDate;
    }

    // Обновляем подписку
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      subscription: {
        id: updatedSubscription._id.toString(),
        name: updatedSubscription.name,
        cost: updatedSubscription.cost,
        currency: updatedSubscription.currency,
        cycle: updatedSubscription.cycle,
        paymentDay: updatedSubscription.paymentDay,
        fullPaymentDate: updatedSubscription.fullPaymentDate,
        createdAt: updatedSubscription.createdAt,
        updatedAt: updatedSubscription.updatedAt
      },
      message: 'Подписка обновлена успешно'
    });
  } catch (error) {
    console.error('Ошибка обновления подписки:', error);
    res.status(400).json({ message: error.message });
  }
});

// Удаление подписки
app.delete('/api/subscriptions/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedSubscription = await Subscription.findOneAndDelete({ 
      _id: id, 
      userId: req.userDoc._id 
    });
    
    if (!deletedSubscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

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
app.post('/api/subscriptions/import', authenticateToken, async (req, res) => {
  try {
    const { subscriptions: importedSubs } = req.body;
    
    if (!Array.isArray(importedSubs)) {
      return res.status(400).json({ 
        message: 'Данные для импорта должны быть массивом' 
      });
    }

    let addedCount = 0;
    const errors = [];

    for (const [index, sub] of importedSubs.entries()) {
      try {
        // Проверяем, нет ли уже такой подписки
        const exists = await Subscription.findOne({
          userId: req.userDoc._id,
          name: sub.name,
          cost: sub.cost,
          paymentDay: sub.payment_day || sub.paymentDay
        });

        if (!exists && sub.name && sub.cost) {
          // Нормализуем данные
          const normalizedSub = {
            userId: req.userDoc._id,
            name: sub.name.trim(),
            cost: parseFloat(sub.cost),
            currency: sub.currency || 'RUB',
            cycle: sub.cycle || 'monthly',
            paymentDay: parseInt(sub.payment_day || sub.paymentDay),
            fullPaymentDate: sub.next_payment_date || sub.fullPaymentDate || null
          };

          // Валидируем данные
          validateSubscriptionData(normalizedSub);
          
          await Subscription.create(normalizedSub);
          addedCount++;
        }
      } catch (error) {
        errors.push(`Подписка ${index + 1}: ${error.message}`);
      }
    }

    const response = {
      success: true,
      message: `Импортировано ${addedCount} подписок`,
      addedCount
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
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userDoc._id });
    
    const stats = {
      totalSubscriptions: subscriptions.length,
      totalMonthlyCost: subscriptions.reduce((total, sub) => {
        const monthlyCost = sub.cycle === 'annually' ? sub.cost / 12 : sub.cost;
        return total + monthlyCost;
      }, 0),
      totalAnnualCost: subscriptions.reduce((total, sub) => {
        const annualCost = sub.cycle === 'monthly' ? sub.cost * 12 : sub.cost;
        return total + annualCost;
      }, 0),
      byCurrency: subscriptions.reduce((acc, sub) => {
        acc[sub.currency] = (acc[sub.currency] || 0) + 1;
        return acc;
      }, {}),
      byCycle: subscriptions.reduce((acc, sub) => {
        acc[sub.cycle] = (acc[sub.cycle] || 0) + 1;
        return acc;
      }, {}),
      averageCost: subscriptions.length > 0 ? 
        subscriptions.reduce((total, sub) => {
          const monthlyCost = sub.cycle === 'annually' ? sub.cost / 12 : sub.cost;
          return total + monthlyCost;
        }, 0) / subscriptions.length : 0
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
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем подключение к БД
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const usersCount = await User.countDocuments();
    const subscriptionsCount = await Subscription.countDocuments();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      database: {
        status: dbStatus,
        users: usersCount,
        subscriptions: subscriptionsCount
      },
      version: process.env.npm_package_version || '1.0.0',
      node: process.version
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
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

const startServer = async () => {
  try {
    // Подключаемся к MongoDB
    await connectDB();
    
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
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} получен, завершаю сервер...`);
      
      server.close(async (err) => {
        if (err) {
          console.error('Ошибка при закрытии сервера:', err);
          process.exit(1);
        }
        
        // Закрываем подключение к БД
        await mongoose.connection.close();
        console.log('🔌 Подключение к MongoDB закрыто');
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

  } catch (error) {
    console.error('❌ Не удалось запустить сервер:', error.message);
    process.exit(1);
  }
};

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Запускаем сервер
startServer();

export default app;