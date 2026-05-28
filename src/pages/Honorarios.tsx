import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, X, DollarSign, CheckCircle, Clock, TrendingDown,
  Search, Edit2, Trash2, Receipt, CreditCard, Printer,
  Percent, Tag, ChevronDown, ChevronUp, TrendingUp, Layers,
  RefreshCw, FileText,
} from 'lucide-react';
import { lancamentosApi, clientesApi, escritorioApi } from '../services/api';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/cn';
import { DateInput } from '../components/ui/Input';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import { addDias } from '../hooks/useRecorrencia';
import type { Lancamento, TipoLancamento, StatusPagamento, Cliente, Escritorio } from '../types';
import Portal from '../components/ui/Portal';

const RECORRENCIA_LABELS: Record<string, string> = {
  semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal',
  bimestral: 'Bimestral', trimestral: 'Trimestral',
};
const RECORRENCIA_DIAS: Record<string, number> = {
  semanal: 7, quinzenal: 15, mensal: 30, bimestral: 60, trimestral: 90,
};

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

/**
 * Calcula encargos acumulados de um lançamento.
 * Juros e multa só incidem quando status === 'vencido' e há dias de atraso.
 * Desconto é sempre aplicado (cortesia negociada).
 * Retorna null se não há encargos configurados.
 */
