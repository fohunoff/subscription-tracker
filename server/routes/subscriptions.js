import { Router } from 'express';
import Subscription from '../models/Subscription.js';
import { validateSubscriptionData } from '../utils/index.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();

// Получение всех подписок пользователя
router.get('/', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userDoc._id }).sort({ createdAt: -1 });
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
    res.json({ success: true, subscriptions: formattedSubs });
  } catch (error) {
    console.error('Ошибка получения подписок:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создание новой подписки
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = req.body;
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
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate } = req.body;
    const subscription = await Subscription.findOne({ _id: id, userId: req.userDoc._id });
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
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
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSubscription = await Subscription.findOneAndDelete({ _id: id, userId: req.userDoc._id });
    if (!deletedSubscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }
    res.json({ success: true, message: `Подписка "${deletedSubscription.name}" удалена успешно` });
  } catch (error) {
    console.error('Ошибка удаления подписки:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Импорт подписок из JSON
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { subscriptions: importedSubs } = req.body;
    if (!Array.isArray(importedSubs)) {
      return res.status(400).json({ message: 'Данные для импорта должны быть массивом' });
    }
    let addedCount = 0;
    const errors = [];
    for (const [index, sub] of importedSubs.entries()) {
      try {
        const exists = await Subscription.findOne({
          userId: req.userDoc._id,
          name: sub.name,
          cost: sub.cost,
          paymentDay: sub.payment_day || sub.paymentDay
        });
        if (!exists && sub.name && sub.cost) {
          const normalizedSub = {
            userId: req.userDoc._id,
            name: sub.name.trim(),
            cost: parseFloat(sub.cost),
            currency: sub.currency || 'RUB',
            cycle: sub.cycle || 'monthly',
            paymentDay: parseInt(sub.payment_day || sub.paymentDay),
            fullPaymentDate: sub.next_payment_date || sub.fullPaymentDate || null
          };
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

export default router;
