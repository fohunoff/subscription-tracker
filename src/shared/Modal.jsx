import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useBodyScrollLock } from './hooks';

const Modal = ({ isOpen, onClose, title, children }) => {
  // Прокрутка фона блокируется с компенсацией ширины скроллбара — иначе
  // страница подпрыгивает вбок при открытии и закрытии окна
  useBodyScrollLock(isOpen);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Закрытие по клику на оверлей
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Высота ограничена экраном, содержимое прокручивается: без этого
          длинная форма уходила за края и добраться до кнопок было нельзя.
          На мобильных потолок считается в dvh: в vh не входит панель адреса
          Safari, и низ формы вместе с кнопкой отправки уезжал под неё */}
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-3 sm:m-4 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow"
        onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие по клику внутри модалки
      >
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-200 flex-shrink-0">
          <h2 id="modal-title" className="text-lg sm:text-xl font-semibold text-slate-700">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -m-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors flex-shrink-0"
            aria-label="Закрыть модальное окно"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-4 sm:p-5 md:p-6 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

// Добавим анимацию в tailwind.config.js или в index.css
// Для простоты добавим прямо в index.css (или где у вас @tailwind directives)

export default Modal;