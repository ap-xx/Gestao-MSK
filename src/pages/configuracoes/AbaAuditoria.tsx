import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ClipboardList, RefreshCw, Loader2, Trash2, AlertCircle,
} from 'lucide-react';
import { auditoriaApi } from '../../services/api';
import type { AuditEntry } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export default function AbaAuditoria() {
  const { showToast } = useToast();
  const { user }      = useAuth();
  const isAdmin       = user?.role === 'admin';

  // ── Data ──────────────────────────────────────────────────────
  const [auditorias, setAuditorias] = useState<AuditEntry[]>([]);
  const [loading,    setLoading]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAuditorias(await auditoriaApi.getAll()); }
    catch { showToast('error', 'Erro ao carregar log de auditoria'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // ── Filters ───────────────────────────────────────────────────
  const [filtroAcao,       setFiltroAcao]       = useState('');
  const [filtroUsuario,    setFiltroUsuario]     = useState('');
  const [filtroDataInicio, setFiltroDataInicio]  = useState('');
  const [filtroDataFim,    setFiltroDataFim]     = useState('');
  const [filtroHoraInicio, setFiltroHoraInicio]  = useState('');
  const [filtroHoraFim,    setFiltroHoraFim]     = useState('');

  const acoes    = useMemo(() => [...new Set(auditorias.map(a => a.acao))].sort(), [auditorias]);
  const usuarios = useMemo(() => [...new Set(auditorias.map(a => a.userNome))].sort(), [auditorias]);

  const filtered = useMemo(() => auditorias.filter(a => {
    if (filtroAcao    && a.acao     !== filtroAcao)    return false;
    if (filtroUsuario && a.userNome !== filtroUsuario) return false;
    const dt      = new Date(a.criadoEm);
    const dateStr = dt.toISOString().slice(0, 10);
    const timeStr = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    if (filtroDataInicio && dateStr < filtroDataInicio) return false;
    if (filtroDataFim    && dateStr > filtroDataFim)    return false;
    if (filtroHoraInicio && timeStr < filtroHoraInicio) return false;
    if (filtroHoraFim    && timeStr > filtroHoraFim)    return false;
    return true;
  }), [auditorias, filtroAcao, filtroUsuario, filtroDataInicio, filtroDataFim, filtroHoraInicio, filtroHoraFim]);

  const hasFilter = !!(filtroAcao || filtroUsuario || filtroDataInicio || filtroDataFim || filtroHoraInicio || filtroHoraFim);

  // ── Cleanup ───────────────────────────────────────────────────
  const [limpezaModo,    setLimpezaModo]    = useState<'antes' | 'periodo' | 'tudo'>('antes');
  const [limpezaInicio,  setLimpezaInicio]  = useState('');
  const [limpezaFim,     setLimpezaFim]     = useState('');
  const [limpezaLoading, setLimpezaLoading] = useState(false);
  const [confirmOpen,    setConfirmOpen]    = useState(false);

  const limpezaPreview = useMemo(() => auditorias.filter(e => {
    const t = e.criadoEm;
    if (limpezaModo === 'tudo') return true;
    if (limpezaModo === 'antes') return limpezaFim ? t <= limpezaFim + 'T23:59:59Z' : false;
    const from = limpezaInicio ? limpezaInicio + 'T00:00:00Z' : undefined;
    const to   = limpezaFim    ? limpezaFim    + 'T23:59:59Z' : undefined;
    if (from && t < from) return false;
    if (to   && t > to  ) return false;
    return true;
  }).length, [auditorias, limpezaModo, limpezaInicio, limpezaFim]);

  async function executarLimpeza() {
    setLimpezaLoading(true);
    try {
      let removed = 0;
      if (limpezaModo === 'tudo') {
        removed = await auditoriaApi.limparTudo();
      } else if (limpezaModo === 'antes') {
        removed = await auditoriaApi.limpar(undefined, limpezaFim ? limpezaFim + 'T23:59:59.999Z' : undefined);
      } else {
        removed = await auditoriaApi.limpar(
          limpezaInicio ? limpezaInicio + 'T00:00:00.000Z' : undefined,
          limpezaFim    ? limpezaFim    + 'T23:59:59.999Z' : undefined,
        );
      }
      await load();
      setLimpezaInicio(''); setLimpezaFim('');
      showToast('success', `${removed} registro${removed !== 1 ? 's' : ''} removido${removed !== 1 ? 's' : ''}`);
    } catch { showToast('error', 'Erro ao limpar auditoria'); }
    finally { setLimpezaLoading(false); setConfirmOpen(false); }
  }

  const labelClass  = 'block text-xs font-medium text-[#a0a0a0] mb-1.5';
  const inputClass  = 'bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#f5f5f5] text-xs [color-scheme:dark]';

  return (
    <div className="space-y-5">
      {/* Log table */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
          <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-400" /> Log de Auditoria
          </h3>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Filters */}
        {!loading && auditorias.length > 0 && (
          <div className="px-5 py-3 border-b border-[#2a2a2a] space-y-2.5">
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { label: 'De', val: filtroDataInicio, set: setFiltroDataInicio, type: 'date' },
                { label: 'até', val: filtroDataFim,    set: setFiltroDataFim,    type: 'date' },
                { label: 'Das', val: filtroHoraInicio, set: setFiltroHoraInicio, type: 'time' },
                { label: 'às',  val: filtroHoraFim,    set: setFiltroHoraFim,    type: 'time' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#505050] shrink-0">{f.label}</span>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} className={inputClass} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#a0a0a0] text-xs">
                <option value="">Todas as ações</option>
                {acoes.map(a => <option key={a}>{a}</option>)}
              </select>
              <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#a0a0a0] text-xs">
                <option value="">Todos os usuários</option>
                {usuarios.map(u => <option key={u}>{u}</option>)}
              </select>
              {hasFilter && (
                <button onClick={() => { setFiltroAcao(''); setFiltroUsuario(''); setFiltroDataInicio(''); setFiltroDataFim(''); setFiltroHoraInicio(''); setFiltroHoraFim(''); }}
                  className="px-3 py-1.5 text-xs text-[#505050] hover:text-[#a0a0a0] border border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#1e1e1e] rounded-lg transition-colors">
                  Limpar filtros
                </button>
              )}
              <span className="ml-auto text-[11px] text-[#505050] tabular-nums">
                {filtered.length === auditorias.length
                  ? `${auditorias.length} registro${auditorias.length !== 1 ? 's' : ''}`
                  : `${filtered.length} de ${auditorias.length} registros`}
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
        ) : auditorias.length === 0 ? (
          <p className="text-center py-8 text-[#505050] text-sm">Nenhum registro de auditoria encontrado</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-[#505050] text-sm">Nenhum resultado com os filtros aplicados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['Ação', 'Entidade', 'Usuário', 'Detalhe', 'Data'].map((h, i) => (
                    <th key={h} className={`text-left px-4 py-3 text-[#505050] font-medium uppercase tracking-wider ${i >= 2 && i <= 3 ? 'hidden md:table-cell' : ''} ${i === 3 ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3"><span className="font-medium text-amber-400">{a.acao}</span></td>
                    <td className="px-4 py-3 text-[#a0a0a0]">
                      {a.entidade}{a.entidadeId && <span className="text-[#505050] ml-1">#{a.entidadeId.slice(0, 6)}</span>}
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] hidden md:table-cell">{a.userNome}</td>
                    <td className="px-4 py-3 text-[#505050] hidden lg:table-cell max-w-[200px] truncate">{a.detalhe || '—'}</td>
                    <td className="px-4 py-3 text-[#505050] whitespace-nowrap">
                      {new Date(a.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cleanup section (admin only) */}
      {isAdmin && (
        <div className="bg-[#141414] border border-orange-500/20 rounded-xl p-5">
          <h3 className="font-semibold text-orange-400 mb-1 flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Limpeza do Log
          </h3>
          <p className="text-xs text-[#505050] mb-4 leading-relaxed">
            Remove entradas permanentemente. <strong className="text-orange-400/80">Esta ação não pode ser desfeita.</strong>
          </p>

          {/* Mode */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([['antes','Anteriores a uma data'],['periodo','Em um período'],['tudo','Tudo']] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setLimpezaModo(k); setLimpezaInicio(''); setLimpezaFim(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${limpezaModo === k ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f5f5f5]'}`}>
                {label}
              </button>
            ))}
          </div>

          {limpezaModo !== 'tudo' && (
            <div className="flex flex-wrap gap-3 mb-4 items-center">
              {limpezaModo === 'periodo' && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-[#505050]">De</label>
                  <input type="date" value={limpezaInicio} onChange={e => setLimpezaInicio(e.target.value)} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm [color-scheme:dark]" />
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-[#505050]">{limpezaModo === 'antes' ? 'Anteriores a' : 'até'}</label>
                <input type="date" value={limpezaFim} onChange={e => setLimpezaFim(e.target.value)} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm [color-scheme:dark]" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {auditorias.length > 0 && (
              <p className="text-xs text-[#505050]">
                {limpezaPreview === 0 ? 'Nenhum registro seria removido' : (
                  <>Serão removidos <strong className="text-orange-400">{limpezaPreview}</strong> de {auditorias.length} registro{auditorias.length !== 1 ? 's' : ''}</>
                )}
              </p>
            )}
            <button
              onClick={() => {
                if (limpezaModo !== 'tudo' && !limpezaFim && !limpezaInicio) {
                  showToast('warning', 'Informe pelo menos uma data');
                  return;
                }
                setConfirmOpen(true);
              }}
              disabled={limpezaLoading || limpezaPreview === 0}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {limpezaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Limpar {limpezaPreview > 0 ? `(${limpezaPreview})` : ''}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Limpar Log de Auditoria"
        message={limpezaModo === 'tudo'
          ? `Isso removerá permanentemente todos os ${auditorias.length} registros do log.`
          : `Isso removerá permanentemente ${limpezaPreview} registro${limpezaPreview !== 1 ? 's' : ''} do log.`
        }
        confirmLabel="Limpar"
        variant="danger"
        onConfirm={executarLimpeza}
        onCancel={() => setConfirmOpen(false)}
        loading={limpezaLoading}
      />
    </div>
  );
}
