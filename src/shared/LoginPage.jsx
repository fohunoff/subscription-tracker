import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import GoogleLoginButton from './GoogleLoginButton';

const LoginPage = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
          <span className="text-lg text-slate-600 dark:text-slate-300">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Иконка приложения */}
          <div className="mx-auto flex justify-center mb-6">
            <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="15" width="70" height="70" rx="8" fill="#3B82F6"/>
              <rect x="15" y="15" width="70" height="20" rx="8" ry="8" fill="#1D4ED8"/>
              <circle cx="30" cy="25" r="3" fill="white"/>
              <circle cx="40" cy="25" r="3" fill="white"/>
              <circle cx="50" cy="25" r="3" fill="white"/>
              <rect x="30" y="45" width="40" height="30" rx="4" fill="#FFFF00"/>
              <circle cx="50" cy="60" r="8" fill="#FFFFFF"/>
              <path d="M46 60 L50 64 L56 58" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Трекер расходов
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            Войдите в систему, чтобы управлять своими подписками
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 py-8 px-6 shadow-xl rounded-xl">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-6">
              Вход в приложение
            </h2>
            
            <div className="flex justify-center">
              <GoogleLoginButton />
            </div>
            
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              Войдите через Google, чтобы синхронизировать свои данные между устройствами
            </p>
          </div>
        </div>
        
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} Трекер Подписок. Разработано с React + Vite.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;