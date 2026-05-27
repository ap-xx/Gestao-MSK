import React from 'react';
import { X, Bell, AlertTriangle, Calendar, DollarSign, FileText, Info } from 'lucide-react';
import { avisosApi } from '../services/api';
import type { PageKey } from './Layout';
import type { Aviso } from '../types';

const urgenciaColors: Record<string, string> = {
  critica: 'border-red-500 bg-red-500/10',
  alta: 'border-amber-500 bg-amber-500/10',
  media: 'border-blue-500 bg-blue-500/10',
  baixa: 'border-green-500 bg-green-500/10',
};

const urgenciaText: Record<string, string> = {
  critica: 'text-red-400',
  alta: 'text-amber-400',
  media: 'text-blue-400',
  baixa: 'text-green-400',
};

const tipoIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  prazo: AlertTriangle,
  audiencia: Calendar,
  pagamento: DollarSign,
  contrato: FileText,
  sistema: Info,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: PageKey) => void;
}

export default function NotificacoesPanel({ open, onClose, onNavigate }: Props) {
  const [avisos, setAvisos] = React.useState<Aviso[]>([]);

  React.useEffect(() => {
    if (open) {
      avisosApi.getAll()
        .then(data => {
          setAvisos(data.sort((a, b) => {
            const urgOrd = { critica: 0, alta: 1, media: 2, baixa: 3 };
            return urgOrd[a.urgencia] - urgOrd[b.urgencia];
          }));
        })
        .catch(() => {});
    }
  }, [open]);

  async function marcarLido(id: string) {
    try {
      await avisosApi.marcarLido(id);
      setAvisos(prev => prev.map(a => a.id === id ? { ...a, lido: true } : a));
    } catch {}
  }

  async function marcarTodosLidos() {
    try {
      await Promise.all(avisos.filter(a => !a.lido).map(a => avisosApi.marcarLido(a.id)));
      setAvisos(prev => prev.map(a => ({ ...a, lido: true })));
    } catch {}
  }

  const naoLidos = avisos.filter(a => !a.lido).length;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-[#141414] border-l border-[#2a2a2a] z-50 flex flex-col animate-slide-in-right shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-[#f5f5f5]">Notificações</h3>
            {naoLidos > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {naoLidos}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {naoLidos > 0 && (
              <button
                onClick={marcarTodosLidos}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
            <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto min-h-0 py-3 px-3 space-y-2">
          {avisos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#505050]">
              <Bell className="w-8 h-8 mb-2" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            avisos.map(aviso => {
              const Icon = tipoIcons[aviso.tipo] || Info;
              return (
                <div
                  key={aviso.id}
                  className={`border-l-2 rounded-lg px-3 py-3 transition-all cursor-pointer ${urgenciaColors[aviso.urgencia]} ${aviso.lido ? 'opacity-50' : ''}`}
                  onClick={() => !aviso.lido && marcarLido(aviso.id)}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${urgenciaText[aviso.urgencia]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-[#f5f5f5] truncate">{aviso.titulo}</p>
                        {!aviso.lido && (
                          <span className="w-2 h-2 bg-amber-400 rounded-full shrink-0 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-[#a0a0a0] leading-relaxed">{aviso.descricao}</p>
                      {aviso.dataLimite && (
                        <p className={`text-xs mt-1 font-medium ${urgenciaText[aviso.urgencia]}`}>
                          Prazo: {new Date(aviso.dataLimite).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2a2a2a] px-5 py-3">
          <button
            onClick={() => { onNavigate('avisos'); onClose(); }}
            className="w-full text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium"
          >
            Ver todos os avisos →
          </button>
        </div>
      </div>
    </>
  );
}
