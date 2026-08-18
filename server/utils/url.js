/**
 * Ссылка на сервис подписки. Хранится, чтобы карточка могла показать favicon
 * сервиса и вести на его сайт — иконок в трекере нет, а логотип узнаётся
 * быстрее названия.
 *
 * Нормализация нужна прежде всего для favicon: он запрашивается по хосту, а
 * пользователь пишет ссылку как придётся — «netflix.com», «www.netflix.com/ru».
 * Без схемы `new URL` не разбирает строку вовсе.
 */

const MAX_URL_LENGTH = 500;

/**
 * Приводит введённую ссылку к абсолютному http(s)-URL.
 *
 * @returns {string|null} нормализованный URL или null, если поле очищено.
 *   undefined на входе означает «поле не передавали» — вызывающий код должен
 *   отличать это от очистки и не трогать сохранённое значение.
 * @throws {Error} если строку нельзя разобрать как адрес сайта.
 */
export const normalizeSiteUrl = (raw) => {
  if (raw === undefined || raw === null) return null;

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new Error(`Ссылка слишком длинная (максимум ${MAX_URL_LENGTH} символов)`);
  }

  // Схему дописываем сами: «netflix.com» — самый частый способ ввода,
  // а без протокола такая строка разбирается как относительный путь.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Некорректная ссылка на сервис');
  }

  // Только http(s): javascript: и data: в href на клиенте — готовая XSS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Ссылка должна начинаться с http:// или https://');
  }

  // Хост без точки — это «localhost» или опечатка вроде «нетфликс»;
  // favicon по такому адресу всё равно не найдётся
  if (!parsed.hostname.includes('.')) {
    throw new Error('Некорректная ссылка на сервис');
  }

  return parsed.toString();
};
