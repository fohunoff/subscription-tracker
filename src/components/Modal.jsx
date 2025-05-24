import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/solid';

const Modal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden'; // Предотвращаем прокрутку фона
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = 'unset';
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
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 overflow-hidden transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow"
        onClick={(e) => e.stopPropagation()} // Предотвращаем закрытие по клику внутри модалки
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 id="modal-title" className="text-xl font-semibold text-slate-700">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Закрыть модальное окно"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="p-5 md:p-6">
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