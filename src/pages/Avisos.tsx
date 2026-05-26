import React, { useState, useMemo } from 'react';
import {
  Bell, AlertTriangle, Calendar, DollarSign, FileText, Info,
  CheckCheck, Trash2, Plus, X,
} from 'lucide-react';
import { AvisosDB, generateId } from '../data/db';
import { useToast } from '../context/ToastContext';
import type { Aviso, UrgenciaAviso, TipoAviso } from '../types';

const urgenciaConfig: Record<UrgenciaAviso, { label: string; border: string; bg: string; text: string; badge: string }> = {
  critica: { label: 'Crítica', border: 'border-red-500', bg: 'bg-red-500/5', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  alta: { label: 'Alta', border: 'border-amber-500', bg: 'bg-amber-500/5', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  media: { label: 'Média', border: 'border-blue-500', bg: 'bg-blue-500/5', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  baixa: { label: 'Baixa', border: 'border-green-500', bg: 'bg-green-500/5', text: 'text-green-400', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const tipoConfig: Record<TipoAviso, { label: string; icon: any }> = {
  prazo: { label: 'Prazo', icon: AlertTriangle },
  audiencia: { label: 'Audiência', icon: Calendar },
  pagamento: { label: 'Pagamento', icon: DollarSign },
  contrato: { label: 'Contrato', icon: FileText },
  sistema: { label: 'Sistema', icon: Info },
};

interface NovoAvisoModal {
  onClose: () => void;
  onSave: () => void;
}

function NovoAvisoModal({ onClose, onSave }: NovoAvisoModal) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    tipo: 'prazo' as TipoAviso,
    urgencia: 'media' as UrgenciaAviso,
    dataLimite: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const aviso: Aviso = {
      id: generateId(),
      titulo: form.titulo,
      descricao: form.descricao,
      tipo: form.tipo,
      urgencia: form.urgencia,
      dataLimite: form.dataLimite || undefined,
      lido: false,
      criadoEm: new Date().toISOString(),
    };
    AvisosDB.insert(aviso);
    showToast('success', 'Aviso criado!');
    onSave();
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Novo Aviso</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Título *</label>
            <input className={inputClass} value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} required placeholder="Título do aviso" />
          </div>
          <div>
            <label className={labelClass}>Descrição *</label>
            <textarea className={`${inputClass} resize-none`} rows={3} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} required placeholder="Descreva o aviso com detalhes..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tipo</label>
              <select className={inputClass} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoAviso }))}>
                {Object.entries(tipoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Urgência</label>
              <select className={inputClass} value={form.urgencia} onChange={e => setForm(p => ({ ...p, urgencia: e.target.value as UrgenciaAviso }))}>
                {Object.entries(urgenciaConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Data Limite</label>
            <input type="date" className={inputClass} value={form.dataLimite} onChange={e => setForm(p => ({ ...p, dataLimite: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2 border-t border-[#2a2a2a]">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-500/20">Criar Aviso</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Avisos() {
  const { showToast } = useToast();
  const [avisos, setAvisos] = useState<Aviso[]>(AvisosDB.getAll());
  const [filterUrgencia, setFilterUrgencia] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterLido, setFilterLido] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);

  const reload = () => setAvisos(AvisosDB.getAll());

  const filtered = useMemo(() => {
    return avisos.filter(a => {
      const matchUrg = filterUrgencia === 'todos' || a.urgencia === filterUrgencia;
      const matchTipo = filterTipo === 'todos' || a.tipo === filterTipo;
      const matchLido = filterLido === 'todos' || (filterLido === 'nao_lido' ? !a.lido : a.lido);
      return matchUrg && matchTipo && matchLido;
    }).sort((a, b) => {
      const ord = { critica: 0, alta: 1, media: 2, baixa: 3 };
      const urgOrd = ord[a.urgencia] - ord[b.urgencia];
      if (urgOrd !== 0) return urgOrd;
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });
  }, [avisos, filterUrgencia, filterTipo, filterLido]);

  function marcarLido(id: string) {
    AvisosDB.marcarLido(id);
    reload();
  }

  function marcarTodosLidos() {
    avisos.filter(a => !a.lido).forEach(a => AvisosDB.marcarLido(a.id));
    reload();
    showToast('success', 'Todos marcados como lidos');
  }

  function remover(id: string) {
    AvisosDB.remove(id);
    reload();
    showToast('info', 'Aviso removido');
  }

  const naoLidos = avisos.filter(a => !a.lido).length;

  function diasRestantes(data: string): number {
    return Math.ceil((new Date(data).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Avisos</h1>
          <p className="text-[#a0a0a0] text-sm">{naoLidos} não lido(s) · {avisos.length} total</p>
        </div>
        <div className="ml-auto flex gap-2">
          {naoLidos > 0 && (
            <button
              onClick={marcarTodosLidos}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400 rounded-lg text-sm font-medium transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar tudo lido
            </button>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Aviso
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterUrgencia} onChange={e => setFilterUrgencia(e.target.value)}>
          <option value="todos">Todas as urgências</option>
          {Object.entries(urgenciaConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(tipoConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterLido} onChange={e => setFilterLido(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="nao_lido">Não lidos</option>
          <option value="lido">Lidos</option>
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#505050]">
          <Bell className="w-10 h-10 mb-3 opacity-30" />
          <p>Nenhum aviso encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(aviso => {
            const cfg = urgenciaConfig[aviso.urgencia];
            const tipoCfg = tipoConfig[aviso.tipo];
            const TipoIcon = tipoCfg.icon;
            const dias = aviso.dataLimite ? diasRestantes(aviso.dataLimite) : null;

            return (
              <div
                key={aviso.id}
                className={`border-l-4 ${cfg.border} ${cfg.bg} bg-[#141414] border border-[#2a2a2a] rounded-xl px-5 py-4 transition-all ${aviso.lido ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <TipoIcon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.text}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <h3 className="font-semibold text-[#f5f5f5] text-sm">{aviso.titulo}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-[#505050] bg-[#1e1e1e] border border-[#2a2a2a] px-2 py-0.5 rounded-full">
                        {tipoCfg.label}
                      </span>
                      {!aviso.lido && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      )}
                    </div>

                    <p className="text-sm text-[#a0a0a0] leading-relaxed">{aviso.descricao}</p>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {aviso.dataLimite && (
                        <span className={`text-xs font-medium flex items-center gap-1 ${
                          dias !== null && dias < 0 ? 'text-red-400' :
                          dias !== null && dias <= 3 ? 'text-red-400' :
                          dias !== null && dias <= 7 ? 'text-amber-400' : cfg.text
                        }`}>
                          <Calendar className="w-3 h-3" />
                          {dias !== null && dias < 0
                            ? `Vencido há ${Math.abs(dias)} dia(s)`
                            : dias === 0 ? 'Vence hoje!'
                            : dias !== null && dias === 1 ? 'Vence amanhã!'
                            : `Vence em ${dias} dias — ${new Date(aviso.dataLimite).toLocaleDateString('pt-BR')}`
                          }
                        </span>
                      )}
                      <span className="text-xs text-[#505050]">
                        {new Date(aviso.criadoEm).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!aviso.lido && (
                      <button
                        onClick={() => marcarLido(aviso.id)}
                        className="p-1.5 text-[#505050] hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Marcar como lido"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => remover(aviso.id)}
                      className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <NovoAvisoModal
          onClose={() => setModalOpen(false)}
          onSave={() => { reload(); setModalOpen(false); }}
        />
      )}
    </div>
  );
}
