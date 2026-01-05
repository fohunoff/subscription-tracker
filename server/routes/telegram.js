import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();

/**
 * Генерация токена для подключения Telegram
 * POST /api/telegram/generate-token
 */
router.post('/generate-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.userDoc._id;

    // Генерируем случайный токен
    const token = crypto.randomBytes(16).toString('hex');

    // Токен действителен 15 минут
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Сохраняем токен в БД
    await User.findByIdAndUpdate(userId, {
      telegramConnectionToken: token,
      telegramConnectionTokenExpires: expiresAt
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
    const botLink = `https://t.me/${botUsername}?start=${token}`;

    res.json({
      success: true,
      token,
      botLink,
      expiresAt
    });

  } catch (error) {
    console.error('Ошибка генерации токена:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка генерации токена подключения'
    });
  }
});

/**
 * Получение статуса подключения Telegram
 * GET /api/telegram/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.userDoc._id;

    const user = await User.findById(userId).select(
      'telegramChatId telegramUsername telegramConnectedAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const isConnected = !!user.telegramChatId;

    res.json({
      success: true,
      connected: isConnected,
      telegramUsername: user.telegramUsername,
      connectedAt: user.telegramConnectedAt
    });

  } catch (error) {
    console.error('Ошибка получения статуса:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статуса подключения'
    });
  }
});

/**
 * Отключение Telegram
 * DELETE /api/telegram/disconnect
 */
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.userDoc._id;

    await User.findByIdAndUpdate(userId, {
      telegramChatId: null,
      telegramUsername: null,
      telegramConnectedAt: null,
      telegramConnectionToken: null,
      telegramConnectionTokenExpires: null
    });

    res.json({
      success: true,
      message: 'Telegram успешно отключен'
    });

  } catch (error) {
    console.error('Ошибка отключения Telegram:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка отключения Telegram'
    });
  }
});

/**
 * Получение настроек уведомлений
 * GET /api/telegram/notification-settings
 */
router.get('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.userDoc._id;

    const user = await User.findById(userId).select(
      'notificationTime monthlyNotificationsEnabled'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      notificationTime: user.notificationTime || '10:00',
      monthlyNotificationsEnabled: user.monthlyNotificationsEnabled !== false
    });

  } catch (error) {
    console.error('Ошибка получения настроек уведомлений:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения настроек уведомлений'
    });
  }
});

/**
 * Обновление настроек уведомлений
 * PUT /api/telegram/notification-settings
 */
router.put('/notification-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.userDoc._id;
    const { notificationTime, monthlyNotificationsEnabled } = req.body;

    const updateData = {};

    if (notificationTime !== undefined) {
      // Валидация формата времени
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(notificationTime)) {
        return res.status(400).json({
          success: false,
          message: 'Неверный формат времени. Используйте HH:MM'
        });
      }
      updateData.notificationTime = notificationTime;
    }

    if (monthlyNotificationsEnabled !== undefined) {
      updateData.monthlyNotificationsEnabled = monthlyNotificationsEnabled;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('notificationTime monthlyNotificationsEnabled');

    res.json({
      success: true,
      message: 'Настройки уведомлений обновлены',
      notificationTime: user.notificationTime,
      monthlyNotificationsEnabled: user.monthlyNotificationsEnabled
    });

  } catch (error) {
    console.error('Ошибка обновления настроек уведомлений:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка обновления настроек уведомлений'
    });
  }
});

export default router;
