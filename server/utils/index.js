import jwt from 'jsonwebtoken';
import { env } from '../config.js';
import { CYCLE_VALUES, isValidCycle } from './cycle.js';

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
  const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = data;

  if (!name?.trim()) {
    throw new Error('Название подписки обязательно');
  }
  if (!cost || isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
    throw new Error('Стоимость должна быть положительным числом');
  }
  if (!currency || !['RUB', 'USD', 'EUR', 'RSD'].includes(currency)) {
    throw new Error('Недопустимая валюта');
  }
  if (!cycle || !isValidCycle(cycle)) {
    throw new Error(`Цикл оплаты должен быть одним из: ${CYCLE_VALUES.join(', ')}`);
  }

  // Проверяем поля даты только если требуются напоминания
  if (requiresReminders) {
    if (!paymentDay || isNaN(parseInt(paymentDay))) {
      throw new Error('День оплаты обязателен для категорий с напоминаниями');
    }
  }

  // Для квартальной подписки одного дня месяца недостаточно: без полной даты
  // неизвестно, в какие именно месяцы приходится списание.
  if (cycle === 'quarterly' && !fullPaymentDate) {
    throw new Error('Для квартальной подписки укажите полную дату платежа');
  }


  return true;
};