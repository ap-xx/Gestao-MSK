import React, { useState, useMemo } from 'react';
import {
  Plus, X, FileText, Search, Edit2, Trash2, Calendar, DollarSign,
  TrendingUp, Building2, User,
} from 'lucide-react';
import { ContratosDB, ClientesDB, generateId } from '../data/db';
import { useToast } from '../context/ToastContext';
import { DateInput } from '../components/ui/Input';
import type { Contrato, TipoContrato, StatusContrato } from '../types';

const TIPOS: TipoContrato[] = ['Mensal', 'Êxito', 'Misto', 'Avulso'];
const AREAS = ['Cível', 'Trabalhista', 'Criminal', 'Empresarial', 'Tributário', 'Imobiliário', 'Família e Sucessões', 'Previdenciário', 'Administrativo', 'Outro'];

const STATUS_STYLES: Record<StatusContrato, string> = {
  ativo: 'bg-green-500/15 text-green-400 border-green-500/30',
  encerrado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  suspenso: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  negociando: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const TIPO_STYLES: Record<TipoContrato, string> = {
  'Mensal': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Êxito': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Misto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Avulso': 'bg-green-500/10 text-green-400 border-green-500/20',
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

interface ModalProps {
  contrato?: Contrato;
  onClose: () => void;
  onSave: () => void;
}

function ContratoModal({ contrato, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
  const clientes = ClientesDB.getAll();
  const isEdit = !!contrato;

  const [form, setForm] = useState({
    clienteId: contrato?.clienteId || '',
    tipo: (contrato?.tipo || 'Mensal') as TipoContrato,
    valorMensal: contrato?.valorMensal?.toString() || '',
    percentualExito: contrato?.percentualExito?.toString() || '',
    valorCausa: contrato?.valorCausa?.toString() || '',
    descricao: contrato?.descricao || '',
    areaAtuacao: contrato?.areaAtuacao || 'Cível',
    dataInicio: contrato?.dataInicio || new Date().toISOString().split('T')[0],
    dataFim: contrato?.dataFim || '',
    status: (contrato?.status || 'ativo') as StatusContrato,
    observacoes: contrato?.observacoes || '',
  });

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clienteId) { showToast('warning', 'Selecione um cliente'); return; }
    const cliente = ClientesDB.getById(form.clienteId);
    const now = new Date().toISOString();
    const saved: Contrato = {
      id: contrato?.id || generateId(),
      clienteId: form.clienteId,
      clienteNome: cliente?.nome || '',
      tipo: form.tipo,
      valorMensal: form.valorMensal ? parseFloat(form.valorMensal) : undefined,
      percentualExito: form.percentualExito ? parseFloat(form.percentualExito) : undefined,
      valorCausa: form.valorCausa ? parseFloat(form.valorCausa) : undefined,
      descricao: form.descricao,
      areaAtuacao: form.areaAtuacao,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim || undefined,
      status: form.status,
      observacoes: form.observacoes || undefined,
      criadoEm: contrato?.criadoEm || now,
    };
    if (isEdit) ContratosDB.update(saved.id, saved);
    else ContratosDB.insert(saved);
    showToast('success', isEdit ? 'Contrato atualizado!' : 'Contrato criado!', saved.descricao);
    onSave();
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">{isEdit ? 'Editar Contrato' : 'Novo Contrato'}</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <form id="contrato-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Cliente */}
          <div>
            <label className={labelClass}>Cliente *</label>
            <select className={inputClass} value={form.clienteId} onChange={e => set('clienteId', e.target.value)} required>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome} {c.tipoPessoa === 'PJ' ? '(PJ)' : '(PF)'}</option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className={labelClass}>Tipo de Contrato *</label>
            <div className="grid grid-cols-4 gap-2">
              {TIPOS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tipo', t)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    form.tipo === t ? TIPO_STYLES[t] + ' !border-opacity-100' : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#a0a0a0]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Valores por tipo */}
          <div className="grid grid-cols-2 gap-4">
            {(form.tipo === 'Mensal' || form.tipo === 'Misto') && (
              <div>
                <label className={labelClass}>Valor Mensal (R$)</label>
                <input type="number" className={inputClass} value={form.valorMensal} onChange={e => set('valorMensal', e.target.value)} placeholder="0.00" min="0" step="0.01" />
              </div>
            )}
            {(form.tipo === 'Êxito' || form.tipo === 'Misto') && (
              <>
                <div>
                  <label className={labelClass}>Percentual Êxito (%)</label>
                  <input type="number" className={inputClass} value={form.percentualExito} onChange={e => set('percentualExito', e.target.value)} placeholder="20" min="0" max="100" step="0.1" />
                </div>
                <div>
                  <label className={labelClass}>Valor da Causa (R$)</label>
                  <input type="number" className={inputClass} value={form.valorCausa} onChange={e => set('valorCausa', e.target.value)} placeholder="0.00" min="0" step="0.01" />
                </div>
              </>
            )}
          </div>

          <div>
            <label className={labelClass}>Descrição do Serviço *</label>
            <input className={inputClass} value={form.descricao} onChange={e => set('descricao', e.target.value)} required placeholder="Descreva o serviço prestado" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Área de Atuação</label>
              <select className={inputClass} value={form.areaAtuacao} onChange={e => set('areaAtuacao', e.target.value)}>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="negociando">Em negociação</option>
                <option value="suspenso">Suspenso</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data de Início *</label>
              <DateInput className={inputClass} value={form.dataInicio} onChange={e => set('dataInicio', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Data de Encerramento</label>
              <DateInput className={inputClass} value={form.dataFim} onChange={e => set('dataFim', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Cláusulas especiais, observações..." />
          </div>

        </form>

        {/* Sticky footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a] shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          <button type="submit" form="contrato-form" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
            {isEdit ? 'Salvar Alterações' : 'Criar Contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Contratos() {
  const { showToast } = useToast();
  const [contratos, setContratos] = useState<Contrato[]>(ContratosDB.getAll());
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editContrato, setEditContrato] = useState<Contrato | undefined>();

  const reload = () => setContratos(ContratosDB.getAll());

  const filtered = useMemo(() => {
    return contratos.filter(c => {
      const q = search.toLowerCase();
      const match = !q || c.clienteNome.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q) || c.areaAtuacao.toLowerCase().includes(q);
      const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;
      const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
      return match && matchTipo && matchStatus;
    });
  }, [contratos, search, filterTipo, filterStatus]);

  function handleDelete(c: Contrato) {
    if (!window.confirm(`Excluir contrato de "${c.clienteNome}"?`)) return;
    ContratosDB.remove(c.id);
    reload();
    showToast('info', 'Contrato removido');
  }

  const stats = useMemo(() => ({
    ativos: contratos.filter(c => c.status === 'ativo').length,
    valorMensalTotal: contratos.filter(c => c.status === 'ativo' && c.valorMensal).reduce((s, c) => s + (c.valorMensal || 0), 0),
  }), [contratos]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Contratos</h1>
          <p className="text-[#a0a0a0] text-sm">{stats.ativos} ativos · Receita mensal: {formatCurrency(stats.valorMensalTotal)}</p>
        </div>
        <button
          onClick={() => { setEditContrato(undefined); setModalOpen(true); }}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Novo Contrato
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050]" />
          <input
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]"
            placeholder="Buscar por cliente, serviço ou área..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="negociando">Negociando</option>
          <option value="suspenso">Suspenso</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>

      {/* Grid de cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#505050]">
          <FileText className="w-10 h-10 mb-3 opacity-30" />
          <p>Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const cliente = ClientesDB.getById(c.clienteId);
            const valorExito = c.percentualExito && c.valorCausa ? (c.percentualExito / 100) * c.valorCausa : 0;
            return (
              <div key={c.id} className="bg-[#141414] border border-[#2a2a2a] hover:border-amber-500/20 rounded-xl p-5 transition-all group">
                {/* Top */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.tipo === 'Mensal' ? 'bg-blue-500/15' : c.tipo === 'Êxito' ? 'bg-amber-500/15' : c.tipo === 'Misto' ? 'bg-purple-500/15' : 'bg-green-500/15'}`}>
                      {cliente?.tipoPessoa === 'PJ' ? <Building2 className="w-4 h-4 text-blue-400" /> : <User className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#f5f5f5] leading-tight">{c.clienteNome}</p>
                      <p className="text-xs text-[#505050]">Desde {new Date(c.dataInicio).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${TIPO_STYLES[c.tipo]}`}>{c.tipo}</span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-sm text-[#a0a0a0] mb-3 line-clamp-2">{c.descricao}</p>

                {/* Área */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] px-2 py-1 rounded-full">{c.areaAtuacao}</span>
                </div>

                {/* Valores */}
                <div className="border-t border-[#2a2a2a] pt-3 space-y-1.5">
                  {c.valorMensal && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#505050] flex items-center gap-1"><DollarSign className="w-3 h-3" /> Mensal</span>
                      <span className="font-semibold text-green-400">{formatCurrency(c.valorMensal)}</span>
                    </div>
                  )}
                  {c.percentualExito && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#505050] flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Êxito ({c.percentualExito}%)</span>
                      <span className="font-semibold text-amber-400">{valorExito > 0 ? formatCurrency(valorExito) : `${c.percentualExito}%`}</span>
                    </div>
                  )}
                  {c.valorCausa && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#505050]">Valor da Causa</span>
                      <span className="text-[#a0a0a0]">{formatCurrency(c.valorCausa)}</span>
                    </div>
                  )}
                  {c.dataFim && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#505050] flex items-center gap-1"><Calendar className="w-3 h-3" /> Encerra em</span>
                      <span className="text-[#a0a0a0]">{new Date(c.dataFim).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditContrato(c); setModalOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ContratoModal
          contrato={editContrato}
          onClose={() => { setModalOpen(false); setEditContrato(undefined); }}
          onSave={() => { reload(); setModalOpen(false); setEditContrato(undefined); }}
        />
      )}
    </div>
  );
}
