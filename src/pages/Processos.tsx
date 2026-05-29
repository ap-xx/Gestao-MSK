import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, X, Gavel, Search, Edit2, Trash2, Eye,
  Loader2, RefreshCw, Calendar, ChevronDown, ChevronRight, Clock,
  Paperclip, FileText, Download, Upload, Layers, GripVertical,
} from 'lucide-react';
import { processosApi, clientesApi, documentosApi, escritorioApi } from '../services/api';
import type { Documento, CategoriaDocumento } from '../services/api';
import { ModeloDocumento } from '../components/modelos/ModeloDocumento';
import type { TipoModelo, ModeloDados } from '../components/modelos/ModeloDocumento';
import { consultarProcessoDataJud, TRIBUNAIS } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { downloadCsv, fmtCsvDate } from '../utils/exportCsv';
import { adicionarDiasUteis } from '../utils/prazos';
import { maskCNJ } from '../utils/masks';
import { usePersistedFilter } from '../hooks/usePersistedFilter';
import { useUndoDelete } from '../hooks/useUndoDelete';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DateInput } from '../components/ui/Input';
import { LoadingTable } from '../components/ui/LoadingTable';
import { Pagination } from '../components/ui/Pagination';
import Portal from '../components/ui/Portal';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import type { Processo, FaseProcessual, PoloProcessual, Andamento, Cliente, Escritorio } from '../types';

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
  const isReadOnly = user?.role === 'assistente';
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tipo: 'petição' as Andamento['tipo'], descricao: '', data: new Date().toISOString().split('T')[0] });
  const [prazoCalc, setPrazoCalc] = useState(false);
  const [prazoBase, setPrazoBase] = useState(new Date().toISOString().split('T')[0]);
  const [prazoDias, setPrazoDias] = useState(15);
  const prazoResultado = prazoCalc ? adicionarDiasUteis(prazoBase, prazoDias) : null;

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPrazoCalc(v => !v)}
            className={`text-xs flex items-center gap-1 transition-colors ${prazoCalc ? 'text-amber-400' : 'text-[#505050] hover:text-amber-400'}`}
            title="Calculadora de prazo em dias úteis"
          >
            <Calendar className="w-3 h-3" /> Prazo
          </button>
          {!isReadOnly && (
            <button
              onClick={() => setAdding(a => !a)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Adicionar
            </button>
          )}
        </div>
      </div>

      {/* Calculadora de prazo */}
      {prazoCalc && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-3">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Calculadora de Dias Úteis
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-[10px] text-[#505050] block mb-1">Data base</label>
              <DateInput
                className="bg-[#1e1e1e] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-[#f5f5f5] [color-scheme:dark]"
                value={prazoBase}
                onChange={e => setPrazoBase(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#505050] block mb-1">Dias úteis</label>
              <input
                type="number"
                min={1}
                max={365}
                value={prazoDias}
                onChange={e => setPrazoDias(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 bg-[#1e1e1e] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-[#f5f5f5]"
              />
            </div>
            {prazoResultado && (
              <div className="flex items-center gap-1.5 pb-1">
                <ChevronRight className="w-3 h-3 text-[#505050]" />
                <span className="text-sm font-bold text-amber-400">
                  {new Date(prazoResultado + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
                <button
                  onClick={() => { setForm(f => ({ ...f, data: prazoResultado })); setAdding(true); }}
                  className="text-[10px] text-amber-500 hover:text-amber-300 underline ml-1"
                  title="Usar esta data no novo andamento"
                >
                  usar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Timeline */}
      <div className="max-h-56 overflow-y-auto pr-1">
        {andamentos.length === 0 ? (
          <p className="text-xs text-[#505050] text-center py-4">Nenhum andamento registrado</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#2a2a2a]" />
            <div className="space-y-3">
              {[...andamentos].reverse().map((a, i) => {
                const TIPO_COLORS: Record<string, string> = {
                  petição:   'bg-purple-500 shadow-purple-500/30',
                  decisão:   'bg-red-500 shadow-red-500/30',
                  despacho:  'bg-amber-500 shadow-amber-500/30',
                  certidão:  'bg-green-500 shadow-green-500/30',
                  audiência: 'bg-blue-500 shadow-blue-500/30',
                  recurso:   'bg-orange-500 shadow-orange-500/30',
                  outro:     'bg-[#505050] shadow-none',
                };
                const dot = TIPO_COLORS[a.tipo] ?? TIPO_COLORS.outro;
                return (
                  <div key={a.id} className={`flex gap-3 ${i === 0 ? '' : ''}`}>
                    {/* Dot */}
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 shadow-lg ${dot}`} />
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[10px] font-semibold text-amber-400">
                          {new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-[#505050] bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded-full capitalize">
                          {a.tipo}
                        </span>
                        <span className="text-[10px] text-[#404040] ml-auto">{a.usuarioNome}</span>
                      </div>
                      <p className="text-xs text-[#a0a0a0] leading-relaxed">{a.descricao}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CATEGORIAS: Array<{ value: CategoriaDocumento; label: string; color: string }> = [
  { value: 'contrato',    label: 'Contrato',    color: 'text-blue-400 bg-blue-500/10' },
  { value: 'petição',     label: 'Petição',     color: 'text-purple-400 bg-purple-500/10' },
  { value: 'certidão',    label: 'Certidão',    color: 'text-green-400 bg-green-500/10' },
  { value: 'procuração',  label: 'Procuração',  color: 'text-amber-400 bg-amber-500/10' },
  { value: 'decisão',     label: 'Decisão',     color: 'text-red-400 bg-red-500/10' },
  { value: 'comprovante', label: 'Comprovante', color: 'text-cyan-400 bg-cyan-500/10' },
  { value: 'identidade',  label: 'Identidade',  color: 'text-orange-400 bg-orange-500/10' },
  { value: 'outros',      label: 'Outros',      color: 'text-gray-400 bg-gray-500/10' },
];

// ─── Documentos section ───────────────────────────────────────
function DocumentosSection({ processoId }: { processoId: string }) {
  const { showToast } = useToast();
  const { user: docUser } = useAuth();
  const isReadOnly = docUser?.role === 'assistente';
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState<CategoriaDocumento>('outros');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  const carregarDocs = useCallback(async () => {
    try {
      const data = await documentosApi.getByEntidade('processo', processoId);
      setDocs(data);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [processoId]);

  useEffect(() => { carregarDocs(); }, [carregarDocs]);

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
            await documentosApi.create({
              entidade: 'processo', entidadeId: processoId,
              nome: file.name, tipo: file.type || 'application/octet-stream', conteudo: b64, categoria: novaCategoria,
            });
            showToast('success', 'Documento anexado!');
            await carregarDocs();
            resolve();
          } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (err: any) {
      showToast('error', 'Erro ao enviar', err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDownload(doc: Documento) {
    try {
      const result = await documentosApi.download(doc.id);
      const a = document.createElement('a');
      a.href = `data:${result.tipo};base64,${result.conteudo}`;
      a.download = result.nome;
      a.click();
    } catch { showToast('error', 'Erro ao baixar'); }
  }

  async function handleRemove(id: string) {
    try {
      await documentosApi.remove(id);
      showToast('info', 'Documento removido');
      carregarDocs();
    } catch { showToast('error', 'Erro ao remover'); }
  }

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const docsFiltrados = filtroCategoria === 'todos' ? docs : docs.filter(d => d.categoria === filtroCategoria);

  return (
    <div className="border-t border-[#2a2a2a] pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[#505050] font-medium uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" /> Documentos ({docs.length})
        </p>
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <>
              <select
                value={novaCategoria}
                onChange={e => setNovaCategoria(e.target.value as CategoriaDocumento)}
                className="bg-[#1e1e1e] border border-[#2a2a2a] rounded text-[10px] text-[#a0a0a0] px-2 py-1"
              >
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <label className={`text-xs flex items-center gap-1 cursor-pointer transition-colors ${uploading ? 'text-amber-500' : 'text-amber-400 hover:text-amber-300'}`}>
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Anexar
                <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
              </label>
            </>
          )}
        </div>
      </div>

      {docs.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          <button
            onClick={() => setFiltroCategoria('todos')}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${filtroCategoria === 'todos' ? 'bg-amber-500/20 text-amber-400' : 'bg-[#1e1e1e] text-[#505050] hover:text-[#a0a0a0]'}`}
          >Todos</button>
          {CATEGORIAS.filter(c => docs.some(d => d.categoria === c.value)).map(c => (
            <button
              key={c.value}
              onClick={() => setFiltroCategoria(c.value)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${filtroCategoria === c.value ? `${c.color} font-medium` : 'bg-[#1e1e1e] text-[#505050] hover:text-[#a0a0a0]'}`}
            >{c.label}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-amber-500" /></div>
      ) : docsFiltrados.length === 0 ? (
        <p className="text-xs text-[#505050] text-center py-3">{docs.length === 0 ? 'Nenhum documento anexado' : 'Nenhum documento nesta categoria'}</p>
      ) : (
        <div className="space-y-1.5">
          {docsFiltrados.map(doc => {
            const cat = CATEGORIAS.find(c => c.value === doc.categoria) ?? CATEGORIAS[CATEGORIAS.length - 1];
            return (
              <div key={doc.id} className="flex items-center gap-2 bg-[#1e1e1e] rounded-lg px-3 py-2 text-xs group">
                <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${cat.color}`}>{cat.label}</span>
                <span className="text-[#a0a0a0] flex-1 truncate" title={doc.nome}>{doc.nome}</span>
                <span className="text-[#505050] shrink-0">{fmtSize(doc.tamanho)}</span>
                <button onClick={() => handleDownload(doc)} className="p-1 text-[#505050] hover:text-blue-400 transition-colors" title="Baixar">
                  <Download className="w-3 h-3" />
                </button>
                {!isReadOnly && (
                  <button onClick={() => handleRemove(doc.id)} className="p-1 text-[#505050] hover:text-red-400 transition-colors" title="Remover">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
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
    <Portal>
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">{isEdit ? 'Editar Processo' : 'Novo Processo'}</h2>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>

        <form id="processo-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Número CNJ + DataJud */}
          <div>
            <label className={labelClass}>Número CNJ *</label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={form.numeroCNJ}
                onChange={e => set('numeroCNJ', maskCNJ(e.target.value))}
                required
                placeholder="0000000-00.0000.0.00.0000"
                maxLength={25}
              />
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
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          <button type="submit" form="processo-form" className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20">
            {isEdit ? 'Salvar Alterações' : 'Cadastrar Processo'}
          </button>
        </div>
      </div>
      </div>
    </div>
    </Portal>
  );
}

// ─── Detalhe Modal ─────────────────────────────────────────────
function ProcessoDetalhe({ processo, onClose, onRefresh }: { processo: Processo; onClose: () => void; onRefresh: (id: string) => void }) {
  const { user } = useAuth();
  const [showDataJud, setShowDataJud] = useState(false);
  const [currentProcesso, setCurrentProcesso] = useState(processo);
  const [modeloTipo, setModeloTipo] = useState<TipoModelo | ''>('');
  const [clienteData, setClienteData] = useState<Cliente | null>(null);
  const [escritorioData, setEscritorioData] = useState<Escritorio | null>(null);

  // Load client and escritório data for document generation
  useEffect(() => {
    void (async () => {
      try {
        const [c, e] = await Promise.allSettled([
          clientesApi.getById(currentProcesso.clienteId),
          escritorioApi.get(),
        ]);
        if (c.status === 'fulfilled') setClienteData(c.value ?? null);
        if (e.status === 'fulfilled') setEscritorioData(e.value ?? null);
      } catch { /* silencioso */ }
    })();
  }, [currentProcesso.clienteId]);

  const handleAndamentoAdded = async () => {
    try {
      const updated = await processosApi.getById(currentProcesso.id);
      setCurrentProcesso(updated);
      onRefresh(currentProcesso.id);
    } catch { /* silencioso */ }
  };

  return (
    <Portal>
    <>
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Detalhes do Processo</h2>
            <p className="text-xs text-amber-400 font-mono">{currentProcesso.numeroCNJ}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={modeloTipo}
              onChange={e => setModeloTipo(e.target.value as TipoModelo | '')}
              className="bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 rounded-lg px-2.5 py-1.5 text-[#a0a0a0] text-xs transition-colors cursor-pointer"
            >
              <option value="">📄 Gerar Modelo</option>
              <option value="procuracao">Procuração</option>
              <option value="contrato_honorarios">Contrato de Honorários</option>
              <option value="declaracao">Declaração de Hipossuficiência</option>
            </select>
            <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
          </div>
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

          {/* Documentos */}
          <DocumentosSection processoId={currentProcesso.id} />

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

    {modeloTipo && (
      <ModeloDocumento
        open={true}
        onClose={() => setModeloTipo('')}
        tipo={modeloTipo as TipoModelo}
        dados={{
          clienteNome:   currentProcesso.clienteNome,
          clienteCpf:    clienteData?.cpf,
          clienteCnpj:   clienteData?.cnpj,
          advogadoNome:  user?.nome || 'Advogado Responsável',
          advogadoOAB:   user?.oab || '',
          escritorioNome: escritorioData?.nome || 'MSK Advocacia',
          cidade:        clienteData?.endereco?.cidade || escritorioData?.endereco?.cidade,
        } as ModeloDados}
      />
    )}
    </>
    </Portal>
  );
}

// ─── Página Principal ─────────────────────────────────────────
export default function Processos() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'assistente';
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,     setSearch]     = usePersistedFilter('proc_search', '');
  const [filterFase, setFilterFase] = usePersistedFilter('proc_fase', 'todos');
  const [filterArea, setFilterArea] = usePersistedFilter('proc_area', 'todos');
  const [pageSize,   setPageSize]   = usePersistedFilter<number>('proc_pagesize', 15);
  const undoDelete = useUndoDelete<Processo>('Processo');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<Processo | undefined>();
  const [viewProcesso, setViewProcesso] = useState<Processo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete,    setToDelete]    = useState<Processo | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [quickStatusId, setQuickStatusId] = useState<string | null>(null);
  const [quickStatusPos, setQuickStatusPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<'tabela' | 'kanban'>(
    () => (localStorage.getItem('msk_proc_view') as 'tabela' | 'kanban') || 'tabela'
  );
  const [dragFase, setDragFase] = useState<string | null>(null); // fase being dragged over

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

  // Atalho de teclado: N → Novo Processo
  useEffect(() => {
    if (isReadOnly) return;
    function handle() { setEditProcesso(undefined); setModalOpen(true); }
    window.addEventListener('msk:shortcut:novo', handle);
    return () => window.removeEventListener('msk:shortcut:novo', handle);
  }, [isReadOnly]);

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
  const pagination = usePagination(sorted, pageSize);

  function handleDelete(p: Processo) {
    undoDelete(
      p,
      item => setProcessos(prev => prev.filter(x => x.id !== item.id)),
      item => setProcessos(prev => [...prev, item]),
      item => processosApi.remove(item.id).then(() => {}),
    );
  }

  async function doDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await processosApi.remove(toDelete.id);
      await reload();
      showToast('info', 'Processo removido', toDelete.numeroCNJ);
    } catch (err: any) {
      showToast('error', 'Erro ao excluir', err.message);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setToDelete(null);
    }
  }

  async function handleQuickStatus(p: Processo, newStatus: string) {
    setQuickStatusId(null);
    if (p.status === newStatus) return;
    try {
      await processosApi.update(p.id, { status: newStatus as Processo['status'] });
      await reload();
      showToast('success', 'Status atualizado!', `${p.numeroCNJ} → ${newStatus}`);
    } catch (err: any) {
      showToast('error', 'Erro ao atualizar status', err.message);
    }
  }

  const STATUS_PROC_COLORS: Record<string, string> = {
    ativo: 'bg-green-500/15 text-green-400 border-green-500/30',
    suspenso: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    encerrado: 'bg-red-500/15 text-red-400 border-red-500/30',
    arquivado: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  };

  const SortIcon = ({ col }: { col: keyof Processo }) => (
    <span className="ml-1 opacity-60">{sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

  // Close quick status dropdown on outside click
  useEffect(() => {
    if (!quickStatusId) return;
    function handleClick() { setQuickStatusId(null); setQuickStatusPos(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [quickStatusId]);

  function openQuickStatus(e: React.MouseEvent<HTMLButtonElement>, p: Processo) {
    e.stopPropagation();
    if (quickStatusId === p.id) { setQuickStatusId(null); setQuickStatusPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const above = window.innerHeight - rect.bottom < 170;
    setQuickStatusPos({
      x: rect.left,
      y: above ? rect.top - 4 : rect.bottom + 4,
      above,
    });
    setQuickStatusId(p.id);
  }

  // ─── Kanban handlers ─────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, processoId: string) {
    e.dataTransfer.setData('processoId', processoId);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function handleKanbanDrop(e: React.DragEvent, novaFase: FaseProcessual) {
    e.preventDefault();
    setDragFase(null);
    const id = e.dataTransfer.getData('processoId');
    if (!id) return;
    const proc = processos.find(p => p.id === id);
    if (!proc || proc.fase === novaFase) return;
    try {
      await processosApi.update(id, { fase: novaFase });
      setProcessos(prev => prev.map(p => p.id === id ? { ...p, fase: novaFase } : p));
      showToast('success', 'Fase atualizada!', `${proc.numeroCNJ} → ${novaFase}`);
    } catch (err: any) {
      showToast('error', 'Erro ao mover processo', err.message);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Processos</h1>
          <p className="text-[#a0a0a0] text-sm">{filtered.length} processos encontrados</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
            <button
              onClick={() => { setViewMode('tabela'); localStorage.setItem('msk_proc_view', 'tabela'); }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'tabela' ? 'bg-amber-500 text-white shadow-sm' : 'text-[#505050] hover:text-[#a0a0a0]'}`}
              title="Visualização em tabela"
            >
              <RefreshCw className="w-3 h-3" style={{ transform: 'none' }} />
              Tabela
            </button>
            <button
              onClick={() => { setViewMode('kanban'); localStorage.setItem('msk_proc_view', 'kanban'); }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-amber-500 text-white shadow-sm' : 'text-[#505050] hover:text-[#a0a0a0]'}`}
              title="Visualização Kanban por fase"
            >
              <Layers className="w-3 h-3" />
              Kanban
            </button>
          </div>
          {/* Export CSV */}
          <button
            onClick={() => downloadCsv(
              `processos_${new Date().toISOString().slice(0,10)}.csv`,
              ['Nº CNJ', 'Cliente', 'Área', 'Vara', 'Fase', 'Status', 'Polo', 'Distribuição', 'Próx. Audiência'],
              sorted.map(p => [
                p.numeroCNJ, p.clienteNome, p.areaAtuacao, p.vara, p.fase, p.status,
                p.polo || '', fmtCsvDate(p.criadoEm), fmtCsvDate(p.proximaAudiencia),
              ]),
            )}
            className="flex items-center gap-2 px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-green-500/30 text-[#a0a0a0] hover:text-green-400 rounded-lg text-sm font-medium transition-all"
            title="Exportar lista filtrada para CSV"
          >
            <FileText className="w-4 h-4" />
            CSV
          </button>
          {!isReadOnly && (
            <button
              onClick={() => { setEditProcesso(undefined); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              Novo Processo
            </button>
          )}
        </div>
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
        {viewMode === 'tabela' && (
          <select className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-sm" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} title="Itens por página">
            <option value={15}>15 / pág</option>
            <option value={30}>30 / pág</option>
            <option value={50}>50 / pág</option>
          </select>
        )}
      </div>

      {/* ── Tabela ──────────────────────────────────────────── */}
      {viewMode === 'tabela' && <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
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
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              {loading ? (
                <LoadingTable cols={6} />
              ) : pagination.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#505050]">
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
                      {isReadOnly ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_PROC_COLORS[p.status] ?? STATUS_PROC_COLORS.ativo}`}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      ) : (
                        <button
                          onClick={e => openQuickStatus(e, p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-80 ${STATUS_PROC_COLORS[p.status] ?? STATUS_PROC_COLORS.ativo}`}
                          title="Clique para alterar status"
                        >
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewProcesso(p)} className="p-1.5 text-[#505050] hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                        {!isReadOnly && <button onClick={() => { setEditProcesso(p); setModalOpen(true); }} className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>}
                        {!isReadOnly && <button onClick={() => handleDelete(p)} className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination {...pagination} />
      </div>}

      {/* ── Kanban ──────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-3 min-w-max">
            {FASES.map(fase => {
              const cards = filtered.filter(p => p.fase === fase);
              const isOver = dragFase === fase;
              return (
                <div
                  key={fase}
                  className={`flex flex-col w-56 rounded-xl border transition-all ${
                    isOver
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-[#2a2a2a] bg-[#141414]'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragFase(fase); }}
                  onDragLeave={() => setDragFase(null)}
                  onDrop={e => handleKanbanDrop(e, fase)}
                >
                  {/* Column header */}
                  <div className="px-3 py-2.5 border-b border-[#2a2a2a] flex items-center justify-between shrink-0">
                    <span className={`text-xs font-semibold ${FASE_COLORS[fase]?.split(' ')[0] || 'text-[#a0a0a0]'}`}>{fase}</span>
                    <span className="text-[10px] bg-[#1e1e1e] text-[#505050] px-1.5 py-0.5 rounded-full font-medium">{cards.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                    {cards.map(p => (
                      <div
                        key={p.id}
                        draggable={!isReadOnly}
                        onDragStart={e => handleDragStart(e, p.id)}
                        onClick={() => setViewProcesso(p)}
                        className={`bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg p-2.5 cursor-pointer transition-all group ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono text-amber-400 truncate leading-relaxed">{p.numeroCNJ}</span>
                          {!isReadOnly && <GripVertical className="w-3 h-3 text-[#404040] group-hover:text-[#606060] shrink-0 mt-0.5" />}
                        </div>
                        <p className="text-xs font-medium text-[#f5f5f5] truncate mb-1">{p.clienteNome}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-[#505050]">{p.areaAtuacao}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_PROC_COLORS[p.status] ?? ''}`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <div className="flex items-center justify-center flex-1 py-4">
                        <span className="text-[11px] text-[#303030]">Vazio</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Excluir Processo"
        message={`Tem certeza que deseja excluir o processo ${toDelete?.numeroCNJ}? Todos os andamentos serão perdidos.`}
        onConfirm={doDelete}
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
        loading={deleting}
      />

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

      {/* Quick status dropdown — rendered via Portal to avoid overflow clipping */}
      {quickStatusId && quickStatusPos && (() => {
        const proc = processos.find(p => p.id === quickStatusId);
        if (!proc) return null;
        const ITEM_H = 32;
        const ITEMS = 4;
        const dropH = ITEMS * ITEM_H + 8;
        return (
          <Portal>
            <div
              className="fixed z-[200] bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden min-w-[140px] py-1"
              style={quickStatusPos.above
                ? { top: quickStatusPos.y - dropH, left: quickStatusPos.x }
                : { top: quickStatusPos.y, left: quickStatusPos.x }
              }
              onMouseDown={e => e.stopPropagation()}
            >
              {(['ativo', 'suspenso', 'encerrado', 'arquivado'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { handleQuickStatus(proc, s); setQuickStatusId(null); setQuickStatusPos(null); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#252525] ${proc.status === s ? 'text-amber-400 font-medium' : 'text-[#a0a0a0]'}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </Portal>
        );
      })()}
    </div>
  );
}
