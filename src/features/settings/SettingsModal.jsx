import React, { useState, useEffect } from 'react';
import { Modal } from '../../shared';
import { formatDate } from '../../shared/utils';
import TelegramConnection from './TelegramConnection';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../notifications';

const SettingsModal = ({
  isOpen,
  onClose,
  currencyRates,
  isRatesLoading,
  lastRatesUpdate,
  baseCurrency,
  setBaseCurrency,
  theme,
  setTheme
}) => {
  const { api, user } = useAuth();
  const { showToast } = useToast();
  const [notificationTime, setNotificationTime] = useState('10:00');
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);

  // Загружаем время уведомлений при открытии
  useEffect(() => {
    if (user?.notificationTime) {
      setNotificationTime(user.notificationTime);
    }
  }, [user]);

  const handleTimeChange = async (e) => {
    const newTime = e.target.value;
    setNotificationTime(newTime);

    if (!api) return;

    setIsUpdatingTime(true);
    try {
      await api.updateNotificationTime(newTime);
      showToast('Время уведомлений обновлено', 'success');
    } catch (error) {
      console.error('Ошибка обновления времени:', error);
      showToast(error.message || 'Ошибка обновления времени', 'error');
    } finally {
      setIsUpdatingTime(false);
    }
  };

  return (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Настройки"
  >
    <div className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Курсы валют</span>
        {isRatesLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Загрузка курсов...</div>
        ) : (
          <>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <div>1 USD = {currencyRates.USD?.toFixed(2)} ₽</div>
              <div>1 EUR = {currencyRates.EUR?.toFixed(2)} ₽</div>
              <div>1 RSD = {currencyRates.RSD?.toFixed(4)} ₽</div>
            </div>
            {lastRatesUpdate && (
              <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Последнее обновление: {formatDate(lastRatesUpdate)}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Курсы обновляются автоматически каждый час
            </div>
          </>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Базовая валюта для расчёта</label>
        <select
          value={baseCurrency}
          onChange={e => setBaseCurrency(e.target.value)}
          className="block w-full max-w-xs rounded-lg border-slate-300 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90"
        >
          <option value="RUB">RUB (₽)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="RSD">RSD (дин.)</option>
        </select>
        <div className="mt-1 text-xs text-slate-400">Итоговая сумма будет показана в выбранной валюте</div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Тема оформления</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`py-2 px-4 rounded-lg font-medium border transition-colors ${theme === 'light' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'}`}
            aria-pressed={theme === 'light'}
          >
            Светлая
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`py-2 px-4 rounded-lg font-medium border transition-colors ${theme === 'dark' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'}`}
            aria-pressed={theme === 'dark'}
          >
            Тёмная
          </button>
        </div>
        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">Выберите внешний вид приложения</div>
      </div>

      {/* Telegram уведомления */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <TelegramConnection />

        {/* Время уведомлений */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <label htmlFor="notificationTime" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            Время отправки уведомлений
          </label>
          <input
            type="time"
            id="notificationTime"
            value={notificationTime}
            onChange={handleTimeChange}
            disabled={isUpdatingTime}
            className="block w-full max-w-xs rounded-lg border-slate-300 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90 disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Уведомления будут отправляться в указанное время (по вашему часовому поясу)
          </p>
        </div>
      </div>
    </div>
  </Modal>
  );
};

export default SettingsModal;
