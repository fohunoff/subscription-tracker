import React from 'react';
import { Modal } from '../../shared';
import { formatDate } from '../../shared/utils';
import TelegramConnection from './TelegramConnection';

const SettingsModal = ({
  isOpen,
  onClose,
  currencyRates,
  isRatesLoading,
  fetchRates,
  lastRatesUpdate,
  baseCurrency,
  setBaseCurrency,
  theme,
  setTheme
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Настройки"
  >
    <div className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-slate-700 mb-2">Курсы валют</span>
        <button
          onClick={fetchRates}
          disabled={isRatesLoading}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 disabled:opacity-50"
        >
          {isRatesLoading ? 'Обновление...' : 'Обновить курсы'}
        </button>
        <div className="mt-2 text-xs text-slate-500">
          Текущий курс: 1 USD = {(1 / currencyRates.USD).toFixed(2)} RUB, 1 EUR = {(1 / currencyRates.EUR).toFixed(2)} RUB
        </div>
        {lastRatesUpdate && (
          <div className="mt-1 text-xs text-slate-400">
            Последнее обновление: {formatDate(lastRatesUpdate)}
          </div>
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
      </div>
    </div>
  </Modal>
);

export default SettingsModal;
