import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, FileText, Gavel, Loader2, ArrowRight, Building2, Star } from 'lucide-react';
import type { PageKey } from './Layout';
import { clientesApi, contratosApi, processosApi } from '../services/api';
import type { Cliente, Contrato, Processo } from '../types';
import Portal from './ui/Portal';

// ── Module-level cache ────────────────────────────────────────────
// Persists across open/close so reopening Ctrl+K is instant.
// Invalidated after CACHE_TTL ms or when the component forces a refresh.
let _cache: SearchData | null = null;
let _cacheTs = 0;
const CACHE_TTL = 30_000; // 30 s
// ─────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: PageKey) => void;
}

interface SearchData {
  clientes: Cliente[];
  contratos: Contrato[];
  processos: Processo[];
}

const STATUS_CLS: Record<string, string> = {
  ativo:      'text-green-400',
  inativo:    'text-gray-400',
  bloqueado:  'text-red-400',
  encerrado:  'text-red-400',
  suspenso:   'text-amber-400',
  arquivado:  'text-gray-400',
  negociando: 'text-blue-400',
};

const STATUS_DOT: Record<string, string> = {
  ativo:      'bg-green-400',
  inativo:    'bg-gray-500',
  bloqueado:  'bg-red-400',
  encerrado:  'bg-red-400',
  suspenso:   'bg-amber-400',
  arquivado:  'bg-gray-500',
  negociando: 'bg-blue-400',
};

