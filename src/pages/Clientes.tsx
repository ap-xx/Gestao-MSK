import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, Search, X, Building2, User, Users, Loader2,
  MapPin, Phone, Mail, Edit2, Trash2, CheckCircle, AlertCircle, Eye,
  Star, Paperclip, FileText, Download, Upload, Gavel, CheckSquare, Square,
} from 'lucide-react';
import { clientesApi, processosApi, documentosApi } from '../services/api';
import type { Documento } from '../services/api';
import { consultarCNPJ, consultarCEP, formatCNPJ, formatCPF, formatCEP, formatTelefone, validarCNPJ, validarCPF } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { downloadCsv, fmtCsvDate } from '../utils/exportCsv';
import { usePersistedFilter } from '../hooks/usePersistedFilter';
import { useUndoDelete } from '../hooks/useUndoDelete';
import { useCtrlSave } from '../hooks/useCtrlSave';
import ImportCsvModal from '../components/ImportCsvModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import Portal from '../components/ui/Portal';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import type { Cliente, TipoPessoa, StatusCliente, Processo } from '../types';

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

// ─── Star Rating ──────────────────────────────────────────────
function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(i === value ? 0 : i)}
          onMouseEnter={() => !readOnly && setHovered(i)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={`transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <Star
            className={`w-4 h-4 ${
              i <= (hovered || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-[#3a3a3a]'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Documentos do Cliente ─────────────────────────────────────
function ClienteDocumentosSection({ clienteId }: { clienteId: string }) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'assistente';
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDocs(await documentosApi.getByEntidade('cliente', clienteId));
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [clienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('error', 'Arquivo muito grande', 'Máximo 5 MB'); return; }
    setUploading(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const b64 = (ev.target!.result as string).split(',')[1];
            await documentosApi.create({ entidade: 'cliente', entidadeId: clienteId, nome: file.name, tipo: file.type || 'application/octet-stream', conteudo: b64 });
            showToast('success', 'Documento anexado!');
            await carregar();
            resolve();
          } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (err: any) { showToast('error', 'Erro ao enviar', err.message); }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function handleDownload(doc: Documento) {
    try {
      const r = await documentosApi.download(doc.id);
      const a = document.createElement('a'); a.href = `data:${r.tipo};base64,${r.conteudo}`; a.download = r.nome; a.click();
    } catch { showToast('error', 'Erro ao baixar'); }
  }

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  return (
    <div className="border-t border-[#2a2a2a] pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#505050] font-medium uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" /> Documentos ({docs.length})
        </p>
        {!isReadOnly && (
          <label className={`text-xs flex items-center gap-1 cursor-pointer transition-colors ${uploading ? 'text-amber-500' : 'text-amber-400 hover:text-amber-300'}`}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Anexar
            <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-amber-500" /></div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-[#505050] text-center py-3">Nenhum documento anexado</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 bg-[#1e1e1e] rounded-lg px-3 py-2 text-xs">
              <FileText className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-[#a0a0a0] flex-1 truncate" title={doc.nome}>{doc.nome}</span>
              <span className="text-[#505050] shrink-0">{fmtSize(doc.tamanho)}</span>
              <button onClick={() => handleDownload(doc)} className="p-1 text-[#505050] hover:text-blue-400 transition-colors"><Download className="w-3 h-3" /></button>
              {!isReadOnly && <button onClick={async () => { await documentosApi.remove(doc.id); carregar(); }} className="p-1 text-[#505050] hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Processos do Cliente ──────────────────────────────────────
function ClienteProcessosSection({ clienteId }: { clienteId: string }) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  useEffect(() => {
    processosApi.getAll()
      .then(all => setProcessos(all.filter(p => p.clienteId === clienteId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clienteId]);

  const filtrados = useMemo(() => {
    if (filtroStatus === 'todos') return processos;
    return processos.filter(p => p.status === filtroStatus);
  }, [processos, filtroStatus]);

  const statusColors: Record<string, string> = {
    ativo: 'text-green-400 bg-green-500/10',
    suspenso: 'text-amber-400 bg-amber-500/10',
    encerrado: 'text-red-400 bg-red-500/10',
    arquivado: 'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="border-t border-[#2a2a2a] pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#505050] font-medium uppercase tracking-wider flex items-center gap-1.5">
          <Gavel className="w-3 h-3" /> Processos ({processos.length})
        </p>
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          className="bg-[#1e1e1e] border border-[#2a2a2a] rounded text-[10px] text-[#a0a0a0] px-2 py-1"
        >
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="suspenso">Suspensos</option>
          <option value="encerrado">Encerrados</option>
          <option value="arquivado">Arquivados</option>
        </select>
      </div>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-amber-500" /></div>
      ) : filtrados.length === 0 ? (
        <p className="text-xs text-[#505050] text-center py-3">Nenhum processo encontrado</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {filtrados.map(p => (
            <div key={p.id} className="flex items-start gap-2 bg-[#1e1e1e] rounded-lg px-3 py-2 text-xs">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[p.status] ?? 'text-gray-400 bg-gray-500/10'}`}>
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[#f5f5f5] font-mono truncate">{p.numeroCNJ}</p>
                <p className="text-[#505050]">{p.areaAtuacao} · {p.fase}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal de cadastro/edição ──────────────────────────────────
interface ModalProps {
  cliente?: Cliente;
  onClose: () => void;
  onSave: (c: Omit<Cliente, 'id'> | Cliente) => void;
}

function ClienteModal({ cliente, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
  const isEdit = !!cliente;
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  // Ctrl+S salva o formulário
  useCtrlSave(() => document.getElementById('cliente-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

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

  async function checkDuplicate(doc: string) {
    if (!doc || isEdit) return;
    const digits = doc.replace(/\D/g, '');
    if (digits.length < 11) return;
    const all = await clientesApi.getAll();
    const dup = all.find(c => {
      const cd = (c.cpf || c.cnpj || '').replace(/\D/g, '');
      return cd === digits;
    });
    setDupWarning(dup ? `⚠️ Já existe um cliente com este documento: "${dup.nome}"` : null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const saved: Omit<Cliente, 'id'> & { id?: string } = {
      ...(cliente?.id ? { id: cliente.id } : {}),
      tipoPessoa,
      avaliacao: cliente?.avaliacao, // preserve existing rating set from the table column
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
                    setDupWarning(null);
                  }}
                  onBlur={e => checkDuplicate(e.target.value)}
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
              {dupWarning && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {dupWarning}
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
                onBlur={e => checkDuplicate(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={14}
              />
              {dupWarning && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {dupWarning}
                </p>
              )}
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
              <label className={labelClass}>E-mail</label>
              <input type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input className={inputClass} value={form.telefone} onChange={e => {
                let val = e.target.value.replace(/\D/g, '');
                set('telefone', formatTelefone(val));
              }} placeholder="(00) 00000-0000" maxLength={15} />
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
  const { user } = useAuth();
  const isReadOnly = user?.role === 'assistente';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,        setSearch]       = usePersistedFilter('cli_search', '');
  const [filterStatus,  setFilterStatus] = usePersistedFilter<string>('cli_status', 'todos');
  const [filterTipo,    setFilterTipo]   = usePersistedFilter<string>('cli_tipo', 'todos');
  const [pageSize,      setPageSize]     = usePersistedFilter<number>('cli_pagesize', 15);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | undefined>();
  const [viewCliente, setViewCliente] = useState<Cliente | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const undoDelete = useUndoDelete<Cliente>('Cliente');

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

  // Cross-reference: processos e lançamentos pendentes por cliente
  const [processos, setProcessos] = useState<import('../types').Processo[]>([]);
  const [lancamentos, setLancamentos] = useState<import('../types').Lancamento[]>([]);
  useEffect(() => {
    Promise.all([processosApi.getAll(), import('../services/api').then(m => m.lancamentosApi.getAll())])
      .then(([p, l]) => { setProcessos(p); setLancamentos(l); })
      .catch(() => {});
  }, []);

  const clienteStats = useMemo(() => {
    const map: Record<string, { processos: number; pendente: number }> = {};
    processos.forEach(p => {
      if (!map[p.clienteId]) map[p.clienteId] = { processos: 0, pendente: 0 };
      if (p.status === 'ativo') map[p.clienteId].processos++;
    });
    lancamentos.forEach(l => {
      if (!l.clienteId) return;
      if (!map[l.clienteId]) map[l.clienteId] = { processos: 0, pendente: 0 };
      if (l.tipo === 'a_receber' && (l.status === 'pendente' || l.status === 'vencido')) {
        map[l.clienteId].pendente += l.valor;
      }
    });
    return map;
  }, [processos, lancamentos]);

  // Atalho de teclado: N → Novo Cliente
  useEffect(() => {
    if (isReadOnly) return;
    function handle() { setEditCliente(undefined); setModalOpen(true); }
    window.addEventListener('msk:shortcut:novo', handle);
    return () => window.removeEventListener('msk:shortcut:novo', handle);
  }, [isReadOnly]);

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
  const pagination = usePagination(sorted, pageSize);

  // ── Bulk delete ──────────────────────────────────────────────
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => clientesApi.remove(id)));
      await reload();
      setSelectedIds(new Set());
      showToast('success', `${selectedIds.size} cliente(s) excluído(s)`);
    } catch {
      showToast('error', 'Erro ao excluir selecionados');
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === pagination.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagination.items.map(c => c.id)));
    }
  }

  // ── CSV import handler ───────────────────────────────────────
  async function handleCsvImport(rows: Record<string, string>[]) {
    const existing = await clientesApi.getAll();
    const existingDocs = new Set([
      ...existing.map(c => c.cpf).filter(Boolean),
      ...existing.map(c => c.cnpj).filter(Boolean),
    ]);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const nome = row['nome']?.trim();
      if (!nome) { errors.push(`Linha sem nome: ${JSON.stringify(row)}`); continue; }

      const doc = (row['cpf'] || row['cnpj'] || '').replace(/\D/g, '');
      if (doc && existingDocs.has(doc)) { skipped++; continue; }

      try {
        await clientesApi.create({
          tipoPessoa: (row['tipo']?.toLowerCase().includes('j') ? 'PJ' : 'PF') as TipoPessoa,
          nome,
          cpf:      row['cpf']  || undefined,
          cnpj:     row['cnpj'] || undefined,
          email:    row['email'] || '',
          telefone: row['telefone'] || undefined,
          celular:  row['celular']  || undefined,
          status:   'ativo' as const,
          observacoes: row['observacoes'] || undefined,
          endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
        } as unknown as Omit<Cliente, 'id'>);
        if (doc) existingDocs.add(doc);
        imported++;
      } catch (e: any) {
        errors.push(`${nome}: ${e.message}`);
      }
    }
    await reload();
    return { imported, skipped, errors };
  }

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

  // Auto-save star rating without opening a modal
  async function updateAvaliacao(clienteId: string, value: number) {
    try {
      await clientesApi.update(clienteId, { avaliacao: value });
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, avaliacao: value } : c));
    } catch {
      showToast('error', 'Erro ao salvar avaliação');
    }
  }

  function handleDelete(c: Cliente) {
    undoDelete(
      c,
      // Remove from UI immediately
      item => setClientes(prev => prev.filter(x => x.id !== item.id)),
      // Restore on undo
      item => setClientes(prev => [...prev, item].sort((a, b) => a.nome.localeCompare(b.nome))),
      // Confirm delete
      item => clientesApi.remove(item.id).then(() => {}),
    );
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
        <div className={`${isReadOnly ? 'ml-auto' : ''} flex items-center gap-2`}>
          <button
            onClick={() => downloadCsv(
              `clientes_${new Date().toISOString().slice(0,10)}.csv`,
              ['Nome', 'Tipo', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Status', 'Cadastro'],
              sorted.map(c => [
                c.nome, c.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica',
                c.cpf || c.cnpj || '', c.email, c.telefone || '', c.status,
                fmtCsvDate(c.criadoEm as string | undefined),
              ]),
            )}
            className="flex items-center gap-2 px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-green-500/30 text-[#a0a0a0] hover:text-green-400 rounded-lg text-sm font-medium transition-all"
            title="Exportar lista filtrada para CSV"
          >
            <FileText className="w-4 h-4" />
            Exportar CSV
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-blue-500/30 text-[#a0a0a0] hover:text-blue-400 rounded-lg text-sm font-medium transition-all"
                title="Importar clientes de arquivo CSV"
              >
                <Upload className="w-4 h-4" />
                Importar CSV
              </button>
              <button
                onClick={() => { setEditCliente(undefined); setModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                Novo Cliente
              </button>
            </>
          )}
        </div>
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

        {/* Page size */}
        <select
          className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm"
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          title="Itens por página"
        >
          <option value={15}>15 por página</option>
          <option value={30}>30 por página</option>
          <option value={50}>50 por página</option>
          <option value={100}>100 por página</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && !isReadOnly && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <span className="text-sm text-amber-400 font-medium">{selectedIds.size} selecionado(s)</span>
          <button
            onClick={() => downloadCsv(
              `clientes_selecionados.csv`,
              ['Nome', 'Tipo', 'CPF/CNPJ', 'E-mail', 'Status'],
              sorted.filter(c => selectedIds.has(c.id)).map(c => [
                c.nome, c.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica',
                c.cpf || c.cnpj || '', c.email, c.status,
              ]),
            )}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-green-500/30 text-[#a0a0a0] hover:text-green-400 rounded-lg text-xs font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> {bulkDeleting ? 'Excluindo…' : 'Excluir'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-[#505050] hover:text-[#a0a0a0]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {!isReadOnly && (
                  <th className="px-3 py-3.5 w-10">
                    <button onClick={toggleSelectAll} className="text-[#505050] hover:text-amber-400 transition-colors">
                      {selectedIds.size === pagination.items.length && pagination.items.length > 0
                        ? <CheckSquare className="w-4 h-4 text-amber-400" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
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
                <th className="px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Avaliação</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {loading ? (
                <LoadingTable cols={7} />
              ) : pagination.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#505050]">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum cliente encontrado</p>
                  </td>
                </tr>
              ) : (
                pagination.items.map(c => (
                  <tr key={c.id} className={`hover:bg-[#1a1a1a] transition-colors ${selectedIds.has(c.id) ? 'bg-amber-500/5' : ''}`}>
                    {!isReadOnly && (
                      <td className="px-3 py-4 w-10">
                        <button onClick={() => toggleSelect(c.id)} className="text-[#505050] hover:text-amber-400 transition-colors">
                          {selectedIds.has(c.id) ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${c.tipoPessoa === 'PJ' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {c.tipoPessoa === 'PJ' ? <Building2 className="w-4 h-4" /> : c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[#f5f5f5] leading-tight">{c.nome}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-xs text-[#505050]">{c.tipoPessoa}</span>
                            {clienteStats[c.id]?.processos > 0 && (
                              <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                                {clienteStats[c.id].processos}p
                              </span>
                            )}
                            {clienteStats[c.id]?.pendente > 0 && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full" title="Valor pendente">
                                {clienteStats[c.id].pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
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
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-fit ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StarRating
                        value={c.avaliacao ?? 0}
                        onChange={v => updateAvaliacao(c.id, v)}
                      />
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
                        {!isReadOnly && (
                          <button
                            onClick={() => { setEditCliente(c); setModalOpen(true); }}
                            className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {!isReadOnly && (
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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

      {importOpen && (
        <ImportCsvModal
          title="Importar Clientes via CSV"
          fields={[
            { key: 'nome',       label: 'Nome',           required: true },
            { key: 'tipo',       label: 'Tipo (PF/PJ)' },
            { key: 'cpf',        label: 'CPF' },
            { key: 'cnpj',       label: 'CNPJ' },
            { key: 'email',      label: 'E-mail' },
            { key: 'telefone',   label: 'Telefone' },
            { key: 'celular',    label: 'Celular' },
            { key: 'observacoes',label: 'Observações' },
          ]}
          onImport={handleCsvImport}
          onClose={() => setImportOpen(false)}
        />
      )}

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
              {(viewCliente.avaliacao ?? 0) > 0 && (
                <div className="border-t border-[#2a2a2a] pt-4">
                  <p className="text-xs text-[#505050] mb-2">Avaliação</p>
                  <StarRating value={viewCliente.avaliacao ?? 0} readOnly />
                </div>
              )}
              {viewCliente.observacoes && (
                <div className="border-t border-[#2a2a2a] pt-4">
                  <p className="text-xs text-[#505050] mb-1">Observações</p>
                  <p className="text-[#a0a0a0]">{viewCliente.observacoes}</p>
                </div>
              )}
              <ClienteProcessosSection clienteId={viewCliente.id} />
              <ClienteDocumentosSection clienteId={viewCliente.id} />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
              {!isReadOnly && (
                <button onClick={() => { setViewCliente(null); setEditCliente(viewCliente); setModalOpen(true); }} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors">
                  Editar
                </button>
              )}
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
