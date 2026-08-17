import { useState, useCallback } from 'react';

export function useSubscriptions(api, showToast) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [archivedSubscriptions, setArchivedSubscriptions] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);

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
      const { subscription: updatedSubscription, recalculatedPayments } =
        await api.updateSubscription(id, updatedSubData);
      setSubscriptions(prev => prev.map(sub => sub.id === id ? updatedSubscription : sub));
      showToast && showToast(
        recalculatedPayments > 0
          ? `Изменения сохранены, история платежей пересобрана (${recalculatedPayments})`
          : 'Изменения сохранены',
        'success'
      );
    } catch (error) {
      console.error('Ошибка обновления подписки:', error);
      showToast && showToast(error.message || 'Ошибка обновления подписки', 'error');
    }
  }, [api, showToast]);

  const loadArchivedSubscriptions = useCallback(async () => {
    if (!api) return;
    setIsLoadingArchive(true);
    try {
      const archived = await api.getArchivedSubscriptions();
      setArchivedSubscriptions(archived);
    } catch (error) {
      console.error('Ошибка загрузки архива:', error);
      showToast && showToast('Ошибка загрузки архива', 'error');
    } finally {
      setIsLoadingArchive(false);
    }
  }, [api, showToast]);

  // Подписка уходит в архив со всеми настройками: категорией, уведомлениями,
  // датами — чтобы её можно было вернуть в прежнем виде.
  const archiveSubscription = useCallback(async (id) => {
    if (!api) return;
    try {
      const archived = await api.archiveSubscription(id);
      setSubscriptions(prev => prev.filter(sub => sub.id !== id));
      setArchivedSubscriptions(prev => [archived, ...prev]);
      showToast && showToast(`Подписка "${archived.name}" в архиве`, 'success');
    } catch (error) {
      console.error('Ошибка архивации подписки:', error);
      showToast && showToast(error.message || 'Ошибка архивации подписки', 'error');
    }
  }, [api, showToast]);

  // Возврат из архива бывает двух видов: до ближайшего платежа подписка ничего
  // не пропустила, после — был перерыв в оплате, и даты платежей сервер
  // намеренно не сдвигает. Во втором случае говорим об этом прямо, иначе
  // пользователь не заметит, что ближайший платёж считается по старому циклу.
  const restoreSubscription = useCallback(async (id) => {
    if (!api) return;
    try {
      const { subscription: restored, restoreType, missedPaymentDate } = await api.restoreSubscription(id);
      setArchivedSubscriptions(prev => prev.filter(sub => sub.id !== id));
      setSubscriptions(prev => [...prev, restored]);

      if (restoreType === 'restored') {
        const missed = missedPaymentDate
          ? new Date(missedPaymentDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
          : null;
        showToast && showToast(
          `Подписка "${restored.name}" восстановлена после перерыва` +
          (missed ? `: платёж от ${missed} был пропущен — проверьте дату платежа` : ''),
          'success'
        );
      } else {
        showToast && showToast(`Подписка "${restored.name}" возвращена из архива`, 'success');
      }
    } catch (error) {
      console.error('Ошибка восстановления подписки:', error);
      showToast && showToast(error.message || 'Ошибка восстановления подписки', 'error');
    }
  }, [api, showToast]);

  // Удаление из архива — окончательное, поэтому чистим оба списка
  const deleteArchivedSubscription = useCallback(async (id) => {
    if (!api) return;
    try {
      await api.deleteSubscription(id);
      setArchivedSubscriptions(prev => prev.filter(sub => sub.id !== id));
      showToast && showToast('Подписка удалена из архива', 'success');
    } catch (error) {
      console.error('Ошибка удаления подписки:', error);
      showToast && showToast(error.message || 'Ошибка удаления подписки', 'error');
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
    archivedSubscriptions,
    isLoadingData,
    isLoadingArchive,
    loadSubscriptions,
    loadArchivedSubscriptions,
    addSubscription,
    deleteSubscription,
    updateSubscription,
    archiveSubscription,
    restoreSubscription,
    deleteArchivedSubscription,
    importSubscriptions,
  };
}
