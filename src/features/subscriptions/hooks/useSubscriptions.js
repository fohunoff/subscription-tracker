import { useState, useCallback } from 'react';

export function useSubscriptions(api, showToast) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    if (!api) return;
    setIsLoadingData(true);
    try {
      const userSubscriptions = await api.getSubscriptions();
      setSubscriptions(userSubscriptions);
    } catch (error) {
      console.error('Ошибка загрузки подписок:', error);
      showToast && showToast('Ошибка загрузки подписок', 'error');
    } finally {
      setIsLoadingData(false);
    }
  }, [api, showToast]);

  const addSubscription = useCallback(async (newSub) => {
    if (!api) return;
    try {
      const createdSubscription = await api.createSubscription(newSub);
      setSubscriptions(prev => [...prev, createdSubscription]);
      showToast && showToast('Подписка добавлена!', 'success');
    } catch (error) {
      console.error('Ошибка добавления подписки:', error);
      showToast && showToast(error.message || 'Ошибка добавления подписки', 'error');
    }
  }, [api, showToast]);

  const deleteSubscription = useCallback(async (idToDelete) => {
    if (!api) return;
    try {
      await api.deleteSubscription(idToDelete);
      setSubscriptions(prev => prev.filter(sub => sub.id !== idToDelete));
      showToast && showToast('Подписка удалена', 'success');
    } catch (error) {
      console.error('Ошибка удаления подписки:', error);
      showToast && showToast(error.message || 'Ошибка удаления подписки', 'error');
    }
  }, [api, showToast]);

  const updateSubscription = useCallback(async (id, updatedSubData) => {
    if (!api) return;
    try {
      const updatedSubscription = await api.updateSubscription(id, updatedSubData);
      setSubscriptions(prev => prev.map(sub => sub.id === id ? updatedSubscription : sub));
      showToast && showToast('Изменения сохранены', 'success');
    } catch (error) {
      console.error('Ошибка обновления подписки:', error);
      showToast && showToast(error.message || 'Ошибка обновления подписки', 'error');
    }
  }, [api, showToast]);

  const importSubscriptions = useCallback(async (importedSubs) => {
    if (!api) return;
    try {
      const result = await api.importSubscriptions(importedSubs);
      await loadSubscriptions();
      showToast && showToast(`Импортировано ${result.addedCount} подписок!`, 'success');
    } catch (error) {
      console.error('Ошибка импорта подписок:', error);
      showToast && showToast(error.message || 'Ошибка импорта подписок', 'error');
    }
  }, [api, showToast, loadSubscriptions]);

  return {
    subscriptions,
    setSubscriptions,
    isLoadingData,
    loadSubscriptions,
    addSubscription,
    deleteSubscription,
    updateSubscription,
    importSubscriptions,
  };
}
