import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={handleOverlayClick}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl flex flex-col items-center gap-4"
        style={{ background: '#141414', borderColor: '#2a2a2a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ícone */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20">
          <Trash2 className="w-7 h-7 text-red-500" />
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
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
