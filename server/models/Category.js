import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
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
  hasReminders: {
    type: Boolean,
    default: true // По умолчанию с напоминаниями
  },
  color: {
    type: String,
    default: '#3B82F6' // Цвет для визуального оформления
  },
  isDefault: {
    type: Boolean,
    default: false // Отмечает дефолтную категорию "Мои подписки"
  },
  order: {
    type: Number,
    default: 0 // Для сортировки категорий
  }
}, {
  timestamps: true
});

// Индекс для быстрого поиска категорий пользователя
categorySchema.index({ userId: 1, order: 1 });

// Уникальность названия категории для пользователя
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);
export default Category;