export function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const [query,   setQuery]   = useState('');
  const [data,    setData]    = useState<SearchData>({ clientes: [], contratos: [], processos: [] });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFocused(null);

    // Serve from cache when data is still fresh (< 30 s old)
    const now = Date.now();
    if (_cache && now - _cacheTs < CACHE_TTL) {
      setData(_cache);
      return;
    }

    setLoading(true);
    Promise.all([clientesApi.getAll(), contratosApi.getAll(), processosApi.getAll()])
      .then(([clientes, contratos, processos]) => {
        const fresh = { clientes, contratos, processos };
        _cache   = fresh;
        _cacheTs = Date.now();
        setData(fresh);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  const filteredClientes = useMemo(() =>
    q
      ? data.clientes.filter(c =>
          c.nome.toLowerCase().includes(q) ||
          (c.cpf ?? '').includes(q) || (c.cnpj ?? '').includes(q) ||
          c.email.toLowerCase().includes(q)
        ).slice(0, 5)
      : data.clientes.slice(0, 4),
  [q, data.clientes]);

  const filteredContratos = useMemo(() =>
    q
      ? data.contratos.filter(c =>
          c.clienteNome.toLowerCase().includes(q) ||
          c.descricao.toLowerCase().includes(q) ||
          c.areaAtuacao.toLowerCase().includes(q)
        ).slice(0, 4)
      : data.contratos.slice(0, 3),
  [q, data.contratos]);

  const filteredProcessos = useMemo(() =>
    q
      ? data.processos.filter(p =>
          p.numeroCNJ.toLowerCase().includes(q) ||
          p.clienteNome.toLowerCase().includes(q) ||
          p.parteAdversa.toLowerCase().includes(q) ||
          p.areaAtuacao.toLowerCase().includes(q)
        ).slice(0, 5)
      : data.processos.slice(0, 4),
  [q, data.processos]);

  const total = filteredClientes.length + filteredContratos.length + filteredProcessos.length;

  const handleNavigate = useCallback((page: PageKey) => {
    onNavigate(page);
    onClose();
  }, [onNavigate, onClose]);

  if (!open) return null;

  return (
    <Portal>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[300]"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[301] flex items-start justify-center pt-[10vh] px-4 pointer-events-none"
      >
        <div
          className="relative w-full max-w-xl rounded-2xl shadow-2xl flex flex-col pointer-events-auto"
          style={{
            background: '#161616',
            border: '1px solid #2a2a2a',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08)',
            maxHeight: '70vh',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Search input ── */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid #222' }}>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              {loading
                ? <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                : <Search className="w-3.5 h-3.5 text-amber-400" />
              }
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setFocused(null); }}
              placeholder="Buscar clientes, contratos, processos..."
              className="flex-1 bg-transparent text-[14px] text-[#f5f5f5] placeholder-[#444] outline-none"
            />
            {query
              ? <button onClick={() => setQuery('')} className="text-[#444] hover:text-[#888] transition-colors shrink-0"><X className="w-4 h-4" /></button>
              : <kbd className="shrink-0 border border-[#2a2a2a] rounded px-1.5 py-0.5 text-[10px] text-[#444] font-mono">Esc</kbd>
            }
          </div>

          {/* ── Results ── */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-[#505050] text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                Carregando...
              </div>
            )}

            {!loading && total === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1e1e1e] flex items-center justify-center">
                  <Search className="w-5 h-5 text-[#2a2a2a]" />
                </div>
                <p className="text-sm text-[#444]">
                  {q ? `Nenhum resultado para "${query}"` : 'Nenhum dado disponível'}
                </p>
              </div>
            )}

            {!loading && total > 0 && (
              <>
                {/* ── Clientes ── */}
                {filteredClientes.length > 0 && (
                  <section className="py-1">
                    <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#3a3a3a]">Clientes</span>
                      <span className="text-[10px] text-[#2a2a2a] tabular-nums">{filteredClientes.length}</span>
                    </div>
                    {filteredClientes.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleNavigate('clientes')}
                        onMouseEnter={() => setFocused(c.id)}
                        onMouseLeave={() => setFocused(null)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group"
                        style={{ background: focused === c.id ? 'rgba(245,158,11,0.06)' : 'transparent' }}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold transition-all ${focused === c.id ? 'bg-amber-500/20 text-amber-400' : 'bg-[#1e1e1e] text-[#505050]'}`}>
                          {c.tipoPessoa === 'PJ' ? <Building2 className="w-3.5 h-3.5" /> : c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-[#f5f5f5] truncate">{c.nome}</p>
                            {(c.avaliacao ?? 0) > 0 && (
                              <div className="flex gap-0.5 shrink-0">
                                {[1,2,3,4,5].map(i => (
                                  <Star key={i} className={`w-2.5 h-2.5 ${i <= (c.avaliacao ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-[#2a2a2a]'}`} />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? 'bg-gray-500'}`} />
                            <span className={`text-[11px] ${STATUS_CLS[c.status] ?? 'text-[#505050]'}`}>
                              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                            </span>
                            {(c.cpf || c.cnpj) && <span className="text-[11px] text-[#3a3a3a]">· {c.cpf || c.cnpj}</span>}
                            {c.endereco?.cidade && <span className="text-[11px] text-[#3a3a3a]">· {c.endereco.cidade}/{c.endereco.uf}</span>}
                          </div>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${focused === c.id ? 'text-amber-400 opacity-100' : 'text-transparent opacity-0'}`} />
                      </button>
                    ))}
                  </section>
                )}

                {/* ── Contratos ── */}
                {filteredContratos.length > 0 && (
                  <section className="py-1" style={{ borderTop: filteredClientes.length > 0 ? '1px solid #1e1e1e' : undefined }}>
                    <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#3a3a3a]">Contratos</span>
                      <span className="text-[10px] text-[#2a2a2a] tabular-nums">{filteredContratos.length}</span>
                    </div>
                    {filteredContratos.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleNavigate('contratos')}
                        onMouseEnter={() => setFocused(c.id)}
                        onMouseLeave={() => setFocused(null)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                        style={{ background: focused === c.id ? 'rgba(59,130,246,0.06)' : 'transparent' }}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${focused === c.id ? 'bg-blue-500/20' : 'bg-[#1e1e1e]'}`}>
                          <FileText className={`w-3.5 h-3.5 ${focused === c.id ? 'text-blue-400' : 'text-[#505050]'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#f5f5f5] truncate">{c.clienteNome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? 'bg-gray-500'}`} />
                            <span className={`text-[11px] ${STATUS_CLS[c.status] ?? 'text-[#505050]'}`}>
                              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                            </span>
                            <span className="text-[11px] text-[#3a3a3a]">· {c.tipo} · {c.areaAtuacao}</span>
                          </div>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${focused === c.id ? 'text-blue-400 opacity-100' : 'text-transparent opacity-0'}`} />
                      </button>
                    ))}
                  </section>
                )}

                {/* ── Processos ── */}
                {filteredProcessos.length > 0 && (
                  <section className="py-1" style={{ borderTop: (filteredClientes.length > 0 || filteredContratos.length > 0) ? '1px solid #1e1e1e' : undefined }}>
                    <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#3a3a3a]">Processos</span>
                      <span className="text-[10px] text-[#2a2a2a] tabular-nums">{filteredProcessos.length}</span>
                    </div>
                    {filteredProcessos.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleNavigate('processos')}
                        onMouseEnter={() => setFocused(p.id)}
                        onMouseLeave={() => setFocused(null)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                        style={{ background: focused === p.id ? 'rgba(168,85,247,0.06)' : 'transparent' }}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${focused === p.id ? 'bg-purple-500/20' : 'bg-[#1e1e1e]'}`}>
                          <Gavel className={`w-3.5 h-3.5 ${focused === p.id ? 'text-purple-400' : 'text-[#505050]'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-mono text-amber-400 truncate">{p.numeroCNJ}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[p.status] ?? 'bg-gray-500'}`} />
                              <span className={`text-[10px] ${STATUS_CLS[p.status] ?? 'text-[#505050]'}`}>
                                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-[#e0e0e0] font-medium truncate">{p.clienteNome}</p>
                          <p className="text-[11px] text-[#3a3a3a] truncate">{p.areaAtuacao} · {p.fase}</p>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${focused === p.id ? 'text-purple-400 opacity-100' : 'text-transparent opacity-0'}`} />
                      </button>
                    ))}
                  </section>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #1e1e1e' }}>
            <div className="flex items-center gap-3 text-[10px] text-[#2a2a2a]">
              <span>↵ abrir</span>
              <span>Esc fechar</span>
            </div>
            {!loading && total > 0 && (
              <span className="text-[10px] text-[#2a2a2a] tabular-nums">{total} resultado{total !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
