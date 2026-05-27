import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, X, DollarSign, CheckCircle, Clock, TrendingDown,
  Search, Edit2, Trash2, Receipt, CreditCard, Printer,
} from 'lucide-react';
import { lancamentosApi, clientesApi } from '../services/api';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/cn';
import { DateInput } from '../components/ui/Input';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import type { Lancamento, TipoLancamento, StatusPagamento, Cliente } from '../types';
import Portal from '../components/ui/Portal';

const STATUS_STYLES: Record<StatusPagamento, string> = {
  pago: 'bg-green-500/15 text-green-400 border-green-500/30',
  pendente: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  vencido: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const STATUS_LABELS: Record<StatusPagamento, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

const FORMAS_PAGAMENTO = ['PIX', 'TED', 'Boleto', 'Cartão', 'Dinheiro', 'Cheque', 'Outro'];

interface ModalProps {
  lancamento?: Lancamento;
  tipo?: TipoLancamento;
  clientes: Cliente[];
  onClose: () => void;
  onSave: () => void;
}

function LancamentoModal({ lancamento, tipo, clientes, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
  const isEdit = !!lancamento;

  const [form, setForm] = useState({
    tipo: (lancamento?.tipo || tipo || 'recebimento') as TipoLancamento,
    clienteId: lancamento?.clienteId || '',
    descricao: lancamento?.descricao || '',
    valor: lancamento?.valor?.toString() || '',
    dataVencimento: lancamento?.dataVencimento || new Date().toISOString().split('T')[0],
    dataPagamento: lancamento?.dataPagamento || '',
    status: (lancamento?.status || 'pendente') as StatusPagamento,
    formaPagamento: lancamento?.formaPagamento || '',
    observacoes: lancamento?.observacoes || '',
  });

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cliente = clientes.find(c => c.id === form.clienteId);
    const now = new Date().toISOString();
    const payload: Omit<Lancamento, 'id'> = {
      tipo: form.tipo,
      clienteId: form.clienteId || undefined,
      clienteNome: cliente?.nome,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      dataVencimento: form.dataVencimento,
      dataPagamento: form.dataPagamento || undefined,
      status: form.status,
      formaPagamento: form.formaPagamento || undefined,
      observacoes: form.observacoes || undefined,
      criadoEm: lancamento?.criadoEm || now,
    };
    try {
      if (isEdit) await lancamentosApi.update(lancamento.id, payload);
      else await lancamentosApi.create(payload);
      showToast('success', isEdit ? 'Lançamento atualizado!' : 'Lançamento registrado!');
      onSave();
    } catch (err: any) {
      showToast('error', 'Erro ao salvar', err.message);
    }
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">{isEdit ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <form id="honorario-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className={labelClass}>Tipo *</label>
            <div className="grid grid-cols-3 gap-2">
              {([['recebimento', 'Recebimento'], ['a_receber', 'A Receber'], ['despesa', 'Despesa']] as [TipoLancamento, string][]).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tipo', t)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    form.tipo === t
                      ? t === 'recebimento' ? 'border-green-500 bg-green-500/10 text-green-400'
                        : t === 'a_receber' ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-red-500 bg-red-500/10 text-red-400'
                      : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#a0a0a0]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Cliente (opcional)</label>
            <select className={inputClass} value={form.clienteId} onChange={e => set('clienteId', e.target.value)}>
              <option value="">Sem cliente associado</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Descrição *</label>
            <input className={inputClass} value={form.descricao} onChange={e => set('descricao', e.target.value)} required placeholder="Descrição do lançamento" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Valor (R$) *</label>
              <input type="number" className={inputClass} value={form.valor} onChange={e => set('valor', e.target.value)} required placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <label className={labelClass}>Forma de Pagamento</label>
              <select className={inputClass} value={form.formaPagamento} onChange={e => set('formaPagamento', e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data de Vencimento *</label>
              <DateInput className={inputClass} value={form.dataVencimento} onChange={e => set('dataVencimento', e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Data de Pagamento</label>
              <DateInput className={inputClass} value={form.dataPagamento} onChange={e => set('dataPagamento', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>

        </form>

        {/* Sticky footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
          <button type="submit" form="honorario-form" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-500/20">
            {isEdit ? 'Salvar' : 'Registrar'}
          </button>
        </div>
      </div>
      </div>
    </div>
    </Portal>
  );
}

export default function Honorarios() {
  const { showToast } = useToast();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TipoLancamento>('recebimento');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLancamento, setEditLancamento] = useState<Lancamento | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Lancamento | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([lancamentosApi.getAll(), clientesApi.getAll()]);
      setLancamentos(l);
      setClientes(c);
    } catch {
      showToast('error', 'Erro', 'Não foi possível carregar lançamentos');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    return lancamentos.filter(l => {
      const q = search.toLowerCase();
      const matchTab = l.tipo === tab;
      const matchSearch = !q || l.descricao.toLowerCase().includes(q) ||
        (l.clienteNome || '').toLowerCase().includes(q);
      // A receber tab: only show unpaid entries (paid ones move to recebimentos)
      if (tab === 'a_receber' && l.status === 'pago') return false;
      return matchTab && matchSearch;
    });
  }, [lancamentos, tab, search]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'dataVencimento', 'desc');
  const pagination = usePagination(sorted, 15);

  const stats = useMemo(() => {
    const recebido = lancamentos.filter(l => l.tipo === 'recebimento' && l.status === 'pago').reduce((s, l) => s + l.valor, 0);
    const aReceber = lancamentos.filter(l => l.tipo === 'a_receber' && (l.status === 'pendente' || l.status === 'vencido')).reduce((s, l) => s + l.valor, 0);
    const despesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    return { recebido, aReceber, despesas };
  }, [lancamentos]);

  async function marcarPago(l: Lancamento) {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      // Atualiza o lançamento original para "pago"
      await lancamentosApi.update(l.id, { status: 'pago', dataPagamento: hoje });

      // Se era do tipo "a_receber", cria também um lançamento de "recebimento"
      if (l.tipo === 'a_receber') {
        await lancamentosApi.create({
          tipo: 'recebimento',
          clienteId: l.clienteId,
          clienteNome: l.clienteNome,
          processoId: l.processoId,
          contratoId: l.contratoId,
          descricao: `Recebimento: ${l.descricao}`,
          valor: l.valor,
          dataVencimento: hoje,
          dataPagamento: hoje,
          status: 'pago',
          formaPagamento: l.formaPagamento,
          observacoes: l.observacoes,
          criadoEm: new Date().toISOString(),
        });
        await reload();
        setTab('recebimento'); // muda para aba recebimentos
        showToast('success', 'Pago e lançado em Recebimentos!', formatCurrency(l.valor));
      } else {
        await reload();
        showToast('success', 'Marcado como pago!', formatCurrency(l.valor));
      }
    } catch (err: any) {
      showToast('error', 'Erro', err.message);
    }
  }

  function handleDelete(l: Lancamento) {
    setToDelete(l);
    setConfirmOpen(true);
  }

  async function doDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await lancamentosApi.remove(toDelete.id);
      await reload();
      showToast('info', 'Lançamento removido');
    } catch (err: any) {
      showToast('error', 'Erro', err.message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setToDelete(null);
    }
  }

  const tabs: Array<{ key: TipoLancamento; label: string; icon: any; color: string }> = [
    { key: 'recebimento', label: 'Recebimentos', icon: CheckCircle, color: 'text-green-400' },
    { key: 'a_receber', label: 'A Receber', icon: Clock, color: 'text-amber-400' },
    { key: 'despesa', label: 'Despesas', icon: TrendingDown, color: 'text-red-400' },
  ];

  const SortIcon = ({ col }: { col: keyof Lancamento }) => (
    <span className="ml-1 opacity-60">{sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Print style */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .print-page { background: #fff !important; color: #000 !important; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #f5f5f5 !important; color: #333 !important; border: 1px solid #ddd; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
          td { border: 1px solid #eee; padding: 8px 12px; font-size: 12px; color: #333 !important; }
          tr:nth-child(even) td { background: #fafafa; }
          .print-header { display: flex !important; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #f59e0b; padding-bottom: 16px; }
          .print-title { font-size: 22px; font-weight: bold; color: #333; }
          .print-subtitle { font-size: 12px; color: #666; margin-top: 4px; }
          .print-totals { display: grid !important; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 16px 0; }
          .print-total-card { border: 1px solid #eee; border-radius: 8px; padding: 10px 14px; text-align: center; }
          .print-total-label { font-size: 10px; color: #888; text-transform: uppercase; }
          .print-total-value { font-size: 16px; font-weight: bold; margin-top: 2px; }
          .text-green-400 { color: #16a34a !important; }
          .text-amber-400 { color: #d97706 !important; }
          .text-red-400   { color: #dc2626 !important; }
          .bg-\\[\\#141414\\], .bg-\\[\\#1e1e1e\\], .bg-\\[\\#1a1a1a\\] { background: transparent !important; border-color: #eee !important; }
          .border-\\[\\#2a2a2a\\] { border-color: #eee !important; }
          .rounded-xl { border-radius: 0 !important; }
          .overflow-hidden { overflow: visible !important; }
        }
        @media screen {
          .print-header, .print-totals, .print-total-card, .print-total-label, .print-total-value { display: none; }
        }
      `}</style>
      {/* Print-only header */}
      <div className="print-header hidden">
        <div>
          <div className="print-title">MSK Advocacia — Honorários</div>
          <div className="print-subtitle">
            Relatório: {tabs.find(t => t.key === tab)?.label ?? tab} · Gerado em {new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}
          </div>
        </div>
        <div className="print-subtitle" style={{ textAlign: 'right' }}>
          {pagination.items.length} registro(s)
        </div>
      </div>
      <div className="print-totals hidden">
        <div className="print-total-card">
          <div className="print-total-label">Recebido</div>
          <div className="print-total-value text-green-400">{formatCurrency(stats.recebido)}</div>
        </div>
        <div className="print-total-card">
          <div className="print-total-label">A Receber</div>
          <div className="print-total-value text-amber-400">{formatCurrency(stats.aReceber)}</div>
        </div>
        <div className="print-total-card">
          <div className="print-total-label">Despesas</div>
          <div className="print-total-value text-red-400">{formatCurrency(stats.despesas)}</div>
        </div>
        <div className="print-total-card">
          <div className="print-total-label">Saldo</div>
          <div className="print-total-value">{formatCurrency(stats.recebido - stats.despesas)}</div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Honorários</h1>
          <p className="text-[#a0a0a0] text-sm">Controle financeiro</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400 rounded-lg text-sm font-medium transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={() => { setEditLancamento(undefined); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-[#505050]">Recebido</span>
          </div>
          <p className="text-xl font-bold text-green-400">{formatCurrency(stats.recebido)}</p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-[#505050]">A Receber</span>
          </div>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(stats.aReceber)}</p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-[#505050]">Despesas</span>
          </div>
          <p className="text-xl font-bold text-red-400">{formatCurrency(stats.despesas)}</p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#f5f5f5]" />
            <span className="text-xs text-[#505050]">Saldo</span>
          </div>
          <p className={`text-xl font-bold ${stats.recebido - stats.despesas >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(stats.recebido - stats.despesas)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2a2a2a] no-print">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === t.key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-[#505050] hover:text-[#a0a0a0]'
            }`}
          >
            <t.icon className={`w-4 h-4 ${tab === t.key ? t.color : ''}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm no-print">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050]" />
        <input
          className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]"
          placeholder="Buscar lançamentos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th onClick={() => toggle('descricao')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]">
                  Descrição <SortIcon col="descricao" />
                </th>
                <th onClick={() => toggle('clienteNome')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-[#a0a0a0]">
                  Cliente <SortIcon col="clienteNome" />
                </th>
                <th onClick={() => toggle('valor')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]">
                  Valor <SortIcon col="valor" />
                </th>
                <th onClick={() => toggle('dataVencimento')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-[#a0a0a0]">
                  Vencimento <SortIcon col="dataVencimento" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell">Pagamento</th>
                <th onClick={() => toggle('status')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]">
                  Status <SortIcon col="status" />
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {loading ? (
                <LoadingTable cols={7} />
              ) : pagination.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#505050]">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum lançamento encontrado</p>
                  </td>
                </tr>
              ) : (
                pagination.items.map(l => (
                  <tr key={l.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#f5f5f5] leading-tight">{l.descricao}</p>
                      {l.formaPagamento && (
                        <p className="text-xs text-[#505050] flex items-center gap-1 mt-0.5">
                          <CreditCard className="w-3 h-3" /> {l.formaPagamento}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-[#a0a0a0]">{l.clienteNome || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className={`font-bold text-sm ${l.tipo === 'recebimento' || l.tipo === 'a_receber' ? 'text-green-400' : 'text-red-400'}`}>
                        {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                      </p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-xs text-[#a0a0a0]">{new Date(l.dataVencimento).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-xs text-[#a0a0a0]">{l.dataPagamento ? new Date(l.dataPagamento).toLocaleDateString('pt-BR') : '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[l.status]}`}>
                        {STATUS_LABELS[l.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 no-print">
                      <div className="flex items-center justify-end gap-2">
                        {(l.status === 'pendente' || l.status === 'vencido') && (
                          <button
                            onClick={() => marcarPago(l)}
                            className="text-xs px-2.5 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded-lg transition-colors whitespace-nowrap"
                            title="Marcar como pago"
                          >
                            Marcar Pago
                          </button>
                        )}
                        <button onClick={() => { setEditLancamento(l); setModalOpen(true); }} className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(l)} className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="no-print">
          <Pagination {...pagination} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja excluir "${toDelete?.descricao}"?`}
        onConfirm={doDelete}
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
        loading={deleting}
      />

      {modalOpen && (
        <LancamentoModal
          lancamento={editLancamento}
          tipo={tab}
          clientes={clientes}
          onClose={() => { setModalOpen(false); setEditLancamento(undefined); }}
          onSave={() => { reload(); setModalOpen(false); setEditLancamento(undefined); }}
        />
      )}
    </div>
  );
}
