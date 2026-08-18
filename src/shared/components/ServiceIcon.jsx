import React, { useState } from 'react';
import { getFaviconUrl, FAVICON_PLACEHOLDER_WIDTH } from '../utils/site';

const SIZES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-lg',
};

/**
 * Иконка сервиса: favicon по сохранённой ссылке, а без неё — первая буква
 * названия в цвете категории.
 *
 * Буква — не запасной вариант «на всякий случай», а основной для половины
 * списка: ссылка необязательна, и у коммуналки её обычно нет. Поэтому она
 * рисуется по тем же размерам, что и картинка, — строка карточки не скачет
 * от того, есть у подписки сайт или нет.
 *
 * На букву переходим и тогда, когда сервис иконок отдал свой серый глобус:
 * одинаковая заглушка у всех неизвестных сервисов различает подписки хуже,
 * чем буква в цвете категории. Опознаётся она по размеру — см. site.js.
 */
function ServiceIcon({ url, name = '', color, size = 'md', className = '' }) {
  const src = getFaviconUrl(url);
  // Держим не булев флаг, а сам адрес: ссылку у подписки могли поправить,
  // и новую картинку нужно попробовать заново
  const [rejectedSrc, setRejectedSrc] = useState(null);

  const boxClass = `${SIZES[size] || SIZES.md} flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden ${className}`;

  if (src && rejectedSrc !== src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= FAVICON_PLACEHOLDER_WIDTH) {
            setRejectedSrc(src);
          }
        }}
        onError={() => setRejectedSrc(src)}
        className={`${boxClass} bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 object-contain p-1`}
      />
    );
  }

  const letter = name.trim().charAt(0).toUpperCase() || '•';

  return (
    <span
      aria-hidden="true"
      className={`${boxClass} font-semibold text-white`}
      style={{ backgroundColor: color || '#94a3b8' }}
    >
      {letter}
    </span>
  );
}

export default ServiceIcon;
