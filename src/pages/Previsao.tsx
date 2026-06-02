import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, X, Search, Edit2, Trash2, Target,
  Phone, Mail, Smartphone, ChevronDown,
  TrendingUp, UserPlus, Loader2, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { previsoesApi, clientesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useUndoDelete } from '../hooks/useUndoDelete';
import { usePersistedFilter } from '../hooks/usePersistedFilter';
import { useCtrlSave } from '../hooks/useCtrlSave';
import { formatCPF, formatCNPJ } from '../services/apis';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import Portal from '../components/ui/Portal';
import type { PrevisaoHonorario, ContatoItem, StatusPrevisao } from '../types';

// ─── Helpers ──────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_CONFIG: Record<StatusPrevisao, { label: string; color: string; icon: React.ComponentType<any> }> = {
  ativo:   { label: 'Em negociação', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   icon: Clock },
  fechado: { label: 'Fechado',       color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: CheckCircle },
  perdido: { label: 'Perdido',       color: 'bg-red-500/15 text-red-400 border-red-500/30',       icon: XCircle },
};

const TIPO_CONTATO_CONFIG = {
  telefone: { label: 'Telefone',  icon: Phone,       placeholder: '(99) 9999-9999' },
  celular:  { label: 'Celular',   icon: Smartphone,  placeholder: '(99) 99999-9999' },
  email:    { label: 'E-mail',    icon: Mail,        placeholder: 'email@exemplo.com' },
};

// ─── Modal Form ───────────────────────────────────────────────

interface ModalProps {
  previsao?: PrevisaoHonorario;
  onClose: () => void;
  onSave:  () => void;
}

