import mongoose from 'mongoose';

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

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;