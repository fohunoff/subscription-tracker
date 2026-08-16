export function useSettingsApi(API_URL, token) {
  // Настройки отображения, которые нужны и серверу: базовую валюту он берёт
  // для /api/stats и сводок Telegram, поэтому одного localStorage мало.
  const updateSettings = async (settings) => {
    const response = await fetch(`${API_URL}/auth/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Ошибка обновления настроек');
    }

    return response.json();
  };

  const updateBaseCurrency = (baseCurrency) => updateSettings({ baseCurrency });

  return { updateSettings, updateBaseCurrency };
}
