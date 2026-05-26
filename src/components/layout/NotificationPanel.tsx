import React from 'react';
import { X, Bell, Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Aviso } from '../../types';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, "dd 'de' MMM", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

const urgencyColors: Record<string, string> = {
  'Alta': '#ef4444',
  'Média': '#f59e0b',
  'Baixa': '#10b981',
};

const tipoIcons: Record<string, React.ReactNode> = {
  'Prazo': <Clock size={14} />,
  'Audiência': <Calendar size={14} />,
  'Alerta': <AlertTriangle size={14} />,
  'Lembrete': <Bell size={14} />,
};

function AvisoCard({ aviso }: { aviso: Aviso }) {
  const { setAvisos, addToast } = useApp();

  const markRead = () => {
    setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, lido: true } : a));
  };

  const markDone = () => {
    setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, status: 'Concluído', lido: true } : a));
    addToast('Aviso marcado como concluído', 'success');
  };

  return (
    <div
      className={`p-3 rounded-xl border transition-all cursor-pointer ${!aviso.lido ? 'border-amber-500/20' : 'border-white/5'}`}
      style={{ background: !aviso.lido ? 'rgba(217,119,6,0.05)' : 'rgba(255,255,255,0.02)' }}
      onClick={markRead}
    >
      <div className="flex items-start gap-2">
        <div
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: `${urgencyColors[aviso.urgencia]}20`, color: urgencyColors[aviso.urgencia] }}
        >
          {tipoIcons[aviso.tipo]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={`text-xs font-semibold truncate ${!aviso.lido ? 'text-white' : 'text-gray-300'}`}>
              {aviso.titulo}
            </p>
            {!aviso.lido && (
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </div>
          {aviso.clienteNome && (
            <p className="text-xs text-gray-500 truncate">{aviso.clienteNome}</p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs" style={{ color: urgencyColors[aviso.urgencia] }}>
              {formatDate(aviso.dataEvento)}
            </span>
            {aviso.status === 'Pendente' && (
              <button
                onClick={(e) => { e.stopPropagation(); markDone(); }}
                className="text-xs text-gray-500 hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <CheckCircle size={11} /> Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationPanel() {
  const { notificationPanelOpen, setNotificationPanelOpen, avisos, setAvisos, unreadAvisosCount } = useApp();

  const pendentes = avisos.filter(a => a.status === 'Pendente');
  const unread = pendentes.filter(a => !a.lido);

  const markAllRead = () => {
    setAvisos(prev => prev.map(a => ({ ...a, lido: true })));
  };

  if (!notificationPanelOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setNotificationPanelOpen(false)}
      />
      {/* Panel */}
      <div
        className="notification-panel fixed top-0 right-0 h-full w-80 z-50 flex flex-col border-l shadow-2xl"
        style={{ background: '#0f0f0f', borderColor: '#1e1e1e' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: '#1e1e1e' }}>
          <div>
            <h3 className="text-base font-semibold text-white">Notificações</h3>
            {unreadAvisosCount > 0 && (
              <p className="text-xs text-amber-400">{unreadAvisosCount} não lida(s)</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadAvisosCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
              >
                Marcar todas
              </button>
            )}
            <button
              onClick={() => setNotificationPanelOpen(false)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {unread.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Não lidas
              </p>
              <div className="flex flex-col gap-2">
                {unread.map(av => <AvisoCard key={av.id} aviso={av} />)}
              </div>
            </div>
          )}

          {pendentes.filter(a => a.lido).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Anteriores
              </p>
              <div className="flex flex-col gap-2">
                {pendentes.filter(a => a.lido).map(av => <AvisoCard key={av.id} aviso={av} />)}
              </div>
            </div>
          )}

          {pendentes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Bell size={32} className="text-gray-700 mb-2" />
              <p className="text-sm text-gray-500">Sem notificações pendentes</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
