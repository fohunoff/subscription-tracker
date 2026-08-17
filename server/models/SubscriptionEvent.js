import mongoose from 'mongoose';

/**
 * Лог изменений по подписке. Пишется при каждом значимом действии, чтобы
 * потом можно было показать историю («цена выросла с 299 до 399 в марте»)
 * и посчитать реально потраченное, а не текущую стоимость, умноженную на срок.
 *
 * Записи переживают удаление подписки: subscriptionId остаётся, но связанного
 * документа может уже не быть — поэтому здесь дублируется subscriptionName.
 */
const subscriptionEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  // Название на момент события — чтобы история читалась после удаления подписки
  subscriptionName: {
    type: String,
    required: true
  },
  /**
   * returned и restored — оба про возврат из архива, но это разные события:
   * returned — вернули до ближайшего платежа, подписка ничего не пропустила;
   * restored — вернули после него, то есть был перерыв в оплате.
   *
   * payment — состоявшееся списание (пока пишется только последнее, при
   * наступлении даты окончания), ended — срок действия истёк.
   */
  type: {
    type: String,
    required: true,
    enum: ['created', 'updated', 'archived', 'returned', 'restored', 'deleted', 'payment', 'ended']
  },
  /**
   * Что именно изменилось: { cost: { from: 299, to: 399 }, cycle: {...} }.
   * Для created/deleted пусто, для archived/restored может содержать endDate.
   */
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// История одной подписки в хронологическом порядке
subscriptionEventSchema.index({ userId: 1, subscriptionId: 1, createdAt: -1 });

const SubscriptionEvent = mongoose.model('SubscriptionEvent', subscriptionEventSchema);
export default SubscriptionEvent;
