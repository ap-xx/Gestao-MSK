import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, X, FileText, Search, Edit2, Trash2, DollarSign,
  TrendingUp, Building2, User, Eye,
} from 'lucide-react';
import { contratosApi, clientesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DateInput } from '../components/ui/Input';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import type { Contrato, TipoContrato, StatusContrato, Cliente } from '../types';

const TIPOS: TipoContrato[] = ['Mensal', 'Êxito', 'Misto', 'Avulso'];
const AREAS = ['Cível', 'Trabalhista', 'Criminal', 'Empresarial', 'Tributário', 'Imobiliário', 'Família e Sucessões', 'Previdenciário', 'Administrativo', 'Outro'];

const STATUS_STYLES: Record<StatusContrato, string> = {
  ativo: 'bg-green-500/15 text-green-400 border-green-500/30',
  encerrado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  suspenso: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  negociando: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const STATUS_LABELS: Record<StatusContrato, string> = {
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  suspenso: 'Suspenso',
  negociando: 'Negociando',
};

const TIPO_STYLES: Record<TipoContrato, string> = {
  'Mensal': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Êxito': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Misto': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Avulso': 'bg-green-500/10 text-green-400 border-green-500/20',
};

// Pipeline de status
const PIPELINE_STEPS: StatusContrato[] = ['negociando', 'ativo', 'suspenso', 'encerrado'];
const PIPELINE_COLORS: Record<StatusContrato, string> = {
  negociando: 'bg-blue-400',
  ativo: 'bg-green-400',
  suspenso: 'bg-yellow-400',
  encerrado: 'bg-gray-400',
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function StatusPipeline({ status }: { status: StatusContrato }) {
  const idx = PIPELINE_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-2">
      {PIPELINE_STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className={`w-2.5 h-2.5 rounded-full transition-all ${i <= idx ? PIPELINE_COLORS[step] : 'bg-[#2a2a2a]'}`} title={STATUS_LABELS[step]} />
          {i < PIPELINE_STEPS.length - 1 && (
            <div className={`flex-1 h-px ${i < idx ? PIPELINE_COLORS[step] : 'bg-[#2a2a2a]'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

interface ModalProps {
  contrato?: Contrato;
  clientes: Cliente[];
  onClose: () => void;
  onSave: () => void;
}

function ContratoModal({ contrato, clientes, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clienteId) { showToast('warning', 'Selecione um cliente'); return; }
    const cliente = clientes.find(c => c.id === form.clienteId);
    const now = new Date().toISOString();
    const payload: Omit<Contrato, 'id'> = {
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
    try {
      if (isEdit) await contratosApi.update(contrato.id, payload);
      else await contratosApi.create(payload);
      showToast('success', isEdit ? 'Contrato atualizado!' : 'Contrato criado!', payload.descricao);
      onSave();
    } catch (err: any) {
      showToast('error', 'Erro ao salvar', err.message);
    }
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">{isEdit ? 'Editar Contrato' : 'Novo Contrato'}</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <form id="contrato-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          <button type="submit" form="contrato-form" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
            {isEdit ? 'Salvar Alterações' : 'Criar Contrato'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Modal de visualização ─────────────────────────────────────
function ContratoView({ contrato, onClose, onEdit }: { contrato: Contrato; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Detalhes do Contrato</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm">
          {/* Pipeline */}
          <div>
            <p className="text-xs text-[#505050] mb-1">Status</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[contrato.status]}`}>
                {STATUS_LABELS[contrato.status]}
              </span>
            </div>
            <StatusPipeline status={contrato.status} />
            <div className="flex justify-between text-[10px] text-[#505050] mt-1">
              {PIPELINE_STEPS.map(s => <span key={s}>{STATUS_LABELS[s]}</span>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-[#2a2a2a] pt-4">
            <div><p className="text-xs text-[#505050]">Cliente</p><p className="text-[#f5f5f5] font-medium">{contrato.clienteNome}</p></div>
            <div><p className="text-xs text-[#505050]">Tipo</p><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${TIPO_STYLES[contrato.tipo]}`}>{contrato.tipo}</span></div>
            <div><p className="text-xs text-[#505050]">Área de Atuação</p><p className="text-[#f5f5f5]">{contrato.areaAtuacao}</p></div>
            <div><p className="text-xs text-[#505050]">Início</p><p className="text-[#f5f5f5]">{new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}</p></div>
            {contrato.dataFim && (
              <div><p className="text-xs text-[#505050]">Encerramento</p><p className="text-[#f5f5f5]">{new Date(contrato.dataFim).toLocaleDateString('pt-BR')}</p></div>
            )}
            {contrato.valorMensal && (
              <div><p className="text-xs text-[#505050]">Valor Mensal</p><p className="text-green-400 font-bold">{formatCurrency(contrato.valorMensal)}</p></div>
            )}
            {contrato.percentualExito && (
              <div><p className="text-xs text-[#505050]">Percentual de Êxito</p><p className="text-amber-400 font-bold">{contrato.percentualExito}%</p></div>
            )}
            {contrato.valorCausa && (
              <div><p className="text-xs text-[#505050]">Valor da Causa</p><p className="text-[#f5f5f5]">{formatCurrency(contrato.valorCausa)}</p></div>
            )}
          </div>
          <div className="border-t border-[#2a2a2a] pt-4">
            <p className="text-xs text-[#505050] mb-1">Descrição</p>
            <p className="text-[#a0a0a0]">{contrato.descricao}</p>
          </div>
          {contrato.observacoes && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <p className="text-xs text-[#505050] mb-1">Observações</p>
              <p className="text-[#a0a0a0]">{contrato.observacoes}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
          <button onClick={onEdit} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium">Editar</button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Fechar</button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function Contratos() {
  const { showToast } = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editContrato, setEditContrato] = useState<Contrato | undefined>();
  const [viewContrato, setViewContrato] = useState<Contrato | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete,    setToDelete]    = useState<Contrato | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cl] = await Promise.all([contratosApi.getAll(), clientesApi.getAll()]);
      setContratos(c);
      setClientes(cl);
    } catch {
      showToast('error', 'Erro', 'Não foi possível carregar contratos');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    return contratos.filter(c => {
      const q = search.toLowerCase();
      const match = !q || c.clienteNome.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q) || c.areaAtuacao.toLowerCase().includes(q);
      const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;
      const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
      return match && matchTipo && matchStatus;
    });
  }, [contratos, search, filterTipo, filterStatus]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'clienteNome');
  const pagination = usePagination(sorted, 15);

  function handleDelete(c: Contrato) {
    setToDelete(c);
    setConfirmOpen(true);
  }

  async function doDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await contratosApi.remove(toDelete.id);
      await reload();
      showToast('info', 'Contrato removido', toDelete.clienteNome);
    } catch (err: any) {
      showToast('error', 'Erro ao excluir', err.message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setToDelete(null);
    }
  }

  const stats = useMemo(() => ({
    ativos: contratos.filter(c => c.status === 'ativo').length,
    valorMensalTotal: contratos.filter(c => c.status === 'ativo' && c.valorMensal).reduce((s, c) => s + (c.valorMensal || 0), 0),
  }), [contratos]);

  const SortIcon = ({ col }: { col: keyof Contrato }) => (
    <span className="ml-1 opacity-60">{sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

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

      {/* Tabela */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th onClick={() => toggle('clienteNome')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]">
                  Cliente <SortIcon col="clienteNome" />
                </th>
                <th onClick={() => toggle('tipo')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-[#a0a0a0]">
                  Tipo <SortIcon col="tipo" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell">Área / Descrição</th>
                <th onClick={() => toggle('dataInicio')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-[#a0a0a0]">
                  Início <SortIcon col="dataInicio" />
                </th>
                <th onClick={() => toggle('status')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]">
                  Status <SortIcon col="status" />
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {loading ? (
                <LoadingTable cols={6} />
              ) : pagination.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#505050]">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum contrato encontrado</p>
                  </td>
                </tr>
              ) : (
                pagination.items.map(c => {
                  const cliente = clientes.find(cl => cl.id === c.clienteId);
                  const valorExito = c.percentualExito && c.valorCausa ? (c.percentualExito / 100) * c.valorCausa : 0;
                  return (
                    <tr key={c.id} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.tipo === 'Mensal' ? 'bg-blue-500/15' : c.tipo === 'Êxito' ? 'bg-amber-500/15' : c.tipo === 'Misto' ? 'bg-purple-500/15' : 'bg-green-500/15'}`}>
                            {cliente?.tipoPessoa === 'PJ' ? <Building2 className="w-4 h-4 text-blue-400" /> : <User className="w-4 h-4 text-amber-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-[#f5f5f5] text-sm">{c.clienteNome}</p>
                            <p className="text-xs text-[#505050]">Desde {new Date(c.dataInicio).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${TIPO_STYLES[c.tipo]}`}>{c.tipo}</span>
                        {c.valorMensal && (
                          <p className="text-xs text-green-400 font-semibold mt-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />{formatCurrency(c.valorMensal)}
                          </p>
                        )}
                        {c.percentualExito && (
                          <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />{c.percentualExito}%{valorExito > 0 ? ` = ${formatCurrency(valorExito)}` : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <p className="text-xs text-[#a0a0a0]">{c.areaAtuacao}</p>
                        <p className="text-xs text-[#505050] truncate max-w-48">{c.descricao}</p>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <p className="text-xs text-[#a0a0a0]">{new Date(c.dataInicio).toLocaleDateString('pt-BR')}</p>
                        {c.dataFim && (
                          <p className="text-xs text-[#505050]">até {new Date(c.dataFim).toLocaleDateString('pt-BR')}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setViewContrato(c)} className="p-1.5 text-[#505050] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Visualizar">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setEditContrato(c); setModalOpen(true); }} className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" title="Editar">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(c)} className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir Contrato"
        message={`Tem certeza que deseja excluir o contrato de "${toDelete?.clienteNome}"? Esta ação não pode ser desfeita.`}
        onConfirm={doDelete}
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
        loading={deleting}
      />

      {modalOpen && (
        <ContratoModal
          contrato={editContrato}
          clientes={clientes}
          onClose={() => { setModalOpen(false); setEditContrato(undefined); }}
          onSave={() => { reload(); setModalOpen(false); setEditContrato(undefined); }}
        />
      )}

      {viewContrato && (
        <ContratoView
          contrato={viewContrato}
          onClose={() => setViewContrato(null)}
          onEdit={() => { setEditContrato(viewContrato); setViewContrato(null); setModalOpen(true); }}
        />
      )}
    </div>
  );
}
