import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const leavingToasts = useRef({});

  const removeToast = useCallback((id) => {
    leavingToasts.current[id] = true;
    setToasts((prev) => [...prev]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete leavingToasts.current[id];
    }, 450);
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type !== 'error') {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed z-50 bottom-8 right-8 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-animate${leavingToasts.current[toast.id] ? ' toast-leave' : ''} px-4 py-2 rounded shadow-lg text-white text-sm font-medium transition-all duration-300 flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600'}`}
            style={{ pointerEvents: 'auto' }}
          >
            <span className="flex-1">{toast.message}</span>
            {toast.type === 'error' && (
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 p-1 rounded hover:bg-red-700/40 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Закрыть уведомление"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
