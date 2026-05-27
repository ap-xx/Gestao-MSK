import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Search, X, Building2, User, Users, Loader2,
  MapPin, Phone, Mail, Edit2, Trash2, CheckCircle, AlertCircle, Eye,
} from 'lucide-react';
import { clientesApi } from '../services/api';
import { consultarCNPJ, consultarCEP, formatCNPJ, formatCPF, formatCEP, formatTelefone, validarCNPJ, validarCPF } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import Portal from '../components/ui/Portal';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import type { Cliente, TipoPessoa, StatusCliente } from '../types';

const STATUS_BADGE: Record<StatusCliente, string> = {
  ativo: 'bg-green-500/15 text-green-400 border-green-500/30',
  inativo: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  bloqueado: 'bg-red-500/15 text-red-400 border-red-500/30',
};
const STATUS_LABELS: Record<StatusCliente, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  bloqueado: 'Bloqueado',
};

// ─── Modal de cadastro/edição ──────────────────────────────────
interface ModalProps {
  cliente?: Cliente;
  onClose: () => void;
  onSave: (c: Omit<Cliente, 'id'> | Cliente) => void;
}

function ClienteModal({ cliente, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
  const isEdit = !!cliente;

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>(cliente?.tipoPessoa || 'PF');
  const [form, setForm] = useState({
    nome: cliente?.nome || '',
    cpf: cliente?.cpf || '',
    cnpj: cliente?.cnpj || '',
    razaoSocial: cliente?.razaoSocial || '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    celular: cliente?.celular || '',
    status: (cliente?.status || 'ativo') as StatusCliente,
    observacoes: cliente?.observacoes || '',
    // Endereço
    cep: cliente?.endereco.cep || '',
    logradouro: cliente?.endereco.logradouro || '',
    numero: cliente?.endereco.numero || '',
    complemento: cliente?.endereco.complemento || '',
    bairro: cliente?.endereco.bairro || '',
    cidade: cliente?.endereco.cidade || '',
    uf: cliente?.endereco.uf || '',
    // PJ extras
    porte: cliente?.porte || '',
    naturezaJuridica: cliente?.naturezaJuridica || '',
    capitalSocial: cliente?.capitalSocial || '',
  });

  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [socios, setSocios] = useState(cliente?.socios || []);

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function buscarCNPJ() {
    const cnpjLimpo = form.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      showToast('warning', 'CNPJ inválido', 'Digite os 14 dígitos do CNPJ.');
      return;
    }
    if (!validarCNPJ(form.cnpj)) {
      showToast('warning', 'CNPJ inválido', 'Os dígitos verificadores não são válidos.');
      setCnpjStatus('error');
      return;
    }
    setLoadingCNPJ(true);
    setCnpjStatus('idle');
    try {
      const data = await consultarCNPJ(form.cnpj);
      const est = data.estabelecimento;
      setForm(prev => ({
        ...prev,
        nome: data.razao_social,
        razaoSocial: data.razao_social,
        email: est.email || prev.email,
        telefone: est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : prev.telefone,
        porte: data.porte?.descricao || '',
        naturezaJuridica: data.natureza_juridica?.descricao || '',
        capitalSocial: data.capital_social ? `R$ ${parseFloat(data.capital_social).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
        cep: est.cep ? est.cep.replace(/\D/g, '') : prev.cep,
        logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ') || prev.logradouro,
        numero: est.numero || prev.numero,
        complemento: est.complemento || prev.complemento,
        bairro: est.bairro || prev.bairro,
        cidade: est.municipio?.descricao || prev.cidade,
        uf: est.estado?.sigla || prev.uf,
      }));
      setSocios(data.socios?.map(s => ({ nome: s.nome, qualificacao: s.qualificacao_socio?.descricao || '' })) || []);
      setCnpjStatus('ok');
      showToast('success', 'CNPJ encontrado!', `${data.razao_social} — dados preenchidos automaticamente.`);
    } catch (err: any) {
      setCnpjStatus('error');
      showToast('error', 'Erro ao buscar CNPJ', err.message);
    } finally {
      setLoadingCNPJ(false);
    }
  }

  async function buscarCEP() {
    const cepLimpo = form.cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;
    setLoadingCEP(true);
    try {
      const data = await consultarCEP(form.cep);
      setForm(prev => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
        complemento: data.complemento || prev.complemento,
      }));
      showToast('success', 'CEP encontrado!', `${data.logradouro}, ${data.bairro} — ${data.localidade}/${data.uf}`);
    } catch (err: any) {
      showToast('error', 'CEP não encontrado', err.message);
    } finally {
      setLoadingCEP(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const saved: Omit<Cliente, 'id'> & { id?: string } = {
      ...(cliente?.id ? { id: cliente.id } : {}),
      tipoPessoa,
      nome: form.nome,
      cpf: tipoPessoa === 'PF' ? form.cpf : undefined,
      cnpj: tipoPessoa === 'PJ' ? form.cnpj : undefined,
      razaoSocial: tipoPessoa === 'PJ' ? form.razaoSocial : undefined,
      email: form.email,
      telefone: form.telefone,
      celular: form.celular || undefined,
      status: form.status,
      observacoes: form.observacoes || undefined,
      endereco: {
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento || undefined,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
      },
      porte: form.porte || undefined,
      naturezaJuridica: form.naturezaJuridica || undefined,
      capitalSocial: form.capitalSocial || undefined,
      socios: socios.length > 0 ? socios : undefined,
      criadoEm: cliente?.criadoEm || now,
      atualizadoEm: now,
    };
    onSave(saved as any);
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="cliente-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Tipo de pessoa */}
          <div className="flex gap-3">
            {(['PF', 'PJ'] as TipoPessoa[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoPessoa(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  tipoPessoa === t
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#a0a0a0] hover:border-[#3a3a3a]'
                }`}
              >
                {t === 'PF' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              </button>
            ))}
          </div>

          {/* Documento */}
          {tipoPessoa === 'PJ' ? (
            <div>
              <label className={labelClass}>CNPJ *</label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={form.cnpj}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 14) val = formatCNPJ(val);
                    set('cnpj', val);
                    setCnpjStatus('idle');
                  }}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
                <button
                  type="button"
                  onClick={buscarCNPJ}
                  disabled={loadingCNPJ}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {loadingCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar
                </button>
              </div>
              {cnpjStatus === 'ok' && (
                <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3" /> Dados preenchidos com sucesso
                </p>
              )}
              {cnpjStatus === 'error' && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> Não foi possível buscar o CNPJ
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className={labelClass}>CPF *</label>
              <input
                className={inputClass}
                value={form.cpf}
                onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 11) val = formatCPF(val);
                  set('cpf', val);
                }}
                placeholder="000.000.000-00"
                maxLength={14}
              />
              {form.cpf.replace(/\D/g, '').length === 11 && (
                validarCPF(form.cpf)
                  ? <p className="text-xs text-green-400 flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" /> CPF válido</p>
                  : <p className="text-xs text-red-400 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" /> CPF inválido</p>
              )}
            </div>
          )}

          {/* Nome / Razão Social */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>{tipoPessoa === 'PJ' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}</label>
              <input className={inputClass} value={form.nome} onChange={e => set('nome', e.target.value)} required placeholder={tipoPessoa === 'PJ' ? 'Razão social da empresa' : 'Nome completo do cliente'} />
            </div>
            {tipoPessoa === 'PJ' && (
              <div>
                <label className={labelClass}>Razão Social completa</label>
                <input className={inputClass} value={form.razaoSocial} onChange={e => set('razaoSocial', e.target.value)} placeholder="Razão social completa" />
              </div>
            )}
          </div>

          {/* Contato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>E-mail *</label>
              <input type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} required placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className={labelClass}>Telefone *</label>
              <input className={inputClass} value={form.telefone} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                set('telefone', formatTelefone(val));
              }} required placeholder="(00) 00000-0000" maxLength={15} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Celular / WhatsApp</label>
              <input className={inputClass} value={form.celular} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                set('celular', formatTelefone(val));
              }} placeholder="(00) 00000-0000" maxLength={15} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-sm font-semibold text-[#a0a0a0] mb-3 border-b border-[#2a2a2a] pb-2">Endereço</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelClass}>CEP</label>
                  <input
                    className={inputClass}
                    value={form.cep}
                    onChange={e => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 8) set('cep', formatCEP(val));
                    }}
                    onBlur={() => { if (form.cep.replace(/\D/g, '').length === 8) buscarCEP(); }}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <button
                  type="button"
                  onClick={buscarCEP}
                  disabled={loadingCEP}
                  className="self-end flex items-center gap-2 px-4 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] text-sm rounded-lg transition-colors whitespace-nowrap"
                >
                  {loadingCEP ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Buscar CEP
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Logradouro</label>
                  <input className={inputClass} value={form.logradouro} onChange={e => set('logradouro', e.target.value)} placeholder="Rua, Av., etc." />
                </div>
                <div>
                  <label className={labelClass}>Número</label>
                  <input className={inputClass} value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="Nº" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Complemento</label>
                  <input className={inputClass} value={form.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Apto, sala, bloco..." />
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input className={inputClass} value={form.bairro} onChange={e => set('bairro', e.target.value)} placeholder="Bairro" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Cidade</label>
                  <input className={inputClass} value={form.cidade} onChange={e => set('cidade', e.target.value)} placeholder="Cidade" />
                </div>
                <div>
                  <label className={labelClass}>UF</label>
                  <input className={inputClass} value={form.uf} onChange={e => set('uf', e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
                </div>
              </div>
            </div>
          </div>

          {/* PJ extras */}
          {tipoPessoa === 'PJ' && (
            <div>
              <h3 className="text-sm font-semibold text-[#a0a0a0] mb-3 border-b border-[#2a2a2a] pb-2">Dados Empresariais</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Porte</label>
                  <input className={inputClass} value={form.porte} onChange={e => set('porte', e.target.value)} placeholder="MEI, ME, EPP, Médio, Grande" />
                </div>
                <div>
                  <label className={labelClass}>Capital Social</label>
                  <input className={inputClass} value={form.capitalSocial} onChange={e => set('capitalSocial', e.target.value)} placeholder="R$ 0,00" />
                </div>
              </div>
              <div className="mt-3">
                <label className={labelClass}>Natureza Jurídica</label>
                <input className={inputClass} value={form.naturezaJuridica} onChange={e => set('naturezaJuridica', e.target.value)} placeholder="Sociedade Empresária Limitada, S/A, etc." />
              </div>
              {socios.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-[#a0a0a0] mb-2">Sócios</p>
                  <div className="space-y-1">
                    {socios.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-[#1e1e1e] rounded px-3 py-2">
                        <span className="text-[#f5f5f5] font-medium flex-1">{s.nome}</span>
                        <span className="text-[#a0a0a0]">{s.qualificacao}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          <div>
            <label className={labelClass}>Observações</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Observações sobre o cliente..." />
          </div>

        </form>

        {/* Sticky footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">
            Cancelar
          </button>
          <button type="submit" form="cliente-form" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
            {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </button>
        </div>
      </div>
      </div>
    </div>
    </Portal>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function Clientes() {
  const { showToast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | undefined>();
  const [viewCliente, setViewCliente] = useState<Cliente | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete,    setToDelete]    = useState<Cliente | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setClientes(await clientesApi.getAll());
    } catch {
      showToast('error', 'Erro', 'Não foi possível carregar clientes');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    return clientes.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.nome.toLowerCase().includes(q) ||
        (c.cpf || '').includes(q) || (c.cnpj || '').includes(q) ||
        c.email.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
      const matchTipo = filterTipo === 'todos' || c.tipoPessoa === filterTipo;
      return matchSearch && matchStatus && matchTipo;
    });
  }, [clientes, search, filterStatus, filterTipo]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'nome');
  const pagination = usePagination(sorted, 15);

  async function handleSave(c: Omit<Cliente, 'id'> | Cliente) {
    try {
      if (editCliente) {
        await clientesApi.update(editCliente.id, c);
      } else {
        await clientesApi.create(c as Omit<Cliente, 'id'>);
      }
      await reload();
      setModalOpen(false);
      setEditCliente(undefined);
      showToast('success', editCliente ? 'Cliente atualizado!' : 'Cliente cadastrado!', (c as any).nome);
    } catch (err: any) {
      showToast('error', 'Erro ao salvar', err.message);
    }
  }

  function handleDelete(c: Cliente) {
    setToDelete(c);
    setConfirmOpen(true);
  }

  async function doDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await clientesApi.remove(toDelete.id);
      await reload();
      showToast('info', 'Cliente removido', toDelete.nome);
    } catch (err: any) {
      showToast('error', 'Erro ao excluir', err.message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setToDelete(null);
    }
  }

  const SortIcon = ({ col }: { col: keyof Cliente }) => (
    <span className="ml-1 opacity-60">{sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Clientes</h1>
          <p className="text-[#a0a0a0] text-sm">{filtered.length} clientes encontrados</p>
        </div>
        <button
          onClick={() => { setEditCliente(undefined); setModalOpen(true); }}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050]" />
          <input
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]"
            placeholder="Buscar por nome, CPF, CNPJ ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#f5f5f5]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="bloqueado">Bloqueados</option>
        </select>

        <select
          className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm"
          value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
        >
          <option value="todos">PF + PJ</option>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th
                  onClick={() => toggle('nome')}
                  className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]"
                >
                  Cliente <SortIcon col="nome" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell">Documento</th>
                <th
                  onClick={() => toggle('email')}
                  className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell cursor-pointer select-none hover:text-[#a0a0a0]"
                >
                  Contato <SortIcon col="email" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell">Cidade/UF</th>
                <th
                  onClick={() => toggle('status')}
                  className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]"
                >
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
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum cliente encontrado</p>
                  </td>
                </tr>
              ) : (
                pagination.items.map(c => (
                  <tr key={c.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.tipoPessoa === 'PJ' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {c.tipoPessoa === 'PJ' ? <Building2 className="w-4 h-4" /> : c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[#f5f5f5] leading-tight">{c.nome}</p>
                          <p className="text-xs text-[#505050]">{c.tipoPessoa}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-[#a0a0a0] font-mono text-xs">{c.cpf || c.cnpj || '—'}</span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div>
                        <p className="text-[#a0a0a0] text-xs flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {c.email}
                        </p>
                        <p className="text-[#505050] text-xs flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {c.telefone}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-[#a0a0a0] text-xs">
                        {c.endereco.cidade}/{c.endereco.uf}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewCliente(c)}
                          className="p-1.5 text-[#505050] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditCliente(c); setModalOpen(true); }}
                          className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </div>

      {/* Modal cadastro/edição */}
      {modalOpen && (
        <ClienteModal
          cliente={editCliente}
          onClose={() => { setModalOpen(false); setEditCliente(undefined); }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir Cliente"
        message={`Tem certeza que deseja excluir "${toDelete?.nome}"? Esta ação não pode ser desfeita.`}
        onConfirm={doDelete}
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
        loading={deleting}
      />

      {/* Modal visualização */}
      {viewCliente && (
        <Portal>
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
          <div className="flex justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">{viewCliente.nome}</h2>
              <button onClick={() => setViewCliente(null)} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-[#505050]">Tipo</p><p className="text-[#f5f5f5]">{viewCliente.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</p></div>
                <div><p className="text-xs text-[#505050]">Documento</p><p className="text-[#f5f5f5] font-mono">{viewCliente.cpf || viewCliente.cnpj || '—'}</p></div>
                <div><p className="text-xs text-[#505050]">E-mail</p><p className="text-[#f5f5f5]">{viewCliente.email}</p></div>
                <div><p className="text-xs text-[#505050]">Telefone</p><p className="text-[#f5f5f5]">{viewCliente.telefone}</p></div>
                <div><p className="text-xs text-[#505050]">Status</p><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[viewCliente.status]}`}>{STATUS_LABELS[viewCliente.status]}</span></div>
                <div><p className="text-xs text-[#505050]">Cidade/UF</p><p className="text-[#f5f5f5]">{viewCliente.endereco.cidade}/{viewCliente.endereco.uf}</p></div>
              </div>
              {viewCliente.tipoPessoa === 'PJ' && (
                <div className="border-t border-[#2a2a2a] pt-4 grid grid-cols-2 gap-4">
                  {viewCliente.porte && <div><p className="text-xs text-[#505050]">Porte</p><p className="text-[#f5f5f5]">{viewCliente.porte}</p></div>}
                  {viewCliente.capitalSocial && <div><p className="text-xs text-[#505050]">Capital Social</p><p className="text-[#f5f5f5]">{viewCliente.capitalSocial}</p></div>}
                  {viewCliente.naturezaJuridica && <div className="col-span-2"><p className="text-xs text-[#505050]">Natureza Jurídica</p><p className="text-[#f5f5f5]">{viewCliente.naturezaJuridica}</p></div>}
                </div>
              )}
              {viewCliente.socios && viewCliente.socios.length > 0 && (
                <div className="border-t border-[#2a2a2a] pt-4">
                  <p className="text-xs text-[#505050] mb-2">Sócios</p>
                  {viewCliente.socios.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs py-1">
                      <span className="text-[#f5f5f5]">{s.nome}</span>
                      <span className="text-[#a0a0a0]">{s.qualificacao}</span>
                    </div>
                  ))}
                </div>
              )}
              {viewCliente.observacoes && (
                <div className="border-t border-[#2a2a2a] pt-4">
                  <p className="text-xs text-[#505050] mb-1">Observações</p>
                  <p className="text-[#a0a0a0]">{viewCliente.observacoes}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
              <button onClick={() => { setViewCliente(null); setEditCliente(viewCliente); setModalOpen(true); }} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors">
                Editar
              </button>
              <button onClick={() => setViewCliente(null)} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">
                Fechar
              </button>
            </div>
          </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
