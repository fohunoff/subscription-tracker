export function useSubscriptionsApi(API_URL, token) {
    const authHeaders = () => ({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Получить активные подписки
    const getSubscriptions = async () => {
      const response = await fetch(`${API_URL}/subscriptions`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error('Ошибка получения подписок');
      }

      const data = await response.json();
      return data.subscriptions;
    };

    // Получить подписки из архива
    const getArchivedSubscriptions = async () => {
      const response = await fetch(`${API_URL}/subscriptions?status=archived`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error('Ошибка получения архива подписок');
      }

      const data = await response.json();
      return data.subscriptions;
    };

    // Отправить подписку в архив («отписался»)
    const archiveSubscription = async (id, endDate = null) => {
      const response = await fetch(`${API_URL}/subscriptions/${id}/archive`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(endDate ? { endDate } : {})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка архивации подписки');
      }

      const data = await response.json();
      return data.subscription;
    };

    // Вернуть подписку из архива. Кроме самой подписки сервер сообщает, был ли
    // пропущен платёж: restoreType — 'returned' (вернули до платежа) или
    // 'restored' (вернули после, значит был перерыв).
    const restoreSubscription = async (id) => {
      const response = await fetch(`${API_URL}/subscriptions/${id}/restore`, {
        method: 'PATCH',
        headers: authHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка восстановления подписки');
      }

      const data = await response.json();
      return {
        subscription: data.subscription,
        restoreType: data.restoreType,
        missedPaymentDate: data.missedPaymentDate
      };
    };

    // История изменений подписки
    const getSubscriptionHistory = async (id) => {
      const response = await fetch(`${API_URL}/subscriptions/${id}/history`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        throw new Error('Ошибка получения истории подписки');
      }

      const data = await response.json();
      return data.events;
    };

    // Создать подписку
    const createSubscription = async (subscriptionData) => {
      const response = await fetch(`${API_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка создания подписки');
      }
      
      const data = await response.json();
      return data.subscription;
    };

    // Обновить подписку
    const updateSubscription = async (id, subscriptionData) => {
      const response = await fetch(`${API_URL}/subscriptions/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка обновления подписки');
      }
      
      const data = await response.json();
      return data.subscription;
    };

    // Удалить подписку
    const deleteSubscription = async (id) => {
      const response = await fetch(`${API_URL}/subscriptions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка удаления подписки');
      }
      
      return true;
    };

    // Импорт подписок
    const importSubscriptions = async (subscriptions, categoryId = null) => {
      const response = await fetch(`${API_URL}/subscriptions/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscriptions, categoryId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка импорта подписок');
      }
      
      const data = await response.json();
      return data;
    }

    return {
        getSubscriptions,
        getArchivedSubscriptions,
        archiveSubscription,
        restoreSubscription,
        getSubscriptionHistory,
        createSubscription,
        updateSubscription,
        deleteSubscription,
        importSubscriptions
    }
  };