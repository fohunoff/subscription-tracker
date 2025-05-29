import process from 'process';
import jwt from 'jsonwebtoken';

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.googleId,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET || 'fallback-secret-key',
    { expiresIn: '7d' }
  );
};

export const validateSubscriptionData = (data) => {
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
