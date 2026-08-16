import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CURRENCY } from '../../../shared/utils/currency';

const STORAGE_KEY = 'baseCurrency';

/**
 * Базовая валюта — та, в которой показываются итоги.
 *
 * Хранится на сервере (User.baseCurrency), потому что в ней же считаются
 * /api/stats и сводки Telegram. localStorage остаётся кэшем: первый рендер
 * не должен мигать рублями, пока /auth/me не ответил.
 *
 * Пользователи, выбравшие валюту до появления поля, ничего не теряют: если
 * на сервере пусто, локальный выбор уезжает туда сам — разово, при загрузке.
 */
export function useBaseCurrency({ api, user, updateUser, showToast }) {
  const [baseCurrency, setBaseCurrencyState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY
  );

  // Методы api и колбэки пересоздаются на каждом рендере AuthContext,
  // поэтому держим их в ref — иначе эффект ниже срабатывал бы бесконечно.
  const apiRef = useRef(api);
  const updateUserRef = useRef(updateUser);
  const showToastRef = useRef(showToast);
  apiRef.current = api;
  updateUserRef.current = updateUser;
  showToastRef.current = showToast;

  const userId = user?.id;
  const serverCurrency = user?.baseCurrency;

  useEffect(() => {
    if (!userId) return;

    if (serverCurrency) {
      setBaseCurrencyState(serverCurrency);
      localStorage.setItem(STORAGE_KEY, serverCurrency);
      return;
    }

    // На сервере настройки ещё нет — поднимаем туда то, что выбрано в браузере.
    const localCurrency = localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY;
    apiRef.current?.updateBaseCurrency?.(localCurrency)
      .then(() => updateUserRef.current?.({ baseCurrency: localCurrency }))
      .catch(error => console.error('Не удалось перенести базовую валюту на сервер:', error));
  }, [userId, serverCurrency]);

  const setBaseCurrency = useCallback((currency) => {
    setBaseCurrencyState(currency);
    localStorage.setItem(STORAGE_KEY, currency);
    updateUserRef.current?.({ baseCurrency: currency });

    // Выбор применяется сразу, не дожидаясь сервера: не сохранилось — валюта
    // всё равно работает в этом браузере, но Telegram будет считать в старой.
    apiRef.current?.updateBaseCurrency?.(currency).catch(error => {
      console.error('Ошибка сохранения базовой валюты:', error);
      showToastRef.current?.('Не удалось сохранить валюту на сервере', 'error');
    });
  }, []);

  return [baseCurrency, setBaseCurrency];
}
