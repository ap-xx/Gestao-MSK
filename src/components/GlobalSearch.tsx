import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Users, FileText, Gavel, Loader2 } from 'lucide-react';
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

export function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchData>({ clientes: [], contratos: [], processos: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca dados ao abrir
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setLoading(true);
    Promise.all([
      clientesApi.getAll(),
      contratosApi.getAll(),
      processosApi.getAll(),
    ])
      .then(([clientes, contratos, processos]) => {
        setData({ clientes, contratos, processos });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Foco no input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fechar com Esc
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  const filteredClientes = q
    ? data.clientes.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          (c.cpf ?? '').toLowerCase().includes(q) ||
          (c.cnpj ?? '').toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      ).slice(0, 4)
    : data.clientes.slice(0, 4);

  const filteredContratos = q
    ? data.contratos.filter(
        (c) =>
          c.clienteNome.toLowerCase().includes(q) ||
          c.descricao.toLowerCase().includes(q) ||
          c.areaAtuacao.toLowerCase().includes(q)
      ).slice(0, 4)
    : data.contratos.slice(0, 4);

  const filteredProcessos = q
    ? data.processos.filter(
        (p) =>
          p.numeroCNJ.toLowerCase().includes(q) ||
          p.clienteNome.toLowerCase().includes(q) ||
          p.parteAdversa.toLowerCase().includes(q) ||
          p.areaAtuacao.toLowerCase().includes(q)
      ).slice(0, 4)
    : data.processos.slice(0, 4);

  const hasResults =
    filteredClientes.length > 0 ||
    filteredContratos.length > 0 ||
    filteredProcessos.length > 0;

  const handleNavigate = useCallback(
    (page: PageKey) => {
      onNavigate(page);
      onClose();
    },
    [onNavigate, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#141414', borderColor: '#2a2a2a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#2a2a2a' }}>
          <Search className="w-4 h-4 text-[#a0a0a0] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clientes, contratos, processos..."
            className="flex-1 bg-transparent text-sm text-[#f5f5f5] placeholder-[#505050] outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />}
          <button
            onClick={onClose}
            className="text-[#505050] hover:text-[#a0a0a0] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo scrollável */}
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {!loading && !hasResults && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search className="w-8 h-8 text-[#3a3a3a]" />
              <p className="text-sm text-[#505050]">
                {q
                  ? `Nenhum resultado encontrado para "${query}"`
                  : 'Nenhum dado disponível'}
              </p>
            </div>
          )}

          {!loading && hasResults && (
            <>
              {/* Clientes */}
              {filteredClientes.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#505050]">
                      Clientes
                    </span>
                  </div>
                  {filteredClientes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate('clientes')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#f5f5f5] truncate">{c.nome}</p>
                        <p className="text-xs text-[#a0a0a0] truncate">
                          {c.tipoPessoa === 'PF' ? (c.cpf ?? '') : (c.cnpj ?? '')} ·{' '}
                          <span
                            className={
                              c.status === 'ativo'
                                ? 'text-green-400'
                                : c.status === 'bloqueado'
                                ? 'text-red-400'
                                : 'text-[#a0a0a0]'
                            }
                          >
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Contratos */}
              {filteredContratos.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2 border-t" style={{ borderColor: '#1f1f1f' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#505050]">
                      Contratos
                    </span>
                  </div>
                  {filteredContratos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate('contratos')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#f5f5f5] truncate">{c.clienteNome}</p>
                        <p className="text-xs text-[#a0a0a0] truncate">
                          {c.tipo} · {c.areaAtuacao} ·{' '}
                          <span
                            className={
                              c.status === 'ativo'
                                ? 'text-green-400'
                                : c.status === 'encerrado'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }
                          >
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Processos */}
              {filteredProcessos.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2 border-t" style={{ borderColor: '#1f1f1f' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#505050]">
                      Processos
                    </span>
                  </div>
                  {filteredProcessos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleNavigate('processos')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Gavel className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#f5f5f5] truncate">{p.clienteNome}</p>
                        <p className="text-xs text-[#a0a0a0] truncate">
                          {p.numeroCNJ} · {p.fase} ·{' '}
                          <span
                            className={
                              p.status === 'ativo'
                                ? 'text-green-400'
                                : p.status === 'encerrado'
                                ? 'text-red-400'
                                : 'text-[#a0a0a0]'
                            }
                          >
                            {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t flex items-center gap-4" style={{ borderColor: '#2a2a2a' }}>
          <span className="text-[10px] text-[#505050]">
            <kbd className="px-1.5 py-0.5 rounded bg-[#1f1f1f] border border-[#2a2a2a] text-[#a0a0a0] font-mono">
              Esc
            </kbd>{' '}
            para fechar
          </span>
        </div>
      </div>
    </div>
  );
}
