export function useStatsApi(API_URL, token) {
    const authHeaders = () => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Получить статистику
    const getStats = async () => {
      const response = await fetch(`${API_URL}/stats`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error('Ошибка получения статистики');
      }

      const data = await response.json();
      return data.stats;
    }

    // Сколько уже потрачено: суммы по месяцам из лога платежей.
    // Период задаётся датами; без них сервер отдаёт последние 12 месяцев.
    // all=1 — «за всё время»: нижнюю границу сервер берёт по первому платежу
    // в логе, поэтому from в этом режиме не нужен и игнорируется.
    const getSpending = async ({ from, to, all } = {}) => {
      const params = new URLSearchParams();
      if (all) params.set('all', '1');
      else if (from) params.set('from', from);
      if (to) params.set('to', to);

      const query = params.toString();
      const response = await fetch(`${API_URL}/stats/spending${query ? `?${query}` : ''}`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error('Ошибка получения статистики трат');
      }

      const data = await response.json();
      return data.spending;
    }

    return {
        getStats,
        getSpending
    }
  };
