import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

/**
 * Меню под аватаром — единственная точка входа в служебные разделы:
 * настройки и импорт/экспорт. Раньше настройки открывались отдельной кнопкой
 * в хедере, но до lg кнопки живут в липкой полосе, и каждая лишняя отъедала
 * ширину у заголовка — три круглые кнопки на 320px занимали треть строки.
 */
const UserMenu = ({ onOpenSettings, onOpenData }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  // Пункты меню закрывают выпадашку сами: окно открывается поверх неё,
  // и оставшееся раскрытым меню перекрывало бы угол окна
  const runAndClose = (action) => () => {
    setIsOpen(false);
    action?.();
  };

  // py-2.5 до sm — тап-цель в 44px: на телефоне пункты меню идут подряд,
  // и в плотном списке промахнуться легко
  const itemClass =
    'flex items-center w-full px-4 py-2.5 sm:py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors';

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Тёмные классы — как у соседних кнопок темы и настроек: в одной группе
          белая кнопка выбивалась из тёмного оформления */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 shadow-lg rounded-full py-2 px-3 border border-slate-200 dark:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-opacity-50"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <UserCircleIcon className="w-8 h-8 text-slate-600 dark:text-slate-300" />
        )}
        {/* <span className="hidden sm:block text-slate-700 font-medium max-w-32 truncate">
          {user.name}
        </span> */}
        <ChevronDownIcon 
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>

          <div className="py-1">
            <button onClick={runAndClose(onOpenSettings)} className={itemClass} type="button">
              <Cog6ToothIcon className="w-4 h-4 mr-3" />
              Настройки
            </button>
            <button onClick={runAndClose(onOpenData)} className={itemClass} type="button">
              <ArrowsUpDownIcon className="w-4 h-4 mr-3" />
              Импорт / экспорт
            </button>
          </div>

          <div className="py-1 border-t border-slate-200 dark:border-slate-700">
            <button onClick={handleLogout} className={itemClass} type="button">
              <ArrowRightOnRectangleIcon className="w-4 h-4 mr-3" />
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;