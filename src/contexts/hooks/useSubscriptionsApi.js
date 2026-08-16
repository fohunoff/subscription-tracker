export function useSubscriptionsApi(API_URL, token) {
    // Получить все подписки
    const getSubscriptions = async () => {
      const response = await fetch(`${API_URL}/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Ошибка получения подписок');
      }
      
      const data = await response.json();
      return data.subscriptions;
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
        createSubscription,
        updateSubscription,
        deleteSubscription,
        importSubscriptions
    }
  };