function PrevisaoModal({ previsao, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
  const isEdit = !!previsao;

  useCtrlSave(() => document.getElementById('previsao-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

  const [nome,        setNome]        = useState(previsao?.nome || '');
  const [tipoPessoa,  setTipoPessoa]  = useState<'PF' | 'PJ'>(previsao?.tipoPessoa || 'PF');
  const [cpf,         setCpf]         = useState(previsao?.cpf || '');
  const [cnpj,        setCnpj]        = useState(previsao?.cnpj || '');
  const [valor,       setValor]       = useState(previsao?.valorPrevisto?.toString() || '');
  const [obs,         setObs]         = useState(previsao?.observacoes || '');
  const [origem,      setOrigem]      = useState(previsao?.origem || '');
  const [status,      setStatus]      = useState<StatusPrevisao>(previsao?.status || 'ativo');
  const [contatos,    setContatos]    = useState<ContatoItem[]>(
    previsao?.contatos?.length ? previsao.contatos : [{ id: genId(), tipo: 'telefone', valor: '' }]
  );
  const [showAddMenu, setShowAddMenu] = useState(false);

  /** Formata telefone/celular enquanto o usuário digita */
  function maskPhone(raw: string, tipo: ContatoItem['tipo']): string {
    if (tipo === 'email') return raw;
    const d = raw.replace(/\D/g, '');
    if (!d) return '';
    // Celular → (DD) 9NNNN-NNNN  (11 dígitos)
    // Telefone → (DD) NNNN-NNNN  (10 dígitos)
    const mobile = tipo === 'celular' || d.length === 11;
    if (d.length <= 2) return `(${d}`;
    if (mobile) {
      // (47) 99999-9999
      if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
      if (d.length <= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
      return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
    } else {
      // (47) 9999-9999
      if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
      return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6,10)}`;
    }
  }

  function addContato(tipo: ContatoItem['tipo']) {
    setContatos(prev => [...prev, { id: genId(), tipo, valor: '' }]);
    setShowAddMenu(false);
  }
  function removeContato(id: string) {
    setContatos(prev => prev.filter(c => c.id !== id));
  }
  function updateContato(id: string, raw: string) {
    setContatos(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, valor: maskPhone(raw, c.tipo) };
    }));
  }
  function changeTipo(id: string, tipo: ContatoItem['tipo']) {
    setContatos(prev => prev.map(c => {
      if (c.id !== id) return c;
      // Reformata o valor existente para o novo tipo
      return { ...c, tipo, valor: maskPhone(c.valor, tipo) };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { showToast('warning', 'Informe o nome'); return; }
    const data = {
      nome: nome.trim(),
      tipoPessoa,
      cpf:     tipoPessoa === 'PF' ? cpf  || undefined : undefined,
      cnpj:    tipoPessoa === 'PJ' ? cnpj || undefined : undefined,
      contatos: contatos.filter(c => c.valor.trim()),
      valorPrevisto: valor ? parseFloat(valor) : undefined,
      observacoes: obs || undefined,
      origem: origem || undefined,
      status,
    };
    try {
      if (isEdit) await previsoesApi.update(previsao!.id, data);
      else await previsoesApi.create(data);
      showToast('success', isEdit ? 'Previsão atualizada!' : 'Previsão registrada!', data.nome);
      onSave();
    } catch (err: any) {
      showToast('error', 'Erro ao salvar', err.message);
    }
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors focus:border-amber-500/40 outline-none";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
    <div className="flex justify-center p-4">
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <h2 className="font-playfair text-base font-bold text-[#f5f5f5]">
            {isEdit ? 'Editar Previsão' : 'Nova Previsão de Honorários'}
          </h2>
        </div>
        <button onClick={onClose} className="text-[#505050] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
      </div>

      <form id="previsao-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

        {/* ── Nome ── */}
        <div>
          <label className={labelClass}>Nome *</label>
          <input className={inputClass} value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome completo ou razão social" autoFocus />
        </div>

        {/* ── Tipo PF / PJ ── */}
        <div>
          <label className={labelClass}>Tipo de Pessoa</label>
          <div className="flex gap-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
            {(['PF', 'PJ'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setTipoPessoa(t)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${tipoPessoa === t ? 'bg-amber-500 text-black shadow-sm' : 'text-[#505050] hover:text-[#a0a0a0]'}`}>
                {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Documento (conditional) ── */}
        {tipoPessoa === 'PF' ? (
          <div>
            <label className={labelClass}>CPF</label>
            <input className={inputClass} value={cpf}
              onChange={e => { let v = e.target.value.replace(/\D/g,''); if(v.length<=11) v=formatCPF(v); setCpf(v); }}
              placeholder="000.000.000-00" maxLength={14} />
          </div>
        ) : (
          <div>
            <label className={labelClass}>CNPJ</label>
            <input className={inputClass} value={cnpj}
              onChange={e => { let v = e.target.value.replace(/\D/g,''); if(v.length<=14) v=formatCNPJ(v); setCnpj(v); }}
              placeholder="00.000.000/0000-00" maxLength={18} />
          </div>
        )}

        {/* ── Contatos dinâmicos ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>Contatos</label>

            {/* + add button */}
            <div className="relative">
              <button type="button"
                onClick={() => setShowAddMenu(v => !v)}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar
                <ChevronDown className="w-3 h-3" />
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-6 z-10 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                  {(Object.entries(TIPO_CONTATO_CONFIG) as [ContatoItem['tipo'], typeof TIPO_CONTATO_CONFIG[ContatoItem['tipo']]][]).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => addContato(k)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:bg-white/5 hover:text-[#f5f5f5] transition-colors">
                      <v.icon className="w-3.5 h-3.5" /> {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {contatos.map(c => {
              const cfg = TIPO_CONTATO_CONFIG[c.tipo];
              return (
                <div key={c.id} className="flex gap-2 items-center">
                  {/* Tipo — 3 icon pills, clean segmented control */}
                  <div className="flex gap-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5 shrink-0">
                    {(Object.entries(TIPO_CONTATO_CONFIG) as [ContatoItem['tipo'], typeof TIPO_CONTATO_CONFIG[ContatoItem['tipo']]][]).map(([k, v]) => (
                      <button
                        key={k}
                        type="button"
                        title={v.label}
                        onClick={() => changeTipo(c.id, k)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                          c.tipo === k
                            ? 'bg-amber-500 text-black shadow-sm'
                            : 'text-[#505050] hover:text-[#a0a0a0]'
                        }`}
                      >
                        <v.icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>

                  {/* Value input */}
                  <input
                    type={c.tipo === 'email' ? 'email' : 'text'}
                    inputMode={c.tipo === 'email' ? 'email' : 'numeric'}
                    value={c.valor}
                    onChange={e => updateContato(c.id, e.target.value)}
                    placeholder={
                      c.tipo === 'celular'  ? '(47) 99999-9999' :
                      c.tipo === 'telefone' ? '(47) 9999-9999'  :
                      'email@exemplo.com'
                    }
                    className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#404040] outline-none focus:border-amber-500/40 transition-colors"
                  />

                  {/* Remove — só aparece quando há mais de 1 */}
                  {contatos.length > 1 && (
                    <button type="button" onClick={() => removeContato(c.id)}
                      className="text-[#404040] hover:text-red-400 transition-colors p-1 shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Valor previsto ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Valor Previsto (R$)</label>
            <input type="number" className={inputClass} value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00" min="0" step="0.01" />
          </div>
          <div>
            <label className={labelClass}>Origem / Como chegou</label>
            <input className={inputClass} value={origem}
              onChange={e => setOrigem(e.target.value)}
              placeholder="indicação, site, anúncio..." />
          </div>
        </div>

        {/* ── Status ── */}
        <div>
          <label className={labelClass}>Status</label>
          <div className="flex gap-2">
            {(Object.entries(STATUS_CONFIG) as [StatusPrevisao, typeof STATUS_CONFIG[StatusPrevisao]][]).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setStatus(k)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                  status === k ? v.color : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#505050] hover:text-[#a0a0a0]'
                }`}>
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Observações ── */}
        <div>
          <label className={labelClass}>Observações</label>
          <textarea className={`${inputClass} resize-none`} rows={2} value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Interesse principal, contexto da conversa, próximos passos..." />
        </div>

      </form>

      {/* Footer */}
      <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">
          Cancelar
        </button>
        <button type="submit" form="previsao-form"
          className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
          {isEdit ? 'Salvar Alterações' : 'Registrar Previsão'}
        </button>
      </div>
    </div>
    </div>
    </div>
    </Portal>
  );
}

// ─── Converter em Cliente modal ───────────────────────────────

function ConverterModal({ previsao, onClose, onConverted }: {
  previsao: PrevisaoHonorario;
  onClose: () => void;
  onConverted: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function converter() {
    setLoading(true);
    try {
      // Create client from previsão data
      await clientesApi.create({
        tipoPessoa: previsao.tipoPessoa,
        nome: previsao.nome,
        cpf: previsao.cpf,
        cnpj: previsao.cnpj,
        email: previsao.contatos.find(c => c.tipo === 'email')?.valor || '',
        telefone: previsao.contatos.find(c => c.tipo === 'telefone' || c.tipo === 'celular')?.valor || '',
        celular:  previsao.contatos.find(c => c.tipo === 'celular')?.valor,
        status: 'ativo',
        endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
        observacoes: previsao.observacoes,
      } as any);
      // Mark previsão as fechado
      await previsoesApi.update(previsao.id, { status: 'fechado' });
      showToast('success', 'Cliente criado!', previsao.nome + ' foi adicionado à lista de clientes.');
      onConverted();
    } catch (err: any) {
      showToast('error', 'Erro ao converter', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title="Converter em Cliente"
      message={`Criar o cliente "${previsao.nome}" a partir desta previsão e marcar como Fechado?`}
      confirmLabel={loading ? 'Criando...' : 'Converter'}
      variant="success"
      onConfirm={converter}
      onCancel={onClose}
      loading={loading}
    />
  );
}

// ─── Página principal ─────────────────────────────────────────

export default function Previsao() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'assistente';

  const [previsoes, setPrevisoes] = useState<PrevisaoHonorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,       setSearch]       = usePersistedFilter('prev_search', '');
  const [filterStatus, setFilterStatus] = usePersistedFilter<StatusPrevisao | 'todos'>('prev_status', 'todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editPrevisao, setEditPrevisao] = useState<PrevisaoHonorario | undefined>();
  const [converterTarget, setConverterTarget] = useState<PrevisaoHonorario | null>(null);
  const undoDelete = useUndoDelete<PrevisaoHonorario>('Previsão');

  const reload = useCallback(async () => {
    setLoading(true);
    try { setPrevisoes(await previsoesApi.getAll()); }
    catch { showToast('error', 'Erro ao carregar previsões'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  // N → Nova previsão
  useEffect(() => {
    if (isReadOnly) return;
    function handle() { setEditPrevisao(undefined); setModalOpen(true); }
    window.addEventListener('msk:shortcut:novo', handle);
    return () => window.removeEventListener('msk:shortcut:novo', handle);
  }, [isReadOnly]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return previsoes.filter(p => {
      const matchSearch = !q || p.nome.toLowerCase().includes(q) ||
        (p.cpf || '').includes(q) || (p.cnpj || '').includes(q) ||
        p.contatos.some(c => c.valor.toLowerCase().includes(q));
      const matchStatus = filterStatus === 'todos' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [previsoes, search, filterStatus]);

  // KPIs
  const kpis = useMemo(() => ({
    total:   previsoes.length,
    ativos:  previsoes.filter(p => p.status === 'ativo').length,
    fechados: previsoes.filter(p => p.status === 'fechado').length,
    valorTotal: previsoes.filter(p => p.status === 'ativo').reduce((s, p) => s + (p.valorPrevisto || 0), 0),
  }), [previsoes]);

  function handleDelete(p: PrevisaoHonorario) {
    undoDelete(
      p,
      item => setPrevisoes(prev => prev.filter(x => x.id !== item.id)),
      item => setPrevisoes(prev => [...prev, item]),
      item => previsoesApi.remove(item.id).then(() => {}),
    );
  }

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Previsão de Honorários</h1>
          <p className="text-[#a0a0a0] text-sm">Prospectos e negociações em andamento</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => { setEditPrevisao(undefined); setModalOpen(true); }}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> Nova Previsão
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total',          value: kpis.total,    color: 'text-[#a0a0a0]',  bg: 'bg-[#1e1e1e]' },
          { label: 'Em negociação',  value: kpis.ativos,   color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Fechados',       value: kpis.fechados, color: 'text-green-400',   bg: 'bg-green-500/10' },
          { label: 'Valor previsto', value: formatCurrency(kpis.valorTotal), color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-[#2a2a2a] rounded-xl p-4`}>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-[#505050] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050]" />
          <input
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]"
            placeholder="Buscar por nome, CPF/CNPJ ou contato..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#f5f5f5]"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
          {([['todos', 'Todos'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setFilterStatus(k as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterStatus === k ? 'bg-amber-500 text-black shadow-sm' : 'text-[#505050] hover:text-[#a0a0a0]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#505050]">
          <Target className="w-12 h-12 opacity-30" />
          <p className="text-sm">{search || filterStatus !== 'todos' ? 'Nenhum resultado encontrado' : 'Nenhuma previsão registrada'}</p>
          {!isReadOnly && !search && filterStatus === 'todos' && (
            <button onClick={() => setModalOpen(true)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
              Registrar primeira previsão →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => {
            const sc = STATUS_CONFIG[p.status];
            const StatusIcon = sc.icon;
            return (
              <div key={p.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-all group">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#f5f5f5] truncate">{p.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-[#2a2a2a] text-[#505050] px-1.5 py-0.5 rounded">{p.tipoPessoa}</span>
                      {(p.cpf || p.cnpj) && (
                        <span className="text-[10px] text-[#404040] font-mono">{p.cpf || p.cnpj}</span>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${sc.color}`}>
                    <StatusIcon className="w-3 h-3" /> {sc.label}
                  </span>
                </div>

                {/* Contacts */}
                {p.contatos.filter(c => c.valor).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.contatos.filter(c => c.valor).map(c => {
                      const cc = TIPO_CONTATO_CONFIG[c.tipo];
                      return (
                        <span key={c.id} className="flex items-center gap-1 text-[10px] text-[#505050] bg-[#1e1e1e] px-2 py-0.5 rounded-full">
                          <cc.icon className="w-3 h-3" /> {c.valor}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Value + origin */}
                <div className="flex items-center justify-between text-xs">
                  {p.valorPrevisto ? (
                    <span className="text-amber-400 font-semibold">{formatCurrency(p.valorPrevisto)}</span>
                  ) : (
                    <span className="text-[#404040]">Valor não informado</span>
                  )}
                  {p.origem && <span className="text-[#505050] truncate max-w-[120px]" title={p.origem}>{p.origem}</span>}
                </div>

                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#1e1e1e] opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isReadOnly && p.status === 'ativo' && (
                    <button
                      onClick={() => setConverterTarget(p)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg transition-colors"
                      title="Converter em cliente"
                    >
                      <UserPlus className="w-3 h-3" /> Converter
                    </button>
                  )}
                  {!isReadOnly && (
                    <button onClick={() => { setEditPrevisao(p); setModalOpen(true); }}
                      className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors ml-auto">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isReadOnly && (
                    <button onClick={() => handleDelete(p)}
                      className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* Date */}
                  <span className="text-[10px] text-[#404040] ml-auto">
                    {new Date(p.criadoEm).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <PrevisaoModal
          previsao={editPrevisao}
          onClose={() => { setModalOpen(false); setEditPrevisao(undefined); }}
          onSave={() => { reload(); setModalOpen(false); setEditPrevisao(undefined); }}
        />
      )}
      {converterTarget && (
        <ConverterModal
          previsao={converterTarget}
          onClose={() => setConverterTarget(null)}
          onConverted={() => { reload(); setConverterTarget(null); }}
        />
      )}
    </div>
  );
}
