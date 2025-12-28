import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

import { useCategoriesApi, useStatsApi, useSubscriptionsApi, useTelegramApi } from './hooks';

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

  const categoriesApi = useCategoriesApi(API_URL, token);
  const subscriptionsApi = useSubscriptionsApi(API_URL, token);
  const statsApi = useStatsApi(API_URL, token);
  const telegramApi = useTelegramApi(API_URL, token);

  const api = {
    ...categoriesApi, // API методы для работы с категориями
    ...subscriptionsApi, // API методы для работы с подписками
    ...statsApi, // API методы для статистики
    ...telegramApi, // API методы для Telegram
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