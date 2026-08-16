import jwt from 'jsonwebtoken';
import { env } from '../config.js';

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.googleId,
      email: user.email,
      name: user.name
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
};

export const validateSubscriptionData = (data, requiresReminders = true) => {
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
  
  // Проверяем поля даты только если требуются напоминания
  if (requiresReminders) {
    if (!paymentDay || isNaN(parseInt(paymentDay))) {
      throw new Error('День оплаты обязателен для категорий с напоминаниями');
    }
  }
  
  return true;
};