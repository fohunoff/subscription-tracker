import { getCycleMeta } from '../../../shared/utils/cycle';

/**
 * Превращает запись лога (server/models/SubscriptionEvent.js) в человеческие
 * строки. Значения в логе хранятся нормализованными: даты — ISO-строками,
 * массивы — через запятую, ObjectId — строкой.
 */

const EVENT_TITLES = {
  created: 'Подписка создана',
  archived: 'Завершена и отправлена в архив',
  restored: 'Восстановлена из архива',
  deleted: 'Подписка удалена',
  updated: 'Изменения',
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
 * Событие целиком: заголовок, дата и расшифровка изменений.
 */
export const formatHistoryEvent = (event, context = {}) => ({
  id: event.id,
  type: event.type,
  title: getEventTitle(event),
  date: new Date(event.createdAt),
  changes: event.type === 'updated' ? describeChanges(event.changes, context) : [],
});
