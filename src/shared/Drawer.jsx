import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useBodyScrollLock } from './hooks';

/**
 * Боковая панель, выезжающая справа.
 *
 * Для деталей подписки окно по центру не годится: с автозаписью платежей
 * история разрастается до десятков записей, и центрированное окно упиралось
 * в края экрана без возможности прокрутки. У панели фиксированная высота
 * экрана, заголовок и действия закреплены, а прокручивается только содержимое.
 */
const Drawer = ({ isOpen, onClose, title, children, footer }) => {
  // Прокрутка фона блокируется с компенсацией ширины скроллбара — иначе
  // страница подпрыгивает вбок при открытии и закрытии панели
  useBodyScrollLock(isOpen);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 opacity-0 animate-overlayShow"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        className="absolute inset-y-0 right-0 w-full sm:max-w-lg lg:max-w-2xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-drawerShow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h2 id="drawer-title" className="text-xl font-semibold text-slate-700 dark:text-slate-200 truncate" title={title}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex-shrink-0"
            aria-label="Закрыть панель"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Прокручивается только эта часть — заголовок и действия остаются на виду */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 md:p-6">
          {children}
        </div>

        {footer && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

export default Drawer;
