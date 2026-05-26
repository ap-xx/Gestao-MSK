import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, X, Gavel, Search, Edit2, Trash2, Eye,
  Loader2, RefreshCw, Calendar, ChevronDown, ChevronRight, Clock,
} from 'lucide-react';
import { processosApi, clientesApi } from '../services/api';
import { consultarProcessoDataJud, TRIBUNAIS } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { DateInput } from '../components/ui/Input';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import type { Processo, FaseProcessual, PoloProcessual, Andamento, Cliente } from '../types';

const FASES: FaseProcessual[] = ['Inicial', 'Conhecimento', 'Instrução', 'Sentença', 'Recursal', 'Execução', 'Transitado em Julgado', 'Arquivado'];
const POLOS: PoloProcessual[] = ['Ativo', 'Passivo', 'Terceiro'];
const AREAS = ['Cível', 'Trabalhista', 'Criminal', 'Empresarial', 'Tributário', 'Imobiliário', 'Família e Sucessões', 'Previdenciário', 'Administrativo', 'Outro'];
const TIPOS_ANDAMENTO: Andamento['tipo'][] = ['petição', 'decisão', 'despacho', 'certidão', 'audiência', 'recurso', 'outro'];

const FASE_COLORS: Record<string, string> = {
  'Inicial': 'text-blue-400 bg-blue-500/10',
  'Conhecimento': 'text-cyan-400 bg-cyan-500/10',
  'Instrução': 'text-amber-400 bg-amber-500/10',
  'Sentença': 'text-orange-400 bg-orange-500/10',
  'Recursal': 'text-purple-400 bg-purple-500/10',
  'Execução': 'text-red-400 bg-red-500/10',
  'Transitado em Julgado': 'text-green-400 bg-green-500/10',
  'Arquivado': 'text-gray-400 bg-gray-500/10',
};

const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

// ─── Andamentos section ────────────────────────────────────────
function AndamentosSection({ processoId, andamentos, onAdded }: {
  processoId: string;
  andamentos: Andamento[];
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tipo: 'petição' as Andamento['tipo'], descricao: '', data: new Date().toISOString().split('T')[0] });

  async function handleAdd() {
    if (!form.descricao.trim()) { showToast('warning', 'Informe a descrição'); return; }
    try {
      await processosApi.addAndamento(processoId, {
        tipo: form.tipo,
        descricao: form.descricao,
        data: form.data,
        usuarioNome: user?.nome || 'Sistema',
      });
      setForm({ tipo: 'petição', descricao: '', data: new Date().toISOString().split('T')[0] });
      setAdding(false);
      onAdded();
      showToast('success', 'Andamento registrado!');
    } catch (err: any) {
      showToast('error', 'Erro', err.message);
    }
  }

  return (
    <div className="border-t border-[#2a2a2a] pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#505050] font-medium uppercase tracking-wider">Andamentos ({andamentos.length})</p>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>

      {adding && (
        <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-3 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Tipo</label>
              <select className={inputClass} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Andamento['tipo'] }))}>
                {TIPOS_ANDAMENTO.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Data</label>
              <DateInput className={inputClass} value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva o andamento processual..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-1.5 text-xs bg-[#141414] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg">Cancelar</button>
            <button onClick={handleAdd} className="flex-1 py-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white rounded-lg font-medium">Registrar</button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {andamentos.length === 0 ? (
          <p className="text-xs text-[#505050] text-center py-4">Nenhum andamento registrado</p>
        ) : (
          [...andamentos].reverse().map(a => (
            <div key={a.id} className="bg-[#1e1e1e] rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-amber-400 font-medium">{new Date(a.data).toLocaleDateString('pt-BR')}</span>
                <span className="text-[#505050] bg-[#252525] px-1.5 py-0.5 rounded">{a.tipo}</span>
                <span className="text-[#505050] ml-auto">{a.usuarioNome}</span>
              </div>
              <p className="text-[#a0a0a0] leading-relaxed">{a.descricao}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────
interface ModalProps {
  processo?: Processo;
  clientes: Cliente[];
  onClose: () => void;
  onSave: () => void;
}

function ProcessoModal({ processo, clientes, onClose, onSave }: ModalProps) {
  const { showToast } = useToast();
  const isEdit = !!processo;
  const tribunaisLista = Object.entries(TRIBUNAIS);

  const [form, setForm] = useState({
    numeroCNJ: processo?.numeroCNJ || '',
    clienteId: processo?.clienteId || '',
    tribunalAlias: processo?.tribunalAlias || 'tjsp',
    vara: processo?.vara || '',
    juiz: processo?.juiz || '',
    areaAtuacao: processo?.areaAtuacao || 'Cível',
    fase: (processo?.fase || 'Inicial') as FaseProcessual,
    polo: (processo?.polo || 'Ativo') as PoloProcessual,
    parteAdversa: processo?.parteAdversa || '',
    advogadoAdverso: processo?.advogadoAdverso || '',
    valorCausa: processo?.valorCausa?.toString() || '',
    status: processo?.status || 'ativo',
    observacoes: processo?.observacoes || '',
    // Audiência
    audData: '',
    audHora: '',
    audTipo: 'Audiência de Instrução',
    audLocal: '',
  });

  const [audiencias, setAudiencias] = useState(processo?.audiencias || []);
  const [consultandoDataJud, setConsultandoDataJud] = useState(false);
  const [dadosDataJud, setDadosDataJud] = useState<any>(null);

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function consultarDataJud() {
    if (!form.numeroCNJ) { showToast('warning', 'Informe o número CNJ'); return; }
    setConsultandoDataJud(true);
    try {
      const result = await consultarProcessoDataJud(form.numeroCNJ, form.tribunalAlias);
      if (result.hits.hits.length === 0) {
        showToast('warning', 'Processo não encontrado', 'Verifique o número CNJ e o tribunal selecionado.');
        return;
      }
      const hit = result.hits.hits[0]._source;
      setDadosDataJud(hit);
      const ourPolo = form.polo.toUpperCase();
      const parteAdversaItem = hit.partes?.find((p: any) => p.polo !== ourPolo);
      const parteAdversaNome = parteAdversaItem?.nome;
      const advogadoAdversoNome = parteAdversaItem?.advogados?.[0]?.nome;
      setForm(prev => ({
        ...prev,
        vara: hit.orgaoJulgador?.nome || prev.vara,
        parteAdversa: parteAdversaNome || prev.parteAdversa,
        advogadoAdverso: advogadoAdversoNome || prev.advogadoAdverso,
      }));
      const extra = parteAdversaNome ? ` · Parte adversa: ${parteAdversaNome}` : '';
      showToast('success', 'Dados obtidos do DataJud!', `Atualizado: ${new Date(hit.dataHoraUltimaAtualizacao).toLocaleDateString('pt-BR')}${extra}`);
    } catch (err: any) {
      showToast('error', 'Erro DataJud', err.message);
    } finally {
      setConsultandoDataJud(false);
    }
  }

  function addAudiencia() {
    if (!form.audData) { showToast('warning', 'Informe a data da audiência'); return; }
    setAudiencias(prev => [...prev, { data: form.audData, hora: form.audHora, tipo: form.audTipo, local: form.audLocal }]);
    setForm(prev => ({ ...prev, audData: '', audHora: '', audLocal: '' }));
  }

  function removeAudiencia(i: number) {
    setAudiencias(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clienteId) { showToast('warning', 'Selecione um cliente'); return; }
    const cliente = clientes.find(c => c.id === form.clienteId);
    const now = new Date().toISOString();
    const prox = audiencias.filter(a => new Date(a.data) >= new Date()).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())[0]?.data;

    const payload: Omit<Processo, 'id'> = {
      numeroCNJ: form.numeroCNJ,
      clienteId: form.clienteId,
      clienteNome: cliente?.nome || '',
      tribunal: TRIBUNAIS[form.tribunalAlias]?.nome || '',
      tribunalAlias: form.tribunalAlias,
      vara: form.vara,
      juiz: form.juiz || undefined,
      areaAtuacao: form.areaAtuacao,
      fase: form.fase,
      polo: form.polo,
      parteAdversa: form.parteAdversa,
      advogadoAdverso: form.advogadoAdverso || undefined,
      valorCausa: form.valorCausa ? parseFloat(form.valorCausa) : undefined,
      audiencias,
      proximaAudiencia: prox,
      status: form.status as any,
      observacoes: form.observacoes || undefined,
      dadosDataJud: dadosDataJud,
      criadoEm: processo?.criadoEm || now,
      atualizadoEm: now,
    };

    try {
      if (isEdit) await processosApi.update(processo.id, payload);
      else await processosApi.create(payload);
      showToast('success', isEdit ? 'Processo atualizado!' : 'Processo cadastrado!', payload.numeroCNJ);
      onSave();
    } catch (err: any) {
      showToast('error', 'Erro ao salvar', err.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">{isEdit ? 'Editar Processo' : 'Novo Processo'}</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>

        <form id="processo-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Número CNJ + DataJud */}
          <div>
            <label className={labelClass}>Número CNJ *</label>
            <div className="flex gap-2">
              <input className={inputClass} value={form.numeroCNJ} onChange={e => set('numeroCNJ', e.target.value)} required placeholder="0000000-00.0000.0.00.0000" />
              <select className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm min-w-28" value={form.tribunalAlias} onChange={e => set('tribunalAlias', e.target.value)}>
                {tribunaisLista.map(([alias]) => <option key={alias} value={alias}>{alias.toUpperCase()}</option>)}
              </select>
              <button type="button" onClick={consultarDataJud} disabled={consultandoDataJud} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
                {consultandoDataJud ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                DataJud
              </button>
            </div>
            <p className="text-xs text-[#505050] mt-1">Use "DataJud" para buscar dados atualizados no CNJ.</p>
          </div>

          {dadosDataJud && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-blue-400 mb-2">✓ Dados do DataJud</p>
              <div className="grid grid-cols-2 gap-2 text-[#a0a0a0]">
                <div><span className="text-[#505050]">Classe:</span> {dadosDataJud.classe?.nome}</div>
                <div><span className="text-[#505050]">Grau:</span> {dadosDataJud.grau}</div>
                <div><span className="text-[#505050]">Ajuizamento:</span> {dadosDataJud.dataAjuizamento ? new Date(dadosDataJud.dataAjuizamento).toLocaleDateString('pt-BR') : '—'}</div>
                <div><span className="text-[#505050]">Atualizado:</span> {new Date(dadosDataJud.dataHoraUltimaAtualizacao).toLocaleDateString('pt-BR')}</div>
                {dadosDataJud.assuntos?.[0] && <div className="col-span-2"><span className="text-[#505050]">Assunto:</span> {dadosDataJud.assuntos[0].nome}</div>}
              </div>
              {dadosDataJud.movimentos?.slice(0, 3).map((m: any, i: number) => (
                <p key={i} className="text-[#505050] text-[11px]">• {m.nome} — {new Date(m.dataHora).toLocaleDateString('pt-BR')}</p>
              ))}
            </div>
          )}

          <div>
            <label className={labelClass}>Cliente *</label>
            <select className={inputClass} value={form.clienteId} onChange={e => set('clienteId', e.target.value)} required>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tribunal</label>
              <input className={inputClass} value={TRIBUNAIS[form.tribunalAlias]?.nome || ''} readOnly />
            </div>
            <div>
              <label className={labelClass}>Vara / Juízo</label>
              <input className={inputClass} value={form.vara} onChange={e => set('vara', e.target.value)} placeholder="Ex: 5ª Vara do Trabalho" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Área de Atuação</label>
              <select className={inputClass} value={form.areaAtuacao} onChange={e => set('areaAtuacao', e.target.value)}>
                {AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Fase Processual</label>
              <select className={inputClass} value={form.fase} onChange={e => set('fase', e.target.value as FaseProcessual)}>
                {FASES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Polo</label>
              <select className={inputClass} value={form.polo} onChange={e => set('polo', e.target.value as PoloProcessual)}>
                {POLOS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Parte Adversa *</label>
              <input className={inputClass} value={form.parteAdversa} onChange={e => set('parteAdversa', e.target.value)} required placeholder="Nome da parte adversa" />
            </div>
            <div>
              <label className={labelClass}>Advogado Adverso</label>
              <input className={inputClass} value={form.advogadoAdverso} onChange={e => set('advogadoAdverso', e.target.value)} placeholder="Dr. Nome OAB 000000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Valor da Causa (R$)</label>
              <input type="number" className={inputClass} value={form.valorCausa} onChange={e => set('valorCausa', e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ativo">Ativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="encerrado">Encerrado</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
          </div>

          {/* Audiências */}
          <div>
            <h3 className="text-sm font-semibold text-[#a0a0a0] mb-3 border-b border-[#2a2a2a] pb-2">Audiências</h3>
            {audiencias.length > 0 && (
              <div className="space-y-2 mb-3">
                {audiencias.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#1e1e1e] rounded-lg px-3 py-2 text-xs">
                    <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-amber-400 font-medium">{new Date(a.data).toLocaleDateString('pt-BR')}</span>
                    {a.hora && <span className="text-[#505050]">{a.hora}</span>}
                    <span className="text-[#a0a0a0] flex-1">{a.tipo}</span>
                    {a.local && <span className="text-[#505050]">{a.local}</span>}
                    <button type="button" onClick={() => removeAudiencia(i)} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <DateInput className={inputClass} value={form.audData} onChange={e => set('audData', e.target.value)} />
              <input type="time" className={inputClass} value={form.audHora} onChange={e => set('audHora', e.target.value)} />
              <input className={inputClass} value={form.audTipo} onChange={e => set('audTipo', e.target.value)} placeholder="Tipo de audiência" />
              <input className={inputClass} value={form.audLocal} onChange={e => set('audLocal', e.target.value)} placeholder="Local / Sala" />
            </div>
            <button type="button" onClick={addAudiencia} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Adicionar audiência
            </button>
          </div>

          <div>
            <label className={labelClass}>Observações</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Observações sobre o processo..." />
          </div>

        </form>

        {/* Sticky footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a] shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          <button type="submit" form="processo-form" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
            {isEdit ? 'Salvar Alterações' : 'Cadastrar Processo'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Detalhe Modal ─────────────────────────────────────────────
function ProcessoDetalhe({ processo, onClose, onRefresh }: { processo: Processo; onClose: () => void; onRefresh: (id: string) => void }) {
  const [showDataJud, setShowDataJud] = useState(false);
  const [currentProcesso, setCurrentProcesso] = useState(processo);

  const handleAndamentoAdded = async () => {
    try {
      const updated = await processosApi.getById(currentProcesso.id);
      setCurrentProcesso(updated);
      onRefresh(currentProcesso.id);
    } catch { /* silencioso */ }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] sticky top-0 bg-[#141414]">
          <div>
            <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Detalhes do Processo</h2>
            <p className="text-xs text-amber-400 font-mono">{currentProcesso.numeroCNJ}</p>
          </div>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-[#505050]">Cliente</p><p className="text-[#f5f5f5] font-medium">{currentProcesso.clienteNome}</p></div>
            <div><p className="text-xs text-[#505050]">Tribunal</p><p className="text-[#f5f5f5]">{currentProcesso.tribunal}</p></div>
            <div><p className="text-xs text-[#505050]">Vara / Juízo</p><p className="text-[#f5f5f5]">{currentProcesso.vara}</p></div>
            <div><p className="text-xs text-[#505050]">Área</p><p className="text-[#f5f5f5]">{currentProcesso.areaAtuacao}</p></div>
            <div><p className="text-xs text-[#505050]">Fase</p><span className={`text-xs font-medium px-2 py-1 rounded-full ${FASE_COLORS[currentProcesso.fase]}`}>{currentProcesso.fase}</span></div>
            <div><p className="text-xs text-[#505050]">Polo</p><p className="text-[#f5f5f5]">{currentProcesso.polo}</p></div>
            <div><p className="text-xs text-[#505050]">Parte Adversa</p><p className="text-[#f5f5f5]">{currentProcesso.parteAdversa}</p></div>
            {currentProcesso.advogadoAdverso && <div><p className="text-xs text-[#505050]">Advogado Adverso</p><p className="text-[#f5f5f5]">{currentProcesso.advogadoAdverso}</p></div>}
            {currentProcesso.valorCausa && <div><p className="text-xs text-[#505050]">Valor da Causa</p><p className="text-[#f5f5f5]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentProcesso.valorCausa)}</p></div>}
          </div>

          {/* Audiências */}
          {currentProcesso.audiencias.length > 0 && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <p className="text-xs text-[#505050] mb-2 font-medium">Audiências</p>
              <div className="space-y-2">
                {currentProcesso.audiencias.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#1e1e1e] rounded-lg px-3 py-2 text-xs">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 font-medium">{new Date(a.data).toLocaleDateString('pt-BR')}</span>
                    {a.hora && <span className="text-[#a0a0a0]">{a.hora}</span>}
                    <span className="text-[#f5f5f5] flex-1">{a.tipo}</span>
                    {a.local && <span className="text-[#505050] text-right">{a.local}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Andamentos */}
          <AndamentosSection
            processoId={currentProcesso.id}
            andamentos={currentProcesso.andamentos || []}
            onAdded={handleAndamentoAdded}
          />

          {/* DataJud */}
          {currentProcesso.dadosDataJud && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <button
                onClick={() => setShowDataJud(!showDataJud)}
                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showDataJud ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Dados do DataJud CNJ
              </button>
              {showDataJud && (
                <div className="mt-3 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-1.5 text-xs text-[#a0a0a0]">
                  <div><span className="text-[#505050]">Classe:</span> {currentProcesso.dadosDataJud.classe?.nome}</div>
                  <div><span className="text-[#505050]">Grau:</span> {currentProcesso.dadosDataJud.grau}</div>
                  {currentProcesso.dadosDataJud.movimentos?.map((m: any, i: number) => (
                    <div key={i}>• {m.nome} — {new Date(m.dataHora).toLocaleDateString('pt-BR')}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentProcesso.observacoes && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <p className="text-xs text-[#505050] mb-1">Observações</p>
              <p className="text-[#a0a0a0]">{currentProcesso.observacoes}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────
export default function Processos() {
  const { showToast } = useToast();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFase, setFilterFase] = useState('todos');
  const [filterArea, setFilterArea] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<Processo | undefined>();
  const [viewProcesso, setViewProcesso] = useState<Processo | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([processosApi.getAll(), clientesApi.getAll()]);
      setProcessos(p);
      setClientes(c);
    } catch {
      showToast('error', 'Erro', 'Não foi possível carregar processos');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const handleRefreshProcesso = useCallback((id: string) => {
    processosApi.getById(id).then(updated => {
      setProcessos(prev => prev.map(p => p.id === id ? updated : p));
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return processos.filter(p => {
      const q = search.toLowerCase();
      const match = !q || p.clienteNome.toLowerCase().includes(q) ||
        p.numeroCNJ.includes(q) || p.parteAdversa.toLowerCase().includes(q) ||
        p.vara.toLowerCase().includes(q);
      const matchFase = filterFase === 'todos' || p.fase === filterFase;
      const matchArea = filterArea === 'todos' || p.areaAtuacao === filterArea;
      return match && matchFase && matchArea;
    });
  }, [processos, search, filterFase, filterArea]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, 'clienteNome');
  const pagination = usePagination(sorted, 15);

  async function handleDelete(p: Processo) {
    if (!window.confirm(`Excluir processo "${p.numeroCNJ}"?`)) return;
    try {
      await processosApi.remove(p.id);
      await reload();
      showToast('info', 'Processo removido');
    } catch (err: any) {
      showToast('error', 'Erro', err.message);
    }
  }

  const SortIcon = ({ col }: { col: keyof Processo }) => (
    <span className="ml-1 opacity-60">{sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Processos</h1>
          <p className="text-[#a0a0a0] text-sm">{filtered.length} processos encontrados</p>
        </div>
        <button
          onClick={() => { setEditProcesso(undefined); setModalOpen(true); }}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Novo Processo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#505050]" />
          <input
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050]"
            placeholder="Buscar por CNJ, cliente, vara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterFase} onChange={e => setFilterFase(e.target.value)}>
          <option value="todos">Todas as fases</option>
          {FASES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="todos">Todas as áreas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Processo</th>
                <th onClick={() => toggle('clienteNome')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell cursor-pointer select-none hover:text-[#a0a0a0]">
                  Cliente / Parte Adversa <SortIcon col="clienteNome" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell">Tribunal / Vara</th>
                <th onClick={() => toggle('fase')} className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider cursor-pointer select-none hover:text-[#a0a0a0]">
                  Fase <SortIcon col="fase" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell">Próx. Audiência</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {loading ? (
                <LoadingTable cols={6} />
              ) : pagination.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#505050]">
                    <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum processo encontrado</p>
                  </td>
                </tr>
              ) : (
                pagination.items.map(p => (
                  <tr key={p.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-mono text-amber-400 text-xs font-medium">{p.numeroCNJ}</p>
                      <p className="text-[#505050] text-xs mt-0.5">{p.areaAtuacao} · Polo {p.polo}</p>
                      {(p.andamentos?.length ?? 0) > 0 && (
                        <p className="text-[10px] text-blue-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {p.andamentos!.length} andamento(s)
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-[#f5f5f5] font-medium">{p.clienteNome}</p>
                      <p className="text-xs text-[#505050]">vs. {p.parteAdversa}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-xs text-[#a0a0a0]">{p.tribunal}</p>
                      <p className="text-xs text-[#505050] truncate max-w-48">{p.vara}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${FASE_COLORS[p.fase]}`}>
                        {p.fase}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      {p.proximaAudiencia ? (
                        <div>
                          <p className="text-xs text-amber-400 font-medium">
                            {new Date(p.proximaAudiencia).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-[10px] text-[#505050]">
                            {Math.ceil((new Date(p.proximaAudiencia).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d restantes
                          </p>
                        </div>
                      ) : (
                        <span className="text-[#505050] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewProcesso(p)} className="p-1.5 text-[#505050] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => { setEditProcesso(p); setModalOpen(true); }} className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p)} className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
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

      {modalOpen && (
        <ProcessoModal
          processo={editProcesso}
          clientes={clientes}
          onClose={() => { setModalOpen(false); setEditProcesso(undefined); }}
          onSave={() => { reload(); setModalOpen(false); setEditProcesso(undefined); }}
        />
      )}
      {viewProcesso && (
        <ProcessoDetalhe
          processo={viewProcesso}
          onClose={() => setViewProcesso(null)}
          onRefresh={handleRefreshProcesso}
        />
      )}
    </div>
  );
}
