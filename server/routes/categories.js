import { Router } from 'express';
import Category from '../models/Category.js';
import Subscription from '../models/Subscription.js';
import authenticateToken from '../middlewares/authenticateToken.js';

const router = Router();

// Получение всех категорий пользователя
router.get('/', authenticateToken, async (req, res) => {
  try {
    let categories = await Category.find({ userId: req.userDoc._id }).sort({ order: 1, createdAt: 1 });
    
    // Создаем дефолтную категорию "Мои подписки", если её нет
    if (categories.length === 0) {
      const defaultCategory = await Category.create({
        userId: req.userDoc._id,
        name: 'Мои подписки',
        hasReminders: true,
        color: '#3B82F6',
        isDefault: true,
        order: 0
      });
      categories = [defaultCategory];
    }

    const formattedCategories = categories.map(cat => ({
      id: cat._id.toString(),
      name: cat.name,
      hasReminders: cat.hasReminders,
      color: cat.color,
      isDefault: cat.isDefault,
      order: cat.order,
      sortBy: cat.sortBy || 'alphabetical',
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt
    }));

    res.json({ success: true, categories: formattedCategories });
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создание новой категории
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, hasReminders = true, color = '#3B82F6' } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Название категории обязательно' });
    }

    // Проверяем уникальность названия
    const existingCategory = await Category.findOne({
      userId: req.userDoc._id,
      name: name.trim()
    });

    if (existingCategory) {
      return res.status(400).json({ message: 'Категория с таким названием уже существует' });
    }

    // Получаем максимальный order для правильной сортировки
    const maxOrderCategory = await Category.findOne({ userId: req.userDoc._id }).sort({ order: -1 });
    const newOrder = maxOrderCategory ? maxOrderCategory.order + 1 : 1;

    const newCategory = await Category.create({
      userId: req.userDoc._id,
      name: name.trim(),
      hasReminders,
      color,
      order: newOrder
    });

    res.status(201).json({
      success: true,
      category: {
        id: newCategory._id.toString(),
        name: newCategory.name,
        hasReminders: newCategory.hasReminders,
        color: newCategory.color,
        isDefault: newCategory.isDefault,
        order: newCategory.order,
        sortBy: newCategory.sortBy || 'alphabetical',
        createdAt: newCategory.createdAt,
        updatedAt: newCategory.updatedAt
      },
      message: 'Категория создана успешно'
    });
  } catch (error) {
    console.error('Ошибка создания категории:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновление категории
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, hasReminders, color, sortBy } = req.body;

    const category = await Category.findOne({ _id: id, userId: req.userDoc._id });
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }

    // Нельзя изменить дефолтную категорию на категорию без напоминаний
    if (category.isDefault && hasReminders === false) {
      return res.status(400).json({ message: 'Нельзя отключить напоминания для основной категории' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Название не может быть пустым' });
      }
      
      // Проверяем уникальность нового названия
      const existingCategory = await Category.findOne({
        userId: req.userDoc._id,
        name: name.trim(),
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({ message: 'Категория с таким названием уже существует' });
      }

      updateData.name = name.trim();
    }

    if (hasReminders !== undefined) updateData.hasReminders = hasReminders;
    if (color !== undefined) updateData.color = color;
    if (sortBy !== undefined) {
      if (!['alphabetical', 'paymentDate'].includes(sortBy)) {
        return res.status(400).json({ message: 'Неверное значение sortBy' });
      }
      updateData.sortBy = sortBy;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      category: {
        id: updatedCategory._id.toString(),
        name: updatedCategory.name,
        hasReminders: updatedCategory.hasReminders,
        color: updatedCategory.color,
        isDefault: updatedCategory.isDefault,
        order: updatedCategory.order,
        sortBy: updatedCategory.sortBy || 'alphabetical',
        createdAt: updatedCategory.createdAt,
        updatedAt: updatedCategory.updatedAt
      },
      message: 'Категория обновлена успешно'
    });
  } catch (error) {
    console.error('Ошибка обновления категории:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Удаление категории
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findOne({ _id: id, userId: req.userDoc._id });
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }

    // Нельзя удалить дефолтную категорию
    if (category.isDefault) {
      return res.status(400).json({ message: 'Нельзя удалить основную категорию' });
    }

    // Проверяем, есть ли подписки в этой категории
    const subscriptionsCount = await Subscription.countDocuments({
      userId: req.userDoc._id,
      categoryId: id
    });

    if (subscriptionsCount > 0) {
      return res.status(400).json({ 
        message: `Нельзя удалить категорию, в которой есть подписки (${subscriptionsCount})` 
      });
    }

    await Category.findByIdAndDelete(id);

    res.json({ 
      success: true, 
      message: `Категория "${category.name}" удалена успешно` 
    });
  } catch (error) {
    console.error('Ошибка удаления категории:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Изменение порядка категорий
router.post('/reorder', authenticateToken, async (req, res) => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ message: 'Неверный формат данных' });
    }

    // Обновляем порядок категорий
    const updatePromises = categoryIds.map((categoryId, index) =>
      Category.findOneAndUpdate(
        { _id: categoryId, userId: req.userDoc._id },
        { order: index },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.json({ success: true, message: 'Порядок категорий обновлен' });
  } catch (error) {
    console.error('Ошибка изменения порядка категорий:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;