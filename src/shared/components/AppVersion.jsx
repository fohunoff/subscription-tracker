import React from 'react';
import { APP_VERSION, APP_COMMIT, APP_BUILD_DATE } from '../config';

/**
 * Строка сборки в подвале: версия, короткий хеш коммита и дата сборки.
 *
 * Нужна ровно для одного — понять по скриншоту бага, какая сборка на экране.
 * Хеш здесь важнее версии: version в package.json поднимается редко, а деплой
 * случается каждый раз, поэтому именно по хешу воспроизводится состояние кода.
 * В title лежит полное время сборки — по нему видно, не отстала ли статика.
 */
function AppVersion() {
  const buildDate = APP_BUILD_DATE ? new Date(APP_BUILD_DATE) : null;
  const isValidDate = buildDate && !isNaN(buildDate.getTime());

  return (
    <p
      className="mt-1 text-xs text-slate-400 dark:text-slate-500"
      title={isValidDate ? `Сборка от ${buildDate.toLocaleString('ru-RU')}` : undefined}
    >
      v{APP_VERSION}
      {APP_COMMIT !== 'unknown' && (
        <>
          {' · '}
          <span className="font-mono">{APP_COMMIT}</span>
        </>
      )}
      {isValidDate && ` · ${buildDate.toLocaleDateString('ru-RU')}`}
    </p>
  );
}

export default AppVersion;
