export function useStatsApi(API_URL, token) {
    // Получить статистику
    const getStats = async () => {
      const response = await fetch(`${API_URL}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Ошибка получения статистики');
      }
      
      const data = await response.json();
      return data.stats;
    }

    return {
        getStats
    }
  };