import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  duration: number;
}

interface ToastContextType {
  showToast: (
    type: ToastType,
    title: string,
    message?: string,
    action?: ToastAction,
  ) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'border-green-500 text-green-400',
  error:   'border-red-500 text-red-400',
  warning: 'border-yellow-500 text-yellow-400',
  info:    'border-blue-500 text-blue-400',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    action?: ToastAction,
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    // Toasts with an undo action stay longer (5.5 s) so users have time to react
    const duration = action ? 5_500 : 4_000;
    setToasts(prev => [...prev, { id, type, title, message, action, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => {
          const Icon = ICONS[toast.type];
          const colorClass = COLORS[toast.type];
          return (
            <div
              key={toast.id}
              className={`toast-enter pointer-events-auto flex items-start gap-3 bg-[#1e1e1e] border-l-4 rounded-lg px-4 py-3 shadow-2xl min-w-[300px] max-w-[400px] ${colorClass}`}
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#f5f5f5] text-sm">{toast.title}</p>
                {toast.message && (
                  <p className="text-[#a0a0a0] text-xs mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>

              {/* Undo / action button */}
              {toast.action && (
                <button
                  onClick={() => { toast.action!.onClick(); removeToast(toast.id); }}
                  className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[#f5f5f5] transition-colors"
                >
                  {toast.action.label}
                </button>
              )}

              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#505050] hover:text-[#f5f5f5] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
