import { getCycleMeta } from '../../../shared/utils/cycle';
import { formatCurrency } from '../../../shared/utils';

/**
 * Превращает запись лога (server/models/SubscriptionEvent.js) в человеческие
 * строки. Значения в логе хранятся нормализованными: даты — ISO-строками,
 * массивы — через запятую, ObjectId — строкой.
 */

const EVENT_TITLES = {
  created: 'Подписка создана',
  archived: 'Завершена и отправлена в архив',
  // returned и restored — разные события: первое означает возврат до
  // ближайшего платежа (перерыва не было), второе — после него.
  // У записей, сделанных до этого разделения, тип всегда restored.
  returned: 'Возвращена из архива',
  restored: 'Восстановлена после перерыва',
  deleted: 'Подписка удалена',
  updated: 'Изменения',
  payment: 'Платёж',
  ended: 'Срок действия истёк',
};

const FIELD_LABELS = {
  name: 'Название',
  cost: 'Цена',
  currency: 'Валюта',
  cycle: 'Цикл оплаты',
  categoryId: 'Категория',
  paymentDay: 'День оплаты',
  fullPaymentDate: 'Дата платежа',
  endDate: 'Дата окончания',
  notificationsEnabled: 'Уведомления',
  notifyDaysBefore: 'Напоминания',
};

const formatDay = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatValue = (field, value, { categories = [] } = {}) => {
  if (value === null || value === undefined || value === '') return '—';

  switch (field) {
    case 'cycle':
      return getCycleMeta(value).label;
    case 'categoryId': {
      const category = categories.find(cat => cat.id === value || cat._id === value);
      // Категорию могли переименовать или удалить — тогда показываем, что она менялась,
      // но без выдумывания названия.
      return category?.name || 'другая категория';
    }
    case 'fullPaymentDate':
    case 'endDate':
      return formatDay(value);
    case 'notificationsEnabled':
      return value === true || value === 'true' ? 'включены' : 'выключены';
    case 'notifyDaysBefore':
      return value ? `за ${String(value).split(',').join(', ')} дн.` : 'нет';
    default:
      return String(value);
  }
};

/**
 * Возвращает список строк вида «Цена: 799 → 999» для одного события.
 */
export const describeChanges = (changes = {}, context = {}) =>
  Object.entries(changes).map(([field, change]) => {
    const label = FIELD_LABELS[field] || field;
    const from = formatValue(field, change?.from, context);
    const to = formatValue(field, change?.to, context);
    return { field, label, from, to };
  });

export const getEventTitle = (event) => EVENT_TITLES[event.type] || event.type;

/**
 * Пояснения к смене статуса. Формат «было → стало» тут не годится: у архивации
 * и возврата важна не пара значений, а сам факт — с какой даты подписка
 * завершена и был ли пропущен платёж.
 */
export const describeStatusEvent = (event) => {
  const { endDate, missedPaymentDate, amount, currency, paidAt, isLast, archived, estimated } = event.changes || {};
  const details = [];

  switch (event.type) {
    case 'payment':
      details.push(
        [typeof amount === 'number' ? formatCurrency(amount, currency) : null, formatDay(paidAt)]
          .filter(Boolean)
          .join(' — ')
      );
      if (isLast) details.push('Последний платёж по подписке');
      // Восстановлено бэкфиллом по логу изменений, а не наблюдалось приложением
      if (estimated) details.push('Оценка по истории изменений');
      break;
    case 'ended':
      if (endDate?.to) details.push(`Дата окончания: ${formatDay(endDate.to)}`);
      details.push(archived ? 'Отправлена в архив' : 'Осталась в списке с истёкшим сроком');
      break;
    case 'archived':
      if (endDate?.to) details.push(`Дата окончания: ${formatDay(endDate.to)}`);
      break;
    case 'returned':
      details.push('Вернули до ближайшего платежа — перерыва в оплате не было');
      if (endDate?.from) details.push(`Была завершена ${formatDay(endDate.from)}`);
      break;
    case 'restored':
      if (missedPaymentDate?.to) {
        details.push(`Платёж от ${formatDay(missedPaymentDate.to)} был пропущен`);
      }
      if (endDate?.from) details.push(`Была завершена ${formatDay(endDate.from)}`);
      break;
    default:
      break;
  }

  return details;
};

/**
 * Событие целиком: заголовок, дата и расшифровка изменений.
 */
export const formatHistoryEvent = (event, context = {}) => ({
  id: event.id,
  type: event.type,
  title: getEventTitle(event),
  date: new Date(event.createdAt),
  changes: event.type === 'updated' ? describeChanges(event.changes, context) : [],
  details: event.type === 'updated' ? [] : describeStatusEvent(event),
});
