import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../notifications';

const TelegramConnection = () => {
  const { api } = useAuth();
  const { showToast } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState(null);
  const [connectedAt, setConnectedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [botLink, setBotLink] = useState(null);

  // Загрузка статуса при монтировании
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    if (!api) return;

    setIsLoading(true);
    try {
      const status = await api.getTelegramStatus();
      setIsConnected(status.connected);
      setTelegramUsername(status.telegramUsername);
      setConnectedAt(status.connectedAt);
    } catch (error) {
      console.error('Ошибка загрузки статуса Telegram:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!api) return;

    setIsGenerating(true);
    try {
      const data = await api.generateTelegramToken();
      setBotLink(data.botLink);
      showToast('Ссылка для подключения сгенерирована', 'success');
    } catch (error) {
      console.error('Ошибка генерации токена:', error);
      showToast(error.message || 'Ошибка генерации ссылки', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDisconnect = async () => {
    if (!api) return;

    if (!window.confirm('Вы уверены, что хотите отключить Telegram уведомления?')) {
      return;
    }

    try {
      await api.disconnectTelegram();
      setIsConnected(false);
      setTelegramUsername(null);
      setConnectedAt(null);
      setBotLink(null);
      showToast('Telegram отключен', 'success');
    } catch (error) {
      console.error('Ошибка отключения Telegram:', error);
      showToast(error.message || 'Ошибка отключения Telegram', 'error');
    }
  };

  const copyToClipboard = () => {
    if (botLink) {
      navigator.clipboard.writeText(botLink);
      showToast('Ссылка скопирована в буфер обмена', 'success');
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
        Уведомления в Telegram
      </label>

      {isConnected ? (
        <div className="space-y-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  ✅ Telegram подключен
                </p>
                {telegramUsername && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                    @{telegramUsername}
                  </p>
                )}
                {connectedAt && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    Подключено: {new Date(connectedAt).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
          >
            Отключить Telegram
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Подключите Telegram бота для получения уведомлений о предстоящих платежах.
          </p>

          {botLink ? (
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-sky-900 dark:text-sky-100">
                Шаг 1: Откройте ссылку в Telegram
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={botLink}
                  readOnly
                  className="flex-1 text-sm bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 rounded px-3 py-2 text-slate-700 dark:text-slate-300"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded font-medium"
                >
                  Копировать
                </button>
              </div>
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-lg font-medium"
              >
                Открыть в Telegram
              </a>
              <p className="text-xs text-sky-700 dark:text-sky-300 mt-2">
                Шаг 2: Нажмите кнопку "Start" в боте
              </p>
              <p className="text-xs text-sky-600 dark:text-sky-400">
                Ссылка действительна 15 минут
              </p>
              <button
                onClick={loadStatus}
                className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium"
              >
                Проверить статус подключения
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
            >
              {isGenerating ? 'Генерация...' : 'Подключить Telegram'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TelegramConnection;
