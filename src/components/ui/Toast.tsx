import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border max-w-sm"
          style={{
            background: '#1e1e1e',
            borderColor: toast.type === 'success' ? 'rgba(245,158,11,0.4)'
              : toast.type === 'error' ? 'rgba(239,68,68,0.4)'
              : 'rgba(59,130,246,0.4)',
          }}
        >
          {toast.type === 'success' && <CheckCircle size={18} className="text-amber-400 shrink-0" />}
          {toast.type === 'error' && <XCircle size={18} className="text-red-400 shrink-0" />}
          {toast.type === 'info' && <Info size={18} className="text-blue-400 shrink-0" />}
          <p className="text-sm text-white flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-500 hover:text-white transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
