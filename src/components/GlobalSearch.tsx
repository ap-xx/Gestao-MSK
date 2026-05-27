import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Users, FileText, Gavel, Loader2, ArrowRight, Building2 } from 'lucide-react';
import type { PageKey } from './Layout';
import { clientesApi, contratosApi, processosApi } from '../services/api';
import type { Cliente, Contrato, Processo } from '../types';

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

export function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const [query,   setQuery]   = useState('');
  const [data,    setData]    = useState<SearchData>({ clientes: [], contratos: [], processos: [] });
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFocused(null);
    setLoading(true);
    Promise.all([clientesApi.getAll(), contratosApi.getAll(), processosApi.getAll()])
      .then(([clientes, contratos, processos]) => setData({ clientes, contratos, processos }))
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

  const filteredClientes = q
    ? data.clientes.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf ?? '').includes(q) || (c.cnpj ?? '').includes(q) ||
        c.email.toLowerCase().includes(q)
      ).slice(0, 5)
    : data.clientes.slice(0, 4);

  const filteredContratos = q
    ? data.contratos.filter(c =>
        c.clienteNome.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q) ||
        c.areaAtuacao.toLowerCase().includes(q)
      ).slice(0, 4)
    : data.contratos.slice(0, 3);

  const filteredProcessos = q
    ? data.processos.filter(p =>
        p.numeroCNJ.toLowerCase().includes(q) ||
        p.clienteNome.toLowerCase().includes(q) ||
        p.parteAdversa.toLowerCase().includes(q) ||
        p.areaAtuacao.toLowerCase().includes(q)
      ).slice(0, 5)
    : data.processos.slice(0, 4);

  const total = filteredClientes.length + filteredContratos.length + filteredProcessos.length;

  const handleNavigate = useCallback((page: PageKey) => {
    onNavigate(page);
    onClose();
  }, [onNavigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #161616 0%, #121212 100%)', border: '1px solid #2a2a2a' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Search input ────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #222' }}>
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-amber-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setFocused(null); }}
            placeholder="Buscar clientes, contratos, processos..."
            className="flex-1 bg-transparent text-[15px] text-[#f5f5f5] placeholder-[#3d3d3d] outline-none font-medium"
          />
          {loading
            ? <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            : query && <button onClick={() => setQuery('')} className="text-[#505050] hover:text-[#a0a0a0] transition-colors shrink-0"><X className="w-4 h-4" /></button>
          }
          <div className="shrink-0 border border-[#2a2a2a] rounded px-1.5 py-0.5">
            <span className="text-[10px] text-[#505050] font-mono">Esc</span>
          </div>
        </div>

        {/* ── Results ──────────────────────────────────────── */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: '62vh' }}>
          {!loading && total === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#1e1e1e] flex items-center justify-center">
                <Search className="w-5 h-5 text-[#3a3a3a]" />
              </div>
              <p className="text-sm text-[#505050]">
                {q ? `Sem resultados para "${query}"` : 'Nenhum dado disponível'}
              </p>
            </div>
          )}

          {!loading && total > 0 && (
            <>
              {/* ── Clientes ── */}
              {filteredClientes.length > 0 && (
                <section>
                  <div className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#444]">
                      Clientes
                    </span>
                    <span className="text-[10px] text-[#333] bg-[#1e1e1e] px-2 py-0.5 rounded-full">
                      {filteredClientes.length}
                    </span>
                  </div>
                  {filteredClientes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate('clientes')}
                      onMouseEnter={() => setFocused(c.id)}
                      onMouseLeave={() => setFocused(null)}
                      className="w-full flex items-center gap-3.5 px-5 py-3 transition-all text-left group"
                      style={{ background: focused === c.id ? 'rgba(245,158,11,0.05)' : 'transparent' }}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold transition-all ${focused === c.id ? 'bg-amber-500/20 text-amber-400' : 'bg-[#1e1e1e] text-[#505050]'}`}>
                        {c.tipoPessoa === 'PJ' ? <Building2 className="w-4 h-4" /> : c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#f5f5f5] truncate">{c.nome}</p>
                        <p className="text-xs text-[#505050] truncate">
                          {c.tipoPessoa === 'PF' ? c.cpf : c.cnpj}
                          {(c.cpf || c.cnpj) && ' · '}
                          <span className={STATUS_CLS[c.status] ?? 'text-[#a0a0a0]'}>
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                          {' · '}{c.endereco.cidade}/{c.endereco.uf}
                        </p>
                      </div>
                      <ArrowRight className={`w-4 h-4 shrink-0 transition-all ${focused === c.id ? 'text-amber-500 translate-x-0 opacity-100' : 'text-transparent -translate-x-1 opacity-0'}`} />
                    </button>
                  ))}
                </section>
              )}

              {/* ── Contratos ── */}
              {filteredContratos.length > 0 && (
                <section style={{ borderTop: filteredClientes.length > 0 ? '1px solid #1e1e1e' : undefined }}>
                  <div className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#444]">Contratos</span>
                    <span className="text-[10px] text-[#333] bg-[#1e1e1e] px-2 py-0.5 rounded-full">{filteredContratos.length}</span>
                  </div>
                  {filteredContratos.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate('contratos')}
                      onMouseEnter={() => setFocused(c.id)}
                      onMouseLeave={() => setFocused(null)}
                      className="w-full flex items-center gap-3.5 px-5 py-3 transition-all text-left"
                      style={{ background: focused === c.id ? 'rgba(59,130,246,0.05)' : 'transparent' }}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${focused === c.id ? 'bg-blue-500/20' : 'bg-[#1e1e1e]'}`}>
                        <FileText className={`w-4 h-4 ${focused === c.id ? 'text-blue-400' : 'text-[#505050]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#f5f5f5] truncate">{c.clienteNome}</p>
                        <p className="text-xs text-[#505050] truncate">
                          {c.tipo} · {c.areaAtuacao}
                          {' · '}<span className={STATUS_CLS[c.status] ?? 'text-[#a0a0a0]'}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span>
                        </p>
                      </div>
                      <ArrowRight className={`w-4 h-4 shrink-0 transition-all ${focused === c.id ? 'text-blue-400 translate-x-0 opacity-100' : 'text-transparent -translate-x-1 opacity-0'}`} />
                    </button>
                  ))}
                </section>
              )}

              {/* ── Processos ── */}
              {filteredProcessos.length > 0 && (
                <section style={{ borderTop: (filteredClientes.length > 0 || filteredContratos.length > 0) ? '1px solid #1e1e1e' : undefined }}>
                  <div className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#444]">Processos</span>
                    <span className="text-[10px] text-[#333] bg-[#1e1e1e] px-2 py-0.5 rounded-full">{filteredProcessos.length}</span>
                  </div>
                  {filteredProcessos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleNavigate('processos')}
                      onMouseEnter={() => setFocused(p.id)}
                      onMouseLeave={() => setFocused(null)}
                      className="w-full flex items-center gap-3.5 px-5 py-3 transition-all text-left"
                      style={{ background: focused === p.id ? 'rgba(168,85,247,0.05)' : 'transparent' }}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${focused === p.id ? 'bg-purple-500/20' : 'bg-[#1e1e1e]'}`}>
                        <Gavel className={`w-4 h-4 ${focused === p.id ? 'text-purple-400' : 'text-[#505050]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono text-amber-400 truncate">{p.numeroCNJ}</p>
                          <span className={`text-[10px] shrink-0 ${STATUS_CLS[p.status] ?? 'text-[#a0a0a0]'}`}>
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-[#f5f5f5] font-medium truncate">{p.clienteNome}</p>
                        <p className="text-[11px] text-[#505050] truncate">{p.areaAtuacao} · {p.fase}</p>
                      </div>
                      <ArrowRight className={`w-4 h-4 shrink-0 transition-all ${focused === p.id ? 'text-purple-400 translate-x-0 opacity-100' : 'text-transparent -translate-x-1 opacity-0'}`} />
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2.5" style={{ borderTop: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-3 text-[10px] text-[#3a3a3a]">
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
          </div>
          {!loading && total > 0 && (
            <span className="text-[10px] text-[#3a3a3a]">{total} resultado{total !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
