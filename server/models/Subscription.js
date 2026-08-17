import mongoose from 'mongoose';
import { CYCLE_VALUES } from '../utils/cycle.js';
import { CURRENCY_CODES, DEFAULT_BASE_CURRENCY } from '../utils/currency.js';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
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
    enum: CURRENCY_CODES,
    default: DEFAULT_BASE_CURRENCY
  },
  cycle: {
    type: String,
    required: true,
    enum: CYCLE_VALUES,
    default: 'monthly'
  },
  // Активная подписка участвует в суммах, статистике и уведомлениях;
  // архивная сохраняет все настройки, чтобы её можно было восстановить.
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true
  },
  // Дата, по которую подписка действует (последний день). Заполняется при
  // архивации, но может быть задана и заранее — тогда после её наступления
  // платежей больше нет, а подписка выпадает из сумм и уведомлений.
  endDate: {
    type: Date
  },
  // Отправлять ли подписку в архив, когда срок действия истёк. По умолчанию да:
  // закончившаяся подписка чаще всего больше не нужна в списке. Если выключить,
  // она останется на виду с пометкой «срок истёк» — например, чтобы продлить.
  archiveOnEnd: {
    type: Boolean,
    default: true
  },
  // Когда сервер обработал наступление даты окончания: записал последний платёж
  // в историю и, если нужно, архивировал. Держит обработку идемпотентной —
  // планировщик ходит по подпискам регулярно. Сбрасывается при переносе endDate.
  endHandledAt: {
    type: Date
  },
  archivedAt: {
    type: Date
  },
  paymentDay: {
    type: Number,
    min: 1,
    max: 31
  },
  fullPaymentDate: {
    type: Date
  },
  // Настройки уведомлений
  notificationsEnabled: {
    type: Boolean,
    default: false
  },
  notifyDaysBefore: {
    type: [Number],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(num => [1, 3, 7].includes(num));
      },
      message: 'Допустимые значения: 1, 3, 7 дней'
    }
  },
  lastNotificationSent: {
    type: Date
  }
}, {
  timestamps: true
});

subscriptionSchema.index({ userId: 1, categoryId: 1, createdAt: -1 });
// Основная выборка — активные подписки пользователя
subscriptionSchema.index({ userId: 1, status: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;