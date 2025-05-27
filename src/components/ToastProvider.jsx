import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const leavingToasts = useRef({});

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      leavingToasts.current[id] = true;
      setToasts((prev) => [...prev]); // триггерим ререндер
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete leavingToasts.current[id];
      }, 450); // время анимации toastOut
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed z-50 bottom-8 right-8 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-animate${leavingToasts.current[toast.id] ? ' toast-leave' : ''} px-4 py-2 rounded shadow-lg text-white text-sm font-medium transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600'}`}
            style={{ pointerEvents: 'auto' }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
