import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  FileText, X, Plus, Download, ExternalLink, Copy,
  CheckCircle, Clock, AlertTriangle, RefreshCw,
  Printer, Settings, Eye, EyeOff, Loader2, Receipt,
  CreditCard, Building2, Search,
} from 'lucide-react';
import { lancamentosApi, clientesApi, escritorioApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/cn';
import Portal from '../components/ui/Portal';
import type { Lancamento, Cliente, Escritorio, BoletoRegistrado, NotaFiscalEmitida, StatusBoleto, StatusNF } from '../types';
import { calcEncargos } from './Honorarios';

// ── localStorage / session keys ───────────────────────────────
const ASAAS_KEY    = 'msk_asaas_config';
const NFEIO_KEY    = 'msk_nfeio_config';
const BOLETOS_KEY  = 'msk_boletos';
const NFS_KEY      = 'msk_notas_fiscais';
const RECIBO_KEY   = 'msk_recibo_counter';
const PROVIDER_KEY = 'msk_boleto_provider'; // 'asaas' | 'bradesco'
const TOKEN_KEY    = 'msk_token';
const SERVER_BASE  = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

type BoletoProvider = 'asaas' | 'bradesco';

async function serverFetch(path: string, method = 'GET', body?: object) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const r = await fetch(`${SERVER_BASE}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as any).error || `Erro ${r.status}`);
  return json;
}

// ── Helpers ────────────────────────────────────────────────────
function getAll<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveAll<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}
function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function nextReciboNum() {
  const n = Number(localStorage.getItem(RECIBO_KEY) || 0) + 1;
  localStorage.setItem(RECIBO_KEY, String(n));
  return String(n).padStart(4, '0');
}

// ── Asaas API ──────────────────────────────────────────────────
interface AsaasConfig { env: 'sandbox' | 'prod'; accessToken: string; }
function asaasBase(env: 'sandbox' | 'prod') {
  return env === 'prod' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
}
async function asaasFetch(cfg: AsaasConfig, path: string, method = 'GET', body?: object) {
  const r = await fetch(`${asaasBase(cfg.env)}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'access_token': cfg.accessToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.errors?.[0]?.description || json?.message || `Erro ${r.status}`);
  return json;
}

