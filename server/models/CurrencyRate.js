import mongoose from 'mongoose';

const currencyRateSchema = new mongoose.Schema({
  rates: {
    type: Map,
    of: Number,
    required: true
  },
  baseCurrency: {
    type: String,
    required: true,
    default: 'RUB'
  },
  source: {
    type: String,
    default: 'exchangerate-api.com'
  },
  fetchedAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Индекс для быстрого получения последнего курса
currencyRateSchema.index({ fetchedAt: -1 });

const CurrencyRate = mongoose.model('CurrencyRate', currencyRateSchema);
export default CurrencyRate;
