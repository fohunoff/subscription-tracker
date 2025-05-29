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
  }
}, {
  timestamps: true
});

subscriptionSchema.index({ userId: 1, categoryId: 1, createdAt: -1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;