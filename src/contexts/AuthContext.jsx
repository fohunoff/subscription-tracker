import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('authToken'));

  // Проверка токена при загрузке
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      
      if (storedToken) {
        try {
          // Проверяем срок действия токена
          const decodedToken = jwtDecode(storedToken);
          
          if (decodedToken.exp * 1000 < Date.now()) {
            // Токен истек
            logout();
          } else {
            // Токен валиден, получаем данные пользователя
            await getCurrentUser(storedToken);
          }
        } catch (error) {
          console.error('Ошибка проверки токена:', error);
          logout();
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  const getCurrentUser = async (authToken) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
        setToken(authToken);
      } else {
        if (response.status === 401) {
          logout(); // Токен недействителен
        }
      }
    } catch (error) {
      console.error('Ошибка получения данных пользователя:', error);
      logout();
    }
  };

  const loginWithGoogle = async (googleToken) => {
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: googleToken })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const { token: authToken, user: userData } = data;
        
        // Сохраняем токен только в localStorage (для сессий)
        localStorage.setItem('authToken', authToken);
        setToken(authToken);
        setUser(userData);
        
        return userData;
      } else {
        throw new Error(data.message || 'Ошибка авторизации');
      }
    } catch (error) {
      console.error('Ошибка Google OAuth:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Уведомляем сервер о выходе
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    } finally {
      // Очищаем состояние
      localStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
    }
  };

  // API методы для работы с подписками
  const api = {
    // Получить все подписки
    getSubscriptions: async () => {
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
    },

    // Создать подписку
    createSubscription: async (subscriptionData) => {
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
    },

    // Обновить подписку
    updateSubscription: async (id, subscriptionData) => {
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
    },

    // Удалить подписку
    deleteSubscription: async (id) => {
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
    },

    // Импорт подписок
    importSubscriptions: async (subscriptions) => {
      const response = await fetch(`${API_URL}/subscriptions/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscriptions })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка импорта подписок');
      }
      
      const data = await response.json();
      return data;
    },

    // Получить статистику
    getStats: async () => {
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
  };

  const value = {
    user,
    token,
    loading,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    api
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};