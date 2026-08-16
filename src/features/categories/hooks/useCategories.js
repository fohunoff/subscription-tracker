import { useState, useCallback } from 'react';

export function useCategories(api, showToast) {
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!api) return;
    setIsLoadingCategories(true);
    try {
      const userCategories = await api.getCategories();
      setCategories(userCategories);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
      showToast && showToast('Ошибка загрузки категорий', 'error');
    } finally {
      setIsLoadingCategories(false);
    }
  }, [api, showToast]);

  const addCategory = useCallback(async (newCategory) => {
    if (!api) return;
    try {
      const createdCategory = await api.createCategory(newCategory);
      setCategories(prev => [...prev, createdCategory]);
      showToast && showToast('Категория добавлена!', 'success');
      return createdCategory;
    } catch (error) {
      console.error('Ошибка добавления категории:', error);
      showToast && showToast(error.message || 'Ошибка добавления категории', 'error');
      throw error;
    }
  }, [api, showToast]);

  const updateCategory = useCallback(async (id, updatedCategoryData) => {
    if (!api) return;
    try {
      const updatedCategory = await api.updateCategory(id, updatedCategoryData);
      setCategories(prev => prev.map(cat => cat.id === id ? updatedCategory : cat));
      showToast && showToast('Категория обновлена', 'success');
      return updatedCategory;
    } catch (error) {
      console.error('Ошибка обновления категории:', error);
      showToast && showToast(error.message || 'Ошибка обновления категории', 'error');
      throw error;
    }
  }, [api, showToast]);

  const deleteCategory = useCallback(async (idToDelete) => {
    if (!api) return;
    try {
      await api.deleteCategory(idToDelete);
      setCategories(prev => prev.filter(cat => cat.id !== idToDelete));
      showToast && showToast('Категория удалена', 'success');
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
      showToast && showToast(error.message || 'Ошибка удаления категории', 'error');
      throw error;
    }
  }, [api, showToast]);

  const reorderCategories = useCallback(async (categoryIds) => {
    if (!api) return;
    try {
      await api.reorderCategories(categoryIds);
      // Обновляем локальный порядок
      const reorderedCategories = categoryIds.map(id => 
        categories.find(cat => cat.id === id)
      ).filter(Boolean);
      setCategories(reorderedCategories);
      showToast && showToast('Порядок категорий обновлен', 'success');
    } catch (error) {
      console.error('Ошибка изменения порядка категорий:', error);
      showToast && showToast(error.message || 'Ошибка изменения порядка', 'error');
    }
  }, [api, showToast, categories]);

  return {
    categories,
    setCategories,
    isLoadingCategories,
    loadCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}