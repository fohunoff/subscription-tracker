export function useTelegramApi(API_URL, token) {
  // Получить статус подключения Telegram
  const getTelegramStatus = async () => {
    const response = await fetch(`${API_URL}/telegram/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Ошибка получения статуса Telegram');
    }

    const data = await response.json();
    return data;
  };

  // Сгенерировать токен для подключения
  const generateTelegramToken = async () => {
    const response = await fetch(`${API_URL}/telegram/generate-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Ошибка генерации токена');
    }

    const data = await response.json();
    return data;
  };

  // Отключить Telegram
  const disconnectTelegram = async () => {
    const response = await fetch(`${API_URL}/telegram/disconnect`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Ошибка отключения Telegram');
    }

    return true;
  };

  // Обновить время уведомлений
  const updateNotificationTime = async (notificationTime) => {
    const response = await fetch(`${API_URL}/auth/notification-settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notificationTime })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Ошибка обновления времени уведомлений');
    }

    const data = await response.json();
    return data;
  };

  return {
    getTelegramStatus,
    generateTelegramToken,
    disconnectTelegram,
    updateNotificationTime
  };
}
