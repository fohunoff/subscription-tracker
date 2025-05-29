import { Router } from 'express';
import Subscription from '../models/Subscription.js';
import Category from '../models/Category.js';
import { validateSubscriptionData } from '../utils/index.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();

// Получение всех подписок пользователя (группированные по категориям)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userDoc._id })
      .populate('categoryId')
      .sort({ createdAt: -1 });

    const formattedSubs = subscriptions.map(sub => ({
      id: sub._id.toString(),
      name: sub.name,
      cost: sub.cost,
      currency: sub.currency,
      cycle: sub.cycle,
      paymentDay: sub.paymentDay,
      fullPaymentDate: sub.fullPaymentDate,
      categoryId: sub.categoryId._id.toString(),
      category: {
        id: sub.categoryId._id.toString(),
        name: sub.categoryId.name,
        hasReminders: sub.categoryId.hasReminders,
        color: sub.categoryId.color
      },
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
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate, categoryId } = req.body;

    // Проверяем, что категория существует и принадлежит пользователю
    const category = await Category.findOne({ 
      _id: categoryId, 
      userId: req.userDoc._id 
    });

    if (!category) {
      return res.status(400).json({ message: 'Указанная категория не найдена' });
    }

    // Валидация данных подписки (с учетом того, нужны ли напоминания)
    const subscriptionData = {
      name: name?.trim(),
      cost: parseFloat(cost),
      currency,
      cycle,
      categoryId
    };

    // Если категория имеет напоминания, то обязательны поля даты
    if (category.hasReminders) {
      if (!paymentDay && !fullPaymentDate) {
        return res.status(400).json({ message: 'Для категории с напоминаниями требуется указать дату оплаты' });
      }
      subscriptionData.paymentDay = parseInt(paymentDay);
      subscriptionData.fullPaymentDate = fullPaymentDate;
    }

    validateSubscriptionData(subscriptionData, category.hasReminders);

    const newSubscription = await Subscription.create({
      userId: req.userDoc._id,
      ...subscriptionData
    });

    // Получаем созданную подписку с категорией
    const populatedSubscription = await Subscription.findById(newSubscription._id).populate('categoryId');

    res.status(201).json({
      success: true,
      subscription: {
        id: populatedSubscription._id.toString(),
        name: populatedSubscription.name,
        cost: populatedSubscription.cost,
        currency: populatedSubscription.currency,
        cycle: populatedSubscription.cycle,
        paymentDay: populatedSubscription.paymentDay,
        fullPaymentDate: populatedSubscription.fullPaymentDate,
        categoryId: populatedSubscription.categoryId._id.toString(),
        category: {
          id: populatedSubscription.categoryId._id.toString(),
          name: populatedSubscription.categoryId.name,
          hasReminders: populatedSubscription.categoryId.hasReminders,
          color: populatedSubscription.categoryId.color
        },
        createdAt: populatedSubscription.createdAt,
        updatedAt: populatedSubscription.updatedAt
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
    const { name, cost, currency, cycle, paymentDay, fullPaymentDate, categoryId } = req.body;

    const subscription = await Subscription.findOne({ _id: id, userId: req.userDoc._id }).populate('categoryId');
    if (!subscription) {
      return res.status(404).json({ message: 'Подписка не найдена' });
    }

    const updateData = {};

    // Проверяем, изменилась ли категория
    let targetCategory = subscription.categoryId;
    if (categoryId && categoryId !== subscription.categoryId._id.toString()) {
      const newCategory = await Category.findOne({ 
        _id: categoryId, 
        userId: req.userDoc._id 
      });
      if (!newCategory) {
        return res.status(400).json({ message: 'Указанная категория не найдена' });
      }
      targetCategory = newCategory;
      updateData.categoryId = categoryId;
    }

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

    // Обработка полей даты в зависимости от типа категории
    if (targetCategory.hasReminders) {
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
    } else {
      // Если категория без напоминаний, очищаем поля дат
      updateData.paymentDay = undefined;
      updateData.fullPaymentDate = undefined;
    }

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('categoryId');

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
        categoryId: updatedSubscription.categoryId._id.toString(),
        category: {
          id: updatedSubscription.categoryId._id.toString(),
          name: updatedSubscription.categoryId.name,
          hasReminders: updatedSubscription.categoryId.hasReminders,
          color: updatedSubscription.categoryId.color
        },
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
    const { subscriptions: importedSubs, categoryId } = req.body;
    if (!Array.isArray(importedSubs)) {
      return res.status(400).json({ message: 'Данные для импорта должны быть массивом' });
    }

    // Проверяем, что категория существует
    let targetCategory;
    if (categoryId) {
      targetCategory = await Category.findOne({ 
        _id: categoryId, 
        userId: req.userDoc._id 
      });
      if (!targetCategory) {
        return res.status(400).json({ message: 'Указанная категория не найдена' });
      }
    } else {
      // Используем дефолтную категорию
      targetCategory = await Category.findOne({ 
        userId: req.userDoc._id, 
        isDefault: true 
      });
      if (!targetCategory) {
        // Создаем дефолтную категорию, если её нет
        targetCategory = await Category.create({
          userId: req.userDoc._id,
          name: 'Мои подписки',
          hasReminders: true,
          color: '#3B82F6',
          isDefault: true,
          order: 0
        });
      }
    }

    let addedCount = 0;
    const errors = [];

    for (const [index, sub] of importedSubs.entries()) {
      try {
        const exists = await Subscription.findOne({
          userId: req.userDoc._id,
          name: sub.name,
          cost: sub.cost,
          categoryId: targetCategory._id
        });

        if (!exists && sub.name && sub.cost) {
          const normalizedSub = {
            userId: req.userDoc._id,
            categoryId: targetCategory._id,
            name: sub.name.trim(),
            cost: parseFloat(sub.cost),
            currency: sub.currency || 'RUB',
            cycle: sub.cycle || 'monthly'
          };

          // Добавляем поля даты только если категория поддерживает напоминания
          if (targetCategory.hasReminders) {
            normalizedSub.paymentDay = parseInt(sub.payment_day || sub.paymentDay);
            normalizedSub.fullPaymentDate = sub.next_payment_date || sub.fullPaymentDate || null;
          }

          validateSubscriptionData(normalizedSub, targetCategory.hasReminders);
          await Subscription.create(normalizedSub);
          addedCount++;
        }
      } catch (error) {
        errors.push(`Подписка ${index + 1}: ${error.message}`);
      }
    }

    const response = {
      success: true,
      message: `Импортировано ${addedCount} подписок в категорию "${targetCategory.name}"`,
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