export function calcEncargos(l: Lancamento) {
  if (!l.jurosMensais && !l.multaPorAtraso && !l.desconto) return null;

  const hoje = new Date();
  const venc = new Date(l.dataVencimento + 'T00:00:00');
  const dias = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000));

  const isVencido = l.status === 'vencido' && dias > 0;
  const multa     = isVencido ? l.valor * (l.multaPorAtraso ?? 0) / 100 : 0;
  const juros     = isVencido ? l.valor * ((l.jurosMensais ?? 0) / 30 / 100) * dias : 0;
  const desconto  = l.desconto ?? 0;
  const valorFinal = Math.max(0, l.valor + juros + multa - desconto);

  return { dias, juros, multa, desconto, valorFinal };
}

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
    jurosMensais:   lancamento?.jurosMensais?.toString()   || '',
    multaPorAtraso: lancamento?.multaPorAtraso?.toString() || '',
    desconto:       lancamento?.desconto?.toString()       || '',
    motivoDesconto: lancamento?.motivoDesconto             || '',
  });

  // Expande a seção de encargos automaticamente se o lançamento já tiver algum
  const [showEncargos, setShowEncargos] = useState(
    !!(lancamento?.jurosMensais || lancamento?.multaPorAtraso || lancamento?.desconto),
  );

  // ── Parcelamento ──
  const [showParcelar,   setShowParcelar]   = useState(false);
  const [numParcelas,    setNumParcelas]    = useState('3');
  const [intervaloDias,  setIntervaloDias]  = useState('30');

  // ── Recorrência ──
  const [recorrente,    setRecorrente]    = useState(lancamento?.recorrente ?? false);
  const [recorrenciaFreq, setRecorrenciaFreq] = useState(lancamento?.recorrenciaFrequencia ?? 'mensal');

  // Preview das parcelas (primeiras 6 para não sobrecarregar o modal)
  const parcelaPreview = useMemo(() => {
    const n        = Math.min(Math.max(parseInt(numParcelas) || 2, 2), 24);
    const interval = Math.max(parseInt(intervaloDias) || 30, 1);
    const total    = parseFloat(form.valor) || 0;
    const parcela  = Math.floor(total * 100 / n) / 100;
    const sobra    = Math.round((total - parcela * n) * 100) / 100;
    const base     = new Date(form.dataVencimento + 'T12:00:00');
    return Array.from({ length: Math.min(n, 6) }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i * interval);
      return {
        idx:   i + 1,
        data:  d.toLocaleDateString('pt-BR'),
        valor: i === n - 1 ? parcela + sobra : parcela,
      };
    });
  }, [numParcelas, intervaloDias, form.valor, form.dataVencimento]);

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cliente = clientes.find(c => c.id === form.clienteId);
    const now = new Date().toISOString();
    const basePayload: Omit<Lancamento, 'id'> = {
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
      jurosMensais:   form.jurosMensais   ? parseFloat(form.jurosMensais)   : undefined,
      multaPorAtraso: form.multaPorAtraso ? parseFloat(form.multaPorAtraso) : undefined,
      desconto:       form.desconto       ? parseFloat(form.desconto)       : undefined,
      motivoDesconto: form.motivoDesconto || undefined,
      // Recorrência
      recorrente: recorrente || undefined,
      recorrenciaFrequencia: recorrente ? recorrenciaFreq : undefined,
      recorrenciaProximaData: recorrente
        ? addDias(form.dataVencimento, RECORRENCIA_DIAS[recorrenciaFreq] ?? 30)
        : undefined,
    };
    try {
      if (isEdit) {
        await lancamentosApi.update(lancamento.id, basePayload);
        showToast('success', 'Lançamento atualizado!');
        onSave();
        return;
      }

      // ── Parcelamento ──
      const n = parseInt(numParcelas);
      if (showParcelar && n >= 2) {
        const interval  = Math.max(parseInt(intervaloDias) || 30, 1);
        const total     = parseFloat(form.valor);
        const parcela   = Math.floor(total * 100 / n) / 100;
        const sobra     = Math.round((total - parcela * n) * 100) / 100;
        const grupoId   = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const base = new Date(form.dataVencimento + 'T12:00:00');

        for (let i = 0; i < n; i++) {
          const d = new Date(base);
          d.setDate(d.getDate() + i * interval);
          await lancamentosApi.create({
            ...basePayload,
            descricao:      `${form.descricao} — Parcela ${i + 1}/${n}`,
            valor:          i === n - 1 ? parcela + sobra : parcela,
            dataVencimento: d.toISOString().slice(0, 10),
            parcelaGrupoId: grupoId,
            parcelaAtual:   i + 1,
            parcelasTotal:  n,
          });
        }
        showToast('success', `${n} parcelas criadas com sucesso!`);
      } else {
        await lancamentosApi.create(basePayload);
        showToast('success', 'Lançamento registrado!');
      }
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

          {/* ── Parcelamento ── (apenas em novo lançamento) */}
          {!isEdit && (
            <div className="border-t border-[#2a2a2a] pt-3">
              <button
                type="button"
                onClick={() => setShowParcelar(p => !p)}
                className="flex items-center gap-2 text-xs font-medium text-[#505050] hover:text-amber-400 transition-colors w-full"
              >
                <Layers className="w-3.5 h-3.5" />
                {showParcelar ? 'Cancelar parcelamento' : 'Parcelar este lançamento'}
                {showParcelar
                  ? <ChevronUp className="w-3 h-3 ml-auto" />
                  : <ChevronDown className="w-3 h-3 ml-auto" />
                }
              </button>

              {showParcelar && (
                <div className="mt-3 space-y-3 bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Nº de parcelas</label>
                      <input
                        type="number" min="2" max="24" step="1"
                        className={inputClass}
                        value={numParcelas}
                        onChange={e => setNumParcelas(e.target.value)}
                        placeholder="ex: 3"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Intervalo</label>
                      <select
                        className={inputClass}
                        value={intervaloDias}
                        onChange={e => setIntervaloDias(e.target.value)}
                      >
                        <option value="7">Semanal (7d)</option>
                        <option value="15">Quinzenal (15d)</option>
                        <option value="30">Mensal (30d)</option>
                        <option value="60">Bimestral (60d)</option>
                        <option value="90">Trimestral (90d)</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview das parcelas */}
                  {form.valor && parseFloat(form.valor) > 0 && (
                    <div className="bg-[#141414] rounded-lg p-3 border border-[#2a2a2a]">
                      <p className="text-[10px] font-medium text-[#505050] mb-2 uppercase tracking-wide">
                        Prévia das parcelas
                        {parseInt(numParcelas) > 6 && <span className="ml-1">(exibindo 6 de {numParcelas})</span>}
                      </p>
                      <div className="space-y-1">
                        {parcelaPreview.map(p => (
                          <div key={p.idx} className="flex items-center justify-between text-xs">
                            <span className="text-[#505050]">Parcela <span className="font-mono text-amber-400">{p.idx}/{numParcelas}</span></span>
                            <span className="text-[#505050]">{p.data}</span>
                            <span className="font-medium text-[#f5f5f5]">{formatCurrency(p.valor)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#2a2a2a] flex justify-between text-xs font-bold text-[#a0a0a0]">
                        <span>Total</span>
                        <span>{formatCurrency(parseFloat(form.valor) || 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Recorrência ── */}
          {form.tipo === 'a_receber' && (
            <div className="border-t border-[#2a2a2a] pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-[#505050]">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Cobrança recorrente
                </div>
                <button
                  type="button"
                  onClick={() => setRecorrente(p => !p)}
                  className={`relative w-10 h-5 rounded-full transition-all ${recorrente ? 'bg-amber-500' : 'bg-[#2a2a2a]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${recorrente ? 'left-5.5' : 'left-0.5'}`} style={{ left: recorrente ? '22px' : '2px' }} />
                </button>
              </div>
              {recorrente && (
                <div className="mt-3 bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a] space-y-3">
                  <div>
                    <label className={labelClass}>Frequência de geração</label>
                    <select
                      className={inputClass}
                      value={recorrenciaFreq}
                      onChange={e => setRecorrenciaFreq(e.target.value as any)}
                    >
                      <option value="semanal">Semanal (a cada 7 dias)</option>
                      <option value="quinzenal">Quinzenal (a cada 15 dias)</option>
                      <option value="mensal">Mensal (a cada 30 dias)</option>
                      <option value="bimestral">Bimestral (a cada 60 dias)</option>
                      <option value="trimestral">Trimestral (a cada 90 dias)</option>
                    </select>
                  </div>
                  {form.dataVencimento && (
                    <div className="bg-[#141414] rounded-lg p-3 text-xs text-[#505050] border border-[#2a2a2a]">
                      <p>1ª cobrança: <span className="text-amber-400 font-medium">
                        {new Date(form.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span></p>
                      <p className="mt-0.5">Próxima geração automática: <span className="text-amber-400 font-medium">
                        {new Date(addDias(form.dataVencimento, RECORRENCIA_DIAS[recorrenciaFreq] ?? 30) + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Juros, Multa & Desconto ── */}
          <div className="border-t border-[#2a2a2a] pt-3">
            <button
              type="button"
              onClick={() => setShowEncargos(p => !p)}
              className="flex items-center gap-2 text-xs font-medium text-[#505050] hover:text-amber-400 transition-colors w-full"
            >
              {showEncargos
                ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar Juros, Multa & Desconto</>
                : <><ChevronDown className="w-3.5 h-3.5" /> Adicionar Juros, Multa & Desconto</>
              }
            </button>

            {showEncargos && (
              <div className="mt-3 space-y-3 bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      <Percent className="inline w-3 h-3 mr-1" />
                      Juros de mora (% ao mês)
                    </label>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      className={inputClass}
                      value={form.jurosMensais}
                      onChange={e => set('jurosMensais', e.target.value)}
                      placeholder="ex: 1"
                    />
                    <p className="text-[10px] text-[#505050] mt-1">Acumulado por dia após o vencimento</p>
                  </div>
                  <div>
                    <label className={labelClass}>
                      <TrendingUp className="inline w-3 h-3 mr-1" />
                      Multa por atraso (% fixo)
                    </label>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      className={inputClass}
                      value={form.multaPorAtraso}
                      onChange={e => set('multaPorAtraso', e.target.value)}
                      placeholder="ex: 2"
                    />
                    <p className="text-[10px] text-[#505050] mt-1">Aplicado uma vez no 1º dia de atraso</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>
                      <Tag className="inline w-3 h-3 mr-1" />
                      Desconto / Cortesia (R$)
                    </label>
                    <input
                      type="number" min="0" step="0.01"
                      className={inputClass}
                      value={form.desconto}
                      onChange={e => set('desconto', e.target.value)}
                      placeholder="ex: 50.00"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Motivo do desconto</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.motivoDesconto}
                      onChange={e => set('motivoDesconto', e.target.value)}
                      placeholder="ex: Cortesia / Bom pagador"
                    />
                  </div>
                </div>

                {/* Preview do valor atualizado */}
                {(form.jurosMensais || form.multaPorAtraso || form.desconto) && form.valor && (
                  <div className="bg-[#141414] rounded-lg p-3 border border-[#2a2a2a] space-y-1 text-xs">
                    <p className="text-[#505050] font-medium mb-1.5">Prévia (se vencido hoje)</p>
                    <div className="flex justify-between text-[#a0a0a0]">
                      <span>Valor original</span>
                      <span>{formatCurrency(parseFloat(form.valor) || 0)}</span>
                    </div>
                    {form.multaPorAtraso && (
                      <div className="flex justify-between text-red-400">
                        <span>+ Multa ({form.multaPorAtraso}%)</span>
                        <span>+{formatCurrency((parseFloat(form.valor) || 0) * parseFloat(form.multaPorAtraso) / 100)}</span>
                      </div>
                    )}
                    {form.jurosMensais && (
                      <div className="flex justify-between text-amber-400">
                        <span>+ Juros 30d ({form.jurosMensais}%/mês)</span>
                        <span>+{formatCurrency((parseFloat(form.valor) || 0) * parseFloat(form.jurosMensais) / 100)}</span>
                      </div>
                    )}
                    {form.desconto && (
                      <div className="flex justify-between text-green-400">
                        <span>− Desconto</span>
                        <span>-{formatCurrency(parseFloat(form.desconto) || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[#f5f5f5] border-t border-[#2a2a2a] pt-1.5 mt-1">
                      <span>Valor após 30 dias vencido</span>
                      <span>{formatCurrency(
                        Math.max(0,
                          (parseFloat(form.valor) || 0)
                          + ((parseFloat(form.valor) || 0) * (parseFloat(form.multaPorAtraso) || 0) / 100)
                          + ((parseFloat(form.valor) || 0) * (parseFloat(form.jurosMensais) || 0) / 100)
                          - (parseFloat(form.desconto) || 0)
                        )
                      )}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
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
  const [reciboTarget, setReciboTarget] = useState<Lancamento | null>(null);
  const [escritorio, setEscritorio] = useState<Escritorio | null>(null);

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
  useEffect(() => { escritorioApi.get().then(setEscritorio).catch(() => {}); }, []);

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
    const recebido = lancamentos
      .filter(l => l.tipo === 'recebimento' && l.status === 'pago')
      .reduce((s, l) => s + l.valor, 0);

    const aReceber = lancamentos
      .filter(l => l.tipo === 'a_receber' && (l.status === 'pendente' || l.status === 'vencido'))
      .reduce((s, l) => {
        const enc = calcEncargos(l);
        return s + (enc ? enc.valorFinal : l.valor);
      }, 0);

    const despesas = lancamentos
      .filter(l => l.tipo === 'despesa')
      .reduce((s, l) => s + l.valor, 0);

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
                pagination.items.map(l => {
                  const enc = calcEncargos(l);
                  return (
                  <tr key={l.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <p className="font-medium text-[#f5f5f5] leading-tight">{l.descricao}</p>
                        {l.parcelaAtual && l.parcelasTotal && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5">
                            <Layers className="w-2.5 h-2.5 mr-0.5" />{l.parcelaAtual}/{l.parcelasTotal}
                          </span>
                        )}
                        {l.recorrente && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5" title={`Recorrente ${RECORRENCIA_LABELS[l.recorrenciaFrequencia ?? 'mensal']}`}>
                            <RefreshCw className="w-2.5 h-2.5 mr-0.5" />{RECORRENCIA_LABELS[l.recorrenciaFrequencia ?? 'mensal']}
                          </span>
                        )}
                      </div>
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
                      {enc ? (
                        <div>
                          {/* Valor original riscado */}
                          <p className="text-xs text-[#505050] line-through leading-tight">
                            {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                          </p>
                          {/* Valor com encargos */}
                          <p className={`font-bold text-sm ${l.tipo === 'recebimento' || l.tipo === 'a_receber' ? 'text-green-400' : 'text-red-400'}`}>
                            {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(enc.valorFinal)}
                          </p>
                          {/* Detalhamento compacto */}
                          <div className="flex flex-wrap gap-x-2 mt-0.5">
                            {enc.multa > 0 && (
                              <span className="text-[10px] text-red-400">+{formatCurrency(enc.multa)} multa</span>
                            )}
                            {enc.juros > 0 && (
                              <span className="text-[10px] text-amber-400">+{formatCurrency(enc.juros)} juros ({enc.dias}d)</span>
                            )}
                            {enc.desconto > 0 && (
                              <span className="text-[10px] text-green-400">-{formatCurrency(enc.desconto)} desc.</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className={`font-bold text-sm ${l.tipo === 'recebimento' || l.tipo === 'a_receber' ? 'text-green-400' : 'text-red-400'}`}>
                          {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                        </p>
                      )}
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
                        {l.status === 'pago' && (
                          <button
                            onClick={() => setReciboTarget(l)}
                            title="Gerar recibo"
                            className="p-1.5 text-[#505050] hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => { setEditLancamento(l); setModalOpen(true); }} className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(l)} className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  );
                })
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

      {/* ── Modal Recibo ── */}
      {reciboTarget && (
        <ReciboModal
          lancamento={reciboTarget}
          escritorio={escritorio}
          onClose={() => setReciboTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Recibo Modal ─────────────────────────────────────────────
const RECIBO_KEY = 'msk_recibo_counter';

function ReciboModal({ lancamento: l, escritorio: esc, onClose }: {
  lancamento: Lancamento;
  escritorio: Escritorio | null;
  onClose: () => void;
}) {
  const num = useMemo(() => {
    const n = Number(localStorage.getItem(RECIBO_KEY) || 0) + 1;
    localStorage.setItem(RECIBO_KEY, String(n));
    return String(n).padStart(4, '0');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.id]);

  function handlePrint() {
    window.print();
  }

  const enc = calcEncargos(l);
  const valorFinal = enc ? enc.valorFinal : l.valor;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto no-print">
        <div className="flex justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl">
            {/* Cabeçalho do modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] no-print">
              <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Recibo Nº {num}</h2>
              <div className="flex gap-2">
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium">
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Conteúdo imprimível */}
            <div id="recibo-print" className="px-8 py-6 print-recibo space-y-4">
              {/* Cabeçalho escritório */}
              <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4">
                <div>
                  <h1 className="font-playfair text-xl font-bold text-[#f5f5f5]">{esc?.nome || 'MSK Gestor'}</h1>
                  {esc?.cnpj && <p className="text-xs text-[#505050] mt-0.5">CNPJ: {esc.cnpj}</p>}
                  {esc?.oabPrincipal && <p className="text-xs text-[#505050]">OAB: {esc.oabPrincipal}</p>}
                  {(esc?.endereco?.logradouro) && (
                    <p className="text-xs text-[#505050] mt-0.5">
                      {esc.endereco.logradouro}, {esc.endereco.numero} — {esc.endereco.cidade}/{esc.endereco.uf}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-400 font-playfair">RECIBO</p>
                  <p className="text-sm font-mono text-[#a0a0a0]">Nº {num}</p>
                  <p className="text-xs text-[#505050] mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Corpo do recibo */}
              <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-3 text-sm border border-[#2a2a2a]">
                <div className="flex gap-2">
                  <span className="text-[#505050] w-28 shrink-0">Recebemos de</span>
                  <span className="font-semibold text-[#f5f5f5]">{l.clienteNome || '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#505050] w-28 shrink-0">Referente a</span>
                  <span className="text-[#a0a0a0]">{l.descricao}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#505050] w-28 shrink-0">Forma pgto.</span>
                  <span className="text-[#a0a0a0]">{l.formaPagamento || 'Não informado'}</span>
                </div>
                {l.dataPagamento && (
                  <div className="flex gap-2">
                    <span className="text-[#505050] w-28 shrink-0">Data pgto.</span>
                    <span className="text-[#a0a0a0]">{new Date(l.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {l.observacoes && (
                  <div className="flex gap-2">
                    <span className="text-[#505050] w-28 shrink-0">Obs.</span>
                    <span className="text-[#505050] text-xs">{l.observacoes}</span>
                  </div>
                )}
              </div>

              {/* Valor de destaque */}
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4">
                <span className="text-sm font-medium text-[#a0a0a0]">Valor recebido</span>
                <span className="text-2xl font-bold text-amber-400 font-playfair">{formatCurrency(valorFinal)}</span>
              </div>

              {/* Encargos (se houver) */}
              {enc && (
                <div className="text-xs text-[#505050] space-y-1 bg-[#1a1a1a] rounded-lg px-4 py-3 border border-[#2a2a2a]">
                  <p className="font-medium text-[#a0a0a0] mb-1">Composição do valor</p>
                  <div className="flex justify-between"><span>Valor original</span><span>{formatCurrency(l.valor)}</span></div>
                  {enc.multa > 0 && <div className="flex justify-between text-red-400"><span>+ Multa</span><span>+{formatCurrency(enc.multa)}</span></div>}
                  {enc.juros > 0 && <div className="flex justify-between text-amber-400"><span>+ Juros ({enc.dias}d)</span><span>+{formatCurrency(enc.juros)}</span></div>}
                  {enc.desconto > 0 && <div className="flex justify-between text-green-400"><span>− Desconto{l.motivoDesconto ? ` (${l.motivoDesconto})` : ''}</span><span>-{formatCurrency(enc.desconto)}</span></div>}
                </div>
              )}

              {/* Assinatura */}
              <div className="flex justify-end pt-4">
                <div className="text-center w-56">
                  <div className="border-t border-[#505050] pt-2">
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
