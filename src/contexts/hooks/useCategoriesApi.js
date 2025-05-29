export function useCategoriesApi(API_URL, token) {
    // Получить все категории
    const getCategories = async () => {
      const response = await fetch(`${API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Ошибка получения категорий');
      }
      
      const data = await response.json();
      return data.categories;
    }

    // Создать категорию
    const createCategory = async (categoryData) => {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка создания категории');
      }
      
      const data = await response.json();
      return data.category;
    }

    // Обновить категорию
    const updateCategory = async (id, categoryData) => {
      const response = await fetch(`${API_URL}/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка обновления категории');
      }
      
      const data = await response.json();
      return data.category;
    };

    // Удалить категорию
    const deleteCategory = async (id) => {
      const response = await fetch(`${API_URL}/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка удаления категории');
      }
      
      return true;
    };

    // Изменить порядок категорий
    const reorderCategories = async (categoryIds) => {
      const response = await fetch(`${API_URL}/categories/reorder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ categoryIds })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка изменения порядка категорий');
      }
      
      return true;
    }

    return {
        getCategories,
        createCategory,
        updateCategory,
        deleteCategory,
        reorderCategories
    }
  };