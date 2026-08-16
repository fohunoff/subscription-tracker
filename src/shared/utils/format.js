// Форматирование дат и валют

export function formatDate(date, locale = 'ru-RU', opts = {}) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', ...opts });
}

export function formatCurrency(amount, currency = 'RUB', locale = 'ru-RU') {
  if (typeof amount !== 'number') return '';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
