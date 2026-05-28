import React from 'react';
import { Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Portal from './Portal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** 'danger' = vermelho/lixeira (padrão), 'success' = verde/check, 'warning' = âmbar/alerta */
  variant?: 'danger' | 'success' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const VARIANTS = {
  danger: {
    iconBg:  'bg-red-500/10 border-red-500/20',
    iconColor: 'text-red-500',
    btnClass: 'bg-red-500 hover:bg-red-600',
    Icon: Trash2,
  },
  success: {
    iconBg:  'bg-green-500/10 border-green-500/20',
    iconColor: 'text-green-500',
    btnClass: 'bg-green-500 hover:bg-green-600',
    Icon: CheckCircle,
  },
  warning: {
    iconBg:  'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-500',
    btnClass: 'bg-amber-500 hover:bg-amber-600',
    Icon: AlertTriangle,
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const { iconBg, iconColor, btnClass, Icon } = VARIANTS[variant];

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !loading) onCancel();
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={handleOverlayClick}
      >
        <div
          className="relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl flex flex-col items-center gap-4"
          style={{ background: '#141414', borderColor: '#2a2a2a' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ícone */}
          <div className={`flex items-center justify-center w-14 h-14 rounded-full border ${iconBg}`}>
            <Icon className={`w-7 h-7 ${iconColor}`} />
          </div>

          {/* Título */}
          <h2 className="text-base font-semibold text-[#f5f5f5] text-center">{title}</h2>

          {/* Mensagem */}
          <p className="text-sm text-[#a0a0a0] text-center leading-relaxed">{message}</p>

          {/* Botões */}
          <div className="flex gap-3 w-full mt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[#a0a0a0] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:text-[#f5f5f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${btnClass}`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