// ── NFe.io API ─────────────────────────────────────────────────
interface NfeioConfig { apiKey: string; companyId: string; }
async function nfeioFetch(cfg: NfeioConfig, path: string, method = 'GET', body?: object) {
  const r = await fetch(`https://api.nfe.io/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(cfg.apiKey + ':')}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.message || `Erro ${r.status}`);
  return json;
}

// ── Tipos das configurações ────────────────────────────────────
type DocTab = 'recibos' | 'boletos' | 'notas';

const STATUS_BOLETO_LABEL: Record<StatusBoleto, string> = {
  PENDING: 'Pendente', RECEIVED: 'Recebido', OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
};
const STATUS_BOLETO_COLOR: Record<StatusBoleto, string> = {
  PENDING:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  RECEIVED:  'bg-green-500/15 text-green-400 border-green-500/30',
  OVERDUE:   'bg-red-500/15 text-red-400 border-red-500/30',
  CANCELLED: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};
const STATUS_NF_LABEL: Record<StatusNF, string> = {
  Processing: 'Processando', Issued: 'Emitida', Cancelled: 'Cancelada', Error: 'Erro',
};
const STATUS_NF_COLOR: Record<StatusNF, string> = {
  Processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Issued:     'bg-green-500/15 text-green-400 border-green-500/30',
  Cancelled:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
  Error:      'bg-red-500/15 text-red-400 border-red-500/30',
};

// ══════════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════════
export default function Documentos() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<DocTab>('recibos');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes]       = useState<Cliente[]>([]);
  const [escritorio, setEscritorio]   = useState<Escritorio | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');

  // Boletos
  const [boletos, setBoletos]         = useState<BoletoRegistrado[]>(() => getAll<BoletoRegistrado>(BOLETOS_KEY));
  const [boletoProvider, setBoletoProvider] = useState<BoletoProvider>(
    () => (localStorage.getItem(PROVIDER_KEY) as BoletoProvider) || 'bradesco',
  );
  const [asaasConfig, setAsaasConfig] = useState<AsaasConfig | null>(() => {
    try { return JSON.parse(localStorage.getItem(ASAAS_KEY) || 'null'); } catch { return null; }
  });
  const [bradescoConfigured, setBradescoConfigured] = useState<boolean | null>(null);
  const [showAsaasForm, setShowAsaasForm] = useState(false);
  const [novoBoletoOpen, setNovoBoletoOpen] = useState(false);

  // NFs
  const [nfs, setNFs]                 = useState<NotaFiscalEmitida[]>(() => getAll<NotaFiscalEmitida>(NFS_KEY));
  const [nfeioConfig, setNfeioConfig] = useState<NfeioConfig | null>(() => {
    try { return JSON.parse(localStorage.getItem(NFEIO_KEY) || 'null'); } catch { return null; }
  });
  const [showNfeioForm, setShowNfeioForm] = useState(false);
  const [novaNotaOpen, setNovaNotaOpen]   = useState(false);

  // Recibo
  const [reciboTarget, setReciboTarget] = useState<Lancamento | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c, e] = await Promise.all([lancamentosApi.getAll(), clientesApi.getAll(), escritorioApi.get().catch(() => null)]);
      setLancamentos(l);
      setClientes(c);
      setEscritorio(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Verifica se as env vars do Bradesco estão presentes no servidor
  useEffect(() => {
    if (boletoProvider !== 'bradesco') return;
    serverFetch('/boleto/bradesco/config-status')
      .then((d: any) => setBradescoConfigured(d.configured))
      .catch(() => setBradescoConfigured(false));
  }, [boletoProvider]);

  // Lançamentos pagos para recibos
  const pagos = useMemo(() => {
    const q = search.toLowerCase();
    return lancamentos.filter(l =>
      l.status === 'pago' &&
      (!q || l.descricao.toLowerCase().includes(q) || (l.clienteNome || '').toLowerCase().includes(q))
    );
  }, [lancamentos, search]);

  // ── Salvar boleto localmente ──
  function saveBoleto(b: BoletoRegistrado) {
    setBoletos(prev => {
      const next = [b, ...prev];
      saveAll(BOLETOS_KEY, next);
      return next;
    });
  }

  // ── Salvar NF localmente ──
  function saveNF(nf: NotaFiscalEmitida) {
    setNFs(prev => {
      const next = [nf, ...prev];
      saveAll(NFS_KEY, next);
      return next;
    });
  }

  // ── Atualizar status do boleto ──
  async function atualizarBoleto(boleto: BoletoRegistrado) {
    try {
      let newStatus: StatusBoleto = boleto.status;

      if (boletoProvider === 'bradesco' && boleto.nossoNumero) {
        const d = await serverFetch(`/boleto/bradesco/status/${encodeURIComponent(boleto.nossoNumero)}`);
        newStatus = (d as any).status as StatusBoleto;
      } else if (boletoProvider === 'asaas' && asaasConfig && boleto.asaasId) {
        const d = await asaasFetch(asaasConfig, `/payments/${boleto.asaasId}`);
        newStatus = (d as any).status as StatusBoleto;
      } else {
        showToast('info', 'Sem identificador para consultar status');
        return;
      }

      const updated = { ...boleto, status: newStatus };
      setBoletos(prev => {
        const next = prev.map(b => b.id === boleto.id ? updated : b);
        saveAll(BOLETOS_KEY, next);
        return next;
      });
      showToast('success', 'Status atualizado!');
    } catch (err: any) {
      showToast('error', 'Erro ao consultar status', err.message);
    }
  }

  // ── Atualizar status da NF (consulta NFe.io) ──
  async function atualizarNF(nf: NotaFiscalEmitida) {
    if (!nfeioConfig || !nf.nfeioId) return;
    try {
      const data = await nfeioFetch(nfeioConfig, `/companies/${nfeioConfig.companyId}/serviceinvoices/${nf.nfeioId}`);
      const si = data.serviceInvoice || data;
      const updated: NotaFiscalEmitida = {
        ...nf,
        status: si.flowStatus as StatusNF || nf.status,
        pdfUrl: si.pdfUrl || nf.pdfUrl,
        xmlUrl: si.xmlUrl || nf.xmlUrl,
        numero: si.number || nf.numero,
      };
      setNFs(prev => {
        const next = prev.map(n => n.id === nf.id ? updated : n);
        saveAll(NFS_KEY, next);
        return next;
      });
      showToast('success', 'Status atualizado!');
    } catch (err: any) {
      showToast('error', 'Erro ao consultar NFe.io', err.message);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Emissão de Documentos</h1>
        <p className="text-[#a0a0a0] text-sm">Recibos, boletos bancários e notas fiscais de serviço</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#141414] border border-[#2a2a2a] rounded-xl p-1 w-fit">
        {([
          { key: 'recibos', label: 'Recibos',       icon: Receipt },
          { key: 'boletos', label: 'Boletos',        icon: CreditCard },
          { key: 'notas',   label: 'Notas Fiscais',  icon: FileText },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'text-[#505050] hover:text-[#a0a0a0]'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── ABA: RECIBOS ── */}
      {tab === 'recibos' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050]" />
              <input
                className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]"
                placeholder="Buscar por cliente ou descrição..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-[#505050]">{pagos.length} lançamento{pagos.length !== 1 ? 's' : ''} pago{pagos.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-amber-400" /></div>
          ) : pagos.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-[#505050]">
              <Receipt className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhum lançamento pago encontrado</p>
            </div>
          ) : (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Descrição</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell">Cliente</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Valor</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell">Pagamento</th>
                    <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e]">
                  {pagos.map(l => (
                    <tr key={l.id} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#f5f5f5]">{l.descricao}</p>
                        {l.formaPagamento && <p className="text-xs text-[#505050] mt-0.5">{l.formaPagamento}</p>}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-sm text-[#a0a0a0]">{l.clienteNome || '—'}</td>
                      <td className="px-5 py-3.5 font-bold text-green-400 text-sm">{formatCurrency(l.valor)}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-[#a0a0a0]">
                        {l.dataPagamento ? new Date(l.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setReciboTarget(l)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition-colors ml-auto"
                        >
                          <Printer className="w-3.5 h-3.5" /> Recibo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: BOLETOS ── */}
      {tab === 'boletos' && (
        <div className="space-y-4">
          {/* Provider toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#a0a0a0]">Provedor:</span>
            <div className="flex gap-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
              {(['bradesco', 'asaas'] as BoletoProvider[]).map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setBoletoProvider(p);
                    localStorage.setItem(PROVIDER_KEY, p);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    boletoProvider === p
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-[#505050] hover:text-[#a0a0a0]'
                  }`}
                >
                  {p === 'bradesco' ? '🏦 Bradesco (direto)' : '🔵 Asaas'}
                </button>
              ))}
            </div>
          </div>

          {/* Config card — muda conforme provider selecionado */}
          {boletoProvider === 'asaas' ? (
            <AsaasConfigCard
              config={asaasConfig}
              showForm={showAsaasForm}
              onToggleForm={() => setShowAsaasForm(p => !p)}
              onSave={(cfg) => {
                setAsaasConfig(cfg);
                localStorage.setItem(ASAAS_KEY, JSON.stringify(cfg));
                setShowAsaasForm(false);
                showToast('success', 'Configuração Asaas salva!');
              }}
            />
          ) : (
            <BradescoConfigCard configured={bradescoConfigured} />
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#a0a0a0]">{boletos.length} boleto{boletos.length !== 1 ? 's' : ''} emitido{boletos.length !== 1 ? 's' : ''}</h3>
            <button
              onClick={() => {
                if (boletoProvider === 'asaas' && !asaasConfig?.accessToken) {
                  showToast('error', 'Configure a API Asaas primeiro');
                  setShowAsaasForm(true);
                  return;
                }
                if (boletoProvider === 'bradesco' && !bradescoConfigured) {
                  showToast('error', 'Bradesco não configurado', 'Adicione as variáveis BRADESCO_* nas env vars do Render.');
                  return;
                }
                setNovoBoletoOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> Novo Boleto
            </button>
          </div>

          {boletos.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-[#505050]">
              <CreditCard className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhum boleto emitido ainda</p>
            </div>
          ) : (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Descrição / Cliente</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Valor</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell">Vencimento</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e]">
                  {boletos.map(b => (
                    <tr key={b.id} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#f5f5f5]">{b.descricao}</p>
                        <p className="text-xs text-[#505050]">{b.clienteNome}</p>
                        {b.nossoNumero && <p className="text-xs font-mono text-[#505050] mt-0.5">Nº {b.nossoNumero}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-[#f5f5f5] text-sm">{formatCurrency(b.valor)}</td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-xs text-[#a0a0a0]">
                        {new Date(b.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BOLETO_COLOR[b.status]}`}>
                          {STATUS_BOLETO_LABEL[b.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Atualizar status — disponível se houver asaasId ou nossoNumero */}
                          {(b.asaasId || b.nossoNumero) && (
                            <button
                              onClick={() => atualizarBoleto(b)}
                              title="Atualizar status"
                              className="p-1.5 text-[#505050] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {b.linhaDigitavel && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(b.linhaDigitavel!); showToast('success', 'Linha copiada!'); }}
                              title="Copiar linha digitável"
                              className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {(b.bankSlipUrl || b.invoiceUrl) && (
                            <a
                              href={b.bankSlipUrl || b.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir boleto"
                              className="p-1.5 text-[#505050] hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: NOTAS FISCAIS ── */}
      {tab === 'notas' && (
        <div className="space-y-4">
          {/* Config NFe.io */}
          <NfeioConfigCard
            config={nfeioConfig}
            showForm={showNfeioForm}
            onToggleForm={() => setShowNfeioForm(p => !p)}
            onSave={(cfg) => {
              setNfeioConfig(cfg);
              localStorage.setItem(NFEIO_KEY, JSON.stringify(cfg));
              setShowNfeioForm(false);
              showToast('success', 'Configuração NFe.io salva!');
            }}
          />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#a0a0a0]">{nfs.length} nota{nfs.length !== 1 ? 's' : ''} fiscal emitida{nfs.length !== 1 ? 's' : ''}</h3>
            <button
              onClick={() => {
                if (!nfeioConfig?.apiKey) {
                  showToast('error', 'Configure a API NFe.io primeiro');
                  setShowNfeioForm(true);
                  return;
                }
                setNovaNotaOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> Nova NFS-e
            </button>
          </div>

          {nfs.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-[#505050]">
              <FileText className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma nota fiscal emitida ainda</p>
            </div>
          ) : (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Serviço / Tomador</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Valor</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell">Emissão</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e1e]">
                  {nfs.map(nf => (
                    <tr key={nf.id} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#f5f5f5]">{nf.descricao}</p>
                        <p className="text-xs text-[#505050]">{nf.clienteNome}</p>
                        {nf.numero && <p className="text-xs font-mono text-[#505050] mt-0.5">NF Nº {nf.numero}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-[#f5f5f5] text-sm">{formatCurrency(nf.valor)}</td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-xs text-[#a0a0a0]">
                        {new Date(nf.criadoEm).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_NF_COLOR[nf.status]}`}>
                          {STATUS_NF_LABEL[nf.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {nfeioConfig && nf.nfeioId && (
                            <button
                              onClick={() => atualizarNF(nf)}
                              title="Atualizar status"
                              className="p-1.5 text-[#505050] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {nf.pdfUrl && (
                            <a
                              href={nf.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Baixar PDF"
                              className="p-1.5 text-[#505050] hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {nf.xmlUrl && (
                            <a
                              href={nf.xmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Baixar XML"
                              className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modais ── */}
      {reciboTarget && (
        <ReciboModal
          lancamento={reciboTarget}
          escritorio={escritorio}
          onClose={() => setReciboTarget(null)}
        />
      )}

      {novoBoletoOpen && (
        <NovoBoletoModal
          provider={boletoProvider}
          asaasConfig={asaasConfig}
          clientes={clientes}
          onClose={() => setNovoBoletoOpen(false)}
          onSaved={(b) => { saveBoleto(b); setNovoBoletoOpen(false); }}
          showToast={showToast}
        />
      )}

      {novaNotaOpen && nfeioConfig && (
        <NovaNotaModal
          config={nfeioConfig}
          clientes={clientes}
          escritorio={escritorio}
          onClose={() => setNovaNotaOpen(false)}
          onSaved={(nf) => { saveNF(nf); setNovaNotaOpen(false); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Configuração Asaas
// ══════════════════════════════════════════════════════════════
function AsaasConfigCard({ config, showForm, onToggleForm, onSave }: {
  config: AsaasConfig | null;
  showForm: boolean;
  onToggleForm: () => void;
  onSave: (cfg: AsaasConfig) => void;
}) {
  const [env, setEnv]     = useState<'sandbox' | 'prod'>(config?.env ?? 'sandbox');
  const [token, setToken] = useState(config?.accessToken ?? '');
  const [show, setShow]   = useState(false);

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-[#f5f5f5] text-sm">Asaas — Banco/Pagamentos</p>
            <p className="text-xs text-[#505050] mt-0.5">
              {config?.accessToken
                ? <><span className="text-green-400">● Configurado</span> — {config.env === 'sandbox' ? 'Sandbox' : 'Produção'}</>
                : <span className="text-red-400">● Não configurado</span>
              }
            </p>
            <p className="text-xs text-[#505050] mt-0.5">
              Crie sua conta em <a href="https://www.asaas.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">asaas.com</a> e gere seu API key em Configurações → Integrações.
            </p>
          </div>
        </div>
        <button
          onClick={onToggleForm}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#2a2a2a] hover:border-amber-500/30 text-[#505050] hover:text-amber-400 rounded-lg transition-colors"
        >
          <Settings className="w-3.5 h-3.5" /> {showForm ? 'Fechar' : 'Configurar'}
        </button>
      </div>
      {showForm && (
        <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">Ambiente</label>
            <div className="grid grid-cols-2 gap-2">
              {(['sandbox', 'prod'] as const).map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    env === e ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#a0a0a0]'
                  }`}
                >
                  {e === 'sandbox' ? '🧪 Sandbox (testes)' : '🚀 Produção'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">Access Token</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm pr-10"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="$aact_..."
              />
              <button type="button" onClick={() => setShow(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050]">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            onClick={() => onSave({ env, accessToken: token })}
            disabled={!token}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Salvar configuração
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Configuração Bradesco (server-side — apenas exibe status das env vars)
// ══════════════════════════════════════════════════════════════
function BradescoConfigCard({ configured }: { configured: boolean | null }) {
  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Building2 className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[#f5f5f5] text-sm">Bradesco — Boleto Bancário (API direta)</p>
          <p className="text-xs mt-0.5">
            {configured === null ? (
              <span className="text-[#505050] flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin inline" /> Verificando servidor...</span>
            ) : configured ? (
              <span className="text-green-400">● Configurado — credenciais presentes no servidor</span>
            ) : (
              <span className="text-red-400">● Não configurado — adicione as variáveis de ambiente no Render</span>
            )}
          </p>

          {configured === false && (
            <div className="mt-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 space-y-2 text-xs">
              <p className="font-medium text-[#f5f5f5]">Como configurar:</p>
              <ol className="space-y-1.5 text-[#a0a0a0] list-decimal list-inside">
                <li>
                  Crie conta em{' '}
                  <a href="https://developers.bradesco.com.br" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                    developers.bradesco.com.br
                  </a>{' '}
                  e registre sua aplicação
                </li>
                <li>Obtenha o <strong className="text-[#f5f5f5]">Client ID</strong> e <strong className="text-[#f5f5f5]">Client Secret</strong> da aplicação</li>
                <li>Solicite ao Bradesco o <strong className="text-[#f5f5f5]">Merchant ID</strong> vinculado ao CNPJ do escritório</li>
                <li>
                  No painel do{' '}
                  <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                    Render
                  </a>
                  {' '}→ seu serviço (MSK API) → <em>Environment</em>, adicione:
                  <div className="mt-1.5 space-y-0.5 ml-4">
                    <p><code className="bg-[#252525] px-1.5 py-0.5 rounded font-mono">BRADESCO_CLIENT_ID</code></p>
                    <p><code className="bg-[#252525] px-1.5 py-0.5 rounded font-mono">BRADESCO_CLIENT_SECRET</code></p>
                    <p><code className="bg-[#252525] px-1.5 py-0.5 rounded font-mono">BRADESCO_MERCHANT_ID</code></p>
                  </div>
                </li>
                <li>Faça um novo <em>Deploy</em> do serviço e recarregue esta página</li>
              </ol>
            </div>
          )}

          {configured === true && (
            <p className="text-xs text-[#505050] mt-1.5">
              As credenciais ficam armazenadas somente no servidor (Render). Nenhum segredo é exposto ao navegador.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Configuração NFe.io
// ══════════════════════════════════════════════════════════════
function NfeioConfigCard({ config, showForm, onToggleForm, onSave }: {
  config: NfeioConfig | null;
  showForm: boolean;
  onToggleForm: () => void;
  onSave: (cfg: NfeioConfig) => void;
}) {
  const [apiKey,    setApiKey]    = useState(config?.apiKey ?? '');
  const [companyId, setCompanyId] = useState(config?.companyId ?? '');
  const [show, setShow]           = useState(false);

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-[#f5f5f5] text-sm">NFe.io — Nota Fiscal de Serviço (NFS-e)</p>
            <p className="text-xs text-[#505050] mt-0.5">
              {config?.apiKey
                ? <><span className="text-green-400">● Configurado</span> — empresa {config.companyId}</>
                : <span className="text-red-400">● Não configurado</span>
              }
            </p>
            <p className="text-xs text-[#505050] mt-0.5">
              Crie sua conta em <a href="https://nfe.io" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">nfe.io</a> e copie sua API Key e o ID da empresa.
            </p>
          </div>
        </div>
        <button
          onClick={onToggleForm}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#2a2a2a] hover:border-amber-500/30 text-[#505050] hover:text-amber-400 rounded-lg transition-colors"
        >
          <Settings className="w-3.5 h-3.5" /> {showForm ? 'Fechar' : 'Configurar'}
        </button>
      </div>
      {showForm && (
        <div className="mt-4 pt-4 border-t border-[#2a2a2a] space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm pr-10"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Sua API Key do NFe.io"
              />
              <button type="button" onClick={() => setShow(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050]">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">ID da Empresa</label>
            <input
              type="text"
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm"
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              placeholder="ID da empresa no NFe.io"
            />
          </div>
          <button
            onClick={() => onSave({ apiKey, companyId })}
            disabled={!apiKey || !companyId}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Salvar configuração
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Modal: Novo Boleto (Asaas ou Bradesco)
// ══════════════════════════════════════════════════════════════
function NovoBoletoModal({ provider, asaasConfig, clientes, onClose, onSaved, showToast }: {
  provider: BoletoProvider;
  asaasConfig: AsaasConfig | null;
  clientes: Cliente[];
  onClose: () => void;
  onSaved: (b: BoletoRegistrado) => void;
  showToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}) {
  const [form, setForm] = useState({
    clienteId: '',
    clienteNome: '',
    valor: '',
    vencimento: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    descricao: 'Honorários Advocatícios',
    cpfCnpj: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  function fill(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function onClienteChange(id: string) {
    const c = clientes.find(cl => cl.id === id);
    setForm(p => ({
      ...p,
      clienteId:   id,
      clienteNome: c?.nome    || '',
      cpfCnpj:     c?.cpf     || c?.cnpj  || '',
      email:       c?.email   || '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cpfCnpj) { showToast('error', 'CPF/CNPJ obrigatório'); return; }
    setSaving(true);
    try {
      if (provider === 'bradesco') {
        // ── Bradesco: chama o backend (server-side OAuth2) ──
        const data: any = await serverFetch('/boleto/bradesco/criar', 'POST', {
          nomeComprador:  form.clienteNome,
          cpfCnpj:        form.cpfCnpj,
          emailComprador: form.email || undefined,
          valor:          parseFloat(form.valor),
          dataVencimento: form.vencimento,
          descricao:      form.descricao,
        });

        const boleto: BoletoRegistrado = {
          id:             genId(),
          clienteId:      form.clienteId || undefined,
          clienteNome:    form.clienteNome,
          valor:          parseFloat(form.valor),
          vencimento:     form.vencimento,
          descricao:      form.descricao,
          status:         'PENDING',
          nossoNumero:    data.nossoNumero || data.numeroPedido,
          linhaDigitavel: data.linhaDigitavel || undefined,
          bankSlipUrl:    data.linkBoleto || undefined,
          criadoEm:       new Date().toISOString(),
        };
        onSaved(boleto);
        showToast('success', 'Boleto Bradesco emitido!', `Vencimento: ${new Date(form.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`);

      } else {
        // ── Asaas: chamada direta do browser ──
        if (!asaasConfig) throw new Error('Asaas não configurado');

        // 1. Cria ou busca customer no Asaas
        let customerId: string;
        const custSearch = await asaasFetch(asaasConfig, `/customers?cpfCnpj=${form.cpfCnpj.replace(/\D/g, '')}`);
        if (custSearch.data?.length > 0) {
          customerId = custSearch.data[0].id;
        } else {
          const cust = await asaasFetch(asaasConfig, '/customers', 'POST', {
            name:    form.clienteNome,
            cpfCnpj: form.cpfCnpj.replace(/\D/g, ''),
            email:   form.email || undefined,
          });
          customerId = cust.id;
        }

        // 2. Cria cobrança boleto
        const payment = await asaasFetch(asaasConfig, '/payments', 'POST', {
          customer:    customerId,
          billingType: 'BOLETO',
          value:       parseFloat(form.valor),
          dueDate:     form.vencimento,
          description: form.descricao,
        });

        const boleto: BoletoRegistrado = {
          id:           genId(),
          asaasId:      payment.id,
          clienteId:    form.clienteId || undefined,
          clienteNome:  form.clienteNome,
          valor:        parseFloat(form.valor),
          vencimento:   form.vencimento,
          descricao:    form.descricao,
          status:       (payment.status as StatusBoleto) || 'PENDING',
          bankSlipUrl:  payment.bankSlipUrl,
          invoiceUrl:   payment.invoiceUrl,
          nossoNumero:  payment.nossoNumero,
          criadoEm:     new Date().toISOString(),
        };
        onSaved(boleto);
        showToast('success', 'Boleto Asaas emitido!', `Vencimento: ${new Date(form.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`);
      }
    } catch (err: any) {
      showToast('error', 'Erro ao emitir boleto', err.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]";
  const lbl = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
        <div className="flex justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <div>
                <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Novo Boleto Bancário</h2>
                <p className="text-xs text-[#505050] mt-0.5">
                  {provider === 'bradesco' ? '🏦 Via Bradesco (direto)' : '🔵 Via Asaas'}
                </p>
              </div>
              <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className={lbl}>Cliente</label>
                <select className={inp} value={form.clienteId} onChange={e => onClienteChange(e.target.value)}>
                  <option value="">Selecionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* Campos manuais quando não selecionou cliente */}
              {!form.clienteId && (
                <>
                  <div>
                    <label className={lbl}>Nome do pagador *</label>
                    <input className={inp} required value={form.clienteNome} onChange={e => fill('clienteNome', e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>CPF / CNPJ *</label>
                      <input className={inp} required value={form.cpfCnpj} onChange={e => fill('cpfCnpj', e.target.value)} placeholder="000.000.000-00" />
                    </div>
                    <div>
                      <label className={lbl}>E-mail (opcional)</label>
                      <input type="email" className={inp} value={form.email} onChange={e => fill('email', e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                  </div>
                </>
              )}

              {/* Quando cliente selecionado, mostra CPF/CNPJ em modo readonly para confirmar */}
              {form.clienteId && (
                <div>
                  <label className={lbl}>CPF / CNPJ *</label>
                  <input className={inp} required value={form.cpfCnpj} onChange={e => fill('cpfCnpj', e.target.value)} placeholder="000.000.000-00" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Valor (R$) *</label>
                  <input type="number" className={inp} required min="1" step="0.01" value={form.valor} onChange={e => fill('valor', e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label className={lbl}>Vencimento *</label>
                  <input type="date" className={inp} required value={form.vencimento} onChange={e => fill('vencimento', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={lbl}>Descrição *</label>
                <input className={inp} required value={form.descricao} onChange={e => fill('descricao', e.target.value)} />
              </div>

              {provider === 'asaas' && asaasConfig && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Utilizando Asaas no ambiente <strong>{asaasConfig.env === 'sandbox' ? 'Sandbox (testes)' : 'Produção'}</strong>. Em sandbox os boletos não são reais.</p>
                </div>
              )}

              {provider === 'bradesco' && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>O boleto será registrado diretamente no <strong>Bradesco</strong> via API bancária. Credenciais armazenadas com segurança no servidor.</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Emitindo...</> : 'Emitir Boleto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ══════════════════════════════════════════════════════════════
// Modal: Nova Nota Fiscal (NFS-e via NFe.io)
// ══════════════════════════════════════════════════════════════
function NovaNotaModal({ config, clientes, escritorio, onClose, onSaved, showToast }: {
  config: NfeioConfig;
  clientes: Cliente[];
  escritorio: Escritorio | null;
  onClose: () => void;
  onSaved: (nf: NotaFiscalEmitida) => void;
  showToast: (type: 'success' | 'error' | 'info', title: string, desc?: string) => void;
}) {
  const [form, setForm] = useState({
    clienteId: '',
    clienteNome: '',
    cpfCnpj: '',
    email: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    valor: '',
    descricao: 'Honorários Advocatícios',
    codigoServico: '6160', // Assessoria jurídica
  });
  const [saving, setSaving] = useState(false);

  function fill(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function onClienteChange(id: string) {
    const c = clientes.find(cl => cl.id === id);
    if (!c) { setForm(p => ({ ...p, clienteId: '', clienteNome: '', cpfCnpj: '', email: '', rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' })); return; }
    setForm(p => ({
      ...p,
      clienteId:   id,
      clienteNome: c.nome,
      cpfCnpj:     c.cpf || c.cnpj || '',
      email:       c.email || '',
      rua:         c.endereco?.logradouro || '',
      numero:      c.endereco?.numero || '',
      bairro:      c.endereco?.bairro || '',
      cidade:      c.endereco?.cidade || '',
      uf:          c.endereco?.uf || '',
      cep:         c.endereco?.cep || '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        cityServiceCode: form.codigoServico,
        description: form.descricao,
        servicesAmount: parseFloat(form.valor),
        borrower: {
          name:             form.clienteNome,
          federalTaxNumber: form.cpfCnpj.replace(/\D/g, ''),
          email:            form.email || undefined,
          address: {
            street:               form.rua,
            number:               form.numero,
            district:             form.bairro,
            city: {
              name:    form.cidade,
              code:    undefined, // NFe.io aceita sem código IBGE quando name está presente
            },
            state:                form.uf,
            postalCode:           form.cep.replace(/\D/g, ''),
            country:              'BRA',
            additionalInformation: '',
          },
        },
      };

      const res = await nfeioFetch(config, `/companies/${config.companyId}/serviceinvoices`, 'POST', body);
      const si = res.serviceInvoice || res;

      const nf: NotaFiscalEmitida = {
        id:         genId(),
        nfeioId:    si.id,
        clienteId:  form.clienteId || undefined,
        clienteNome: form.clienteNome,
        valor:      parseFloat(form.valor),
        descricao:  form.descricao,
        status:     (si.flowStatus as StatusNF) || 'Processing',
        pdfUrl:     si.pdfUrl,
        xmlUrl:     si.xmlUrl,
        numero:     si.number,
        criadoEm:   new Date().toISOString(),
      };

      onSaved(nf);
      showToast('success', 'NFS-e enviada para emissão!', 'Aguarde alguns instantes e atualize o status.');
    } catch (err: any) {
      showToast('error', 'Erro ao emitir NFS-e', err.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]";
  const lbl = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
        <div className="flex justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Nova Nota Fiscal de Serviço (NFS-e)</h2>
              <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className={lbl}>Tomador (cliente)</label>
                <select className={inp} value={form.clienteId} onChange={e => onClienteChange(e.target.value)}>
                  <option value="">Selecionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {!form.clienteId && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Nome do tomador *</label>
                    <input className={inp} required value={form.clienteNome} onChange={e => fill('clienteNome', e.target.value)} placeholder="Nome / Razão Social" />
                  </div>
                  <div>
                    <label className={lbl}>CPF / CNPJ *</label>
                    <input className={inp} required value={form.cpfCnpj} onChange={e => fill('cpfCnpj', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className={lbl}>E-mail</label>
                    <input type="email" className={inp} value={form.email} onChange={e => fill('email', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Endereço do tomador */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-[#a0a0a0]">Endereço do tomador (obrigatório para NFS-e)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={lbl}>Logradouro *</label>
                    <input className={inp} required value={form.rua} onChange={e => fill('rua', e.target.value)} placeholder="Av./Rua..." />
                  </div>
                  <div>
                    <label className={lbl}>Número *</label>
                    <input className={inp} required value={form.numero} onChange={e => fill('numero', e.target.value)} placeholder="Nº" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={lbl}>Bairro *</label>
                    <input className={inp} required value={form.bairro} onChange={e => fill('bairro', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Cidade *</label>
                    <input className={inp} required value={form.cidade} onChange={e => fill('cidade', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>UF *</label>
                    <input className={inp} required maxLength={2} value={form.uf} onChange={e => fill('uf', e.target.value)} placeholder="SP" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>CEP *</label>
                    <input className={inp} required value={form.cep} onChange={e => fill('cep', e.target.value)} placeholder="00000-000" />
                  </div>
                </div>
              </div>

              {/* Serviço */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Valor (R$) *</label>
                  <input type="number" className={inp} required min="1" step="0.01" value={form.valor} onChange={e => fill('valor', e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label className={lbl}>Código do serviço (CNAE)</label>
                  <input className={inp} value={form.codigoServico} onChange={e => fill('codigoServico', e.target.value)} placeholder="ex: 6916-6/01" />
                  <p className="text-[10px] text-[#505050] mt-1">Assessoria jurídica: 6916-6/01</p>
                </div>
              </div>

              <div>
                <label className={lbl}>Descrição do serviço *</label>
                <textarea
                  className={`${inp} resize-none`}
                  rows={3}
                  required
                  value={form.descricao}
                  onChange={e => fill('descricao', e.target.value)}
                />
              </div>

              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-xs text-green-400 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>A NFS-e será enviada para a prefeitura via <strong>NFe.io</strong>. O status muda de "Processando" para "Emitida" após aprovação (geralmente alguns minutos).</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Emitindo...</> : 'Emitir NFS-e'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ══════════════════════════════════════════════════════════════
// Modal: Recibo (print-ready)
// ══════════════════════════════════════════════════════════════
function ReciboModal({ lancamento: l, escritorio: esc, onClose }: {
  lancamento: Lancamento;
  escritorio: Escritorio | null;
  onClose: () => void;
}) {
  const num = useMemo(() => nextReciboNum(), []);
  const enc = useMemo(() => calcEncargos(l), [l]);
  const valorFinal = enc ? enc.valorFinal : l.valor;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto no-print">
        <div className="flex justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] no-print">
              <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Recibo Nº {num}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium"
                >
                  <Printer className="w-4 h-4" /> Imprimir / PDF
                </button>
                <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="px-8 py-6 space-y-5">
              {/* Cabeçalho */}
              <div className="flex items-start justify-between border-b border-[#2a2a2a] pb-5">
                <div>
                  <h1 className="font-playfair text-xl font-bold text-[#f5f5f5]">{esc?.nome || 'MSK Gestor'}</h1>
                  {esc?.cnpj && <p className="text-xs text-[#505050] mt-0.5">CNPJ: {esc.cnpj}</p>}
                  {esc?.oabPrincipal && <p className="text-xs text-[#505050]">OAB: {esc.oabPrincipal}</p>}
                  {esc?.endereco?.logradouro && (
                    <p className="text-xs text-[#505050] mt-0.5">
                      {esc.endereco.logradouro}, {esc.endereco.numero} — {esc.endereco.cidade}/{esc.endereco.uf}
                    </p>
                  )}
                  {esc?.email && <p className="text-xs text-[#505050]">{esc.email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-400 font-playfair tracking-wide">RECIBO</p>
                  <p className="text-sm font-mono text-[#a0a0a0] mt-1">Nº {num}</p>
                  <p className="text-xs text-[#505050] mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Dados */}
              <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-3 text-sm border border-[#2a2a2a]">
                {[
                  ['Recebemos de', l.clienteNome || '—'],
                  ['Referente a',  l.descricao],
                  ['Forma de pgto.', l.formaPagamento || 'Não informado'],
                  l.dataPagamento ? ['Data de pagamento', new Date(l.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR')] : null,
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="text-[#505050] w-32 shrink-0">{k}</span>
                    <span className="text-[#a0a0a0] flex-1">{v}</span>
                  </div>
                ))}
                {l.observacoes && (
                  <div className="flex gap-3">
                    <span className="text-[#505050] w-32 shrink-0">Observações</span>
                    <span className="text-[#505050] text-xs flex-1">{l.observacoes}</span>
                  </div>
                )}
              </div>

              {/* Valor */}
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-6 py-4">
                <span className="font-medium text-[#a0a0a0]">Valor recebido</span>
                <span className="text-3xl font-bold text-amber-400 font-playfair">{formatCurrency(valorFinal)}</span>
              </div>

              {/* Composição de encargos */}
              {enc && (
                <div className="text-xs text-[#505050] space-y-1 bg-[#1a1a1a] rounded-lg px-4 py-3 border border-[#2a2a2a]">
                  <p className="font-medium text-[#a0a0a0] mb-2">Composição do valor</p>
                  <div className="flex justify-between"><span>Valor original</span><span>{formatCurrency(l.valor)}</span></div>
                  {enc.multa > 0 && <div className="flex justify-between text-red-400"><span>+ Multa por atraso</span><span>+{formatCurrency(enc.multa)}</span></div>}
                  {enc.juros > 0 && <div className="flex justify-between text-amber-400"><span>+ Juros de mora ({enc.dias}d)</span><span>+{formatCurrency(enc.juros)}</span></div>}
                  {enc.desconto > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>− Desconto{l.motivoDesconto ? ` (${l.motivoDesconto})` : ''}</span>
                      <span>-{formatCurrency(enc.desconto)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Assinatura */}
              <div className="flex justify-end pt-2">
                <div className="text-center w-56">
                  <div className="border-t border-[#505050] pt-3">
                    <p className="text-xs text-[#505050]">{esc?.responsavel || esc?.nome || 'Responsável'}</p>
                    {esc?.oabPrincipal && <p className="text-xs text-[#505050]">OAB {esc.oabPrincipal}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
