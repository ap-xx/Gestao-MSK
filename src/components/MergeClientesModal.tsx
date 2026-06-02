/**
 * MergeClientesModal — detect and merge duplicate clients.
 *
 * Duplicates are clients sharing the same CPF or CNPJ.
 * The merge operation:
 *   1. Transfers all processos, contratos, lancamentos from the duplicate
 *      to the primary client.
 *   2. Deletes the duplicate.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Users, X, ArrowRight, CheckCircle, Loader2, AlertCircle, Trash2,
} from 'lucide-react';
import { clientesApi, processosApi, contratosApi, lancamentosApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Portal from './ui/Portal';
import type { Cliente } from '../types';

interface DuplicateGroup {
  doc: string;      // CPF or CNPJ (digits only)
  clientes: Cliente[];
}

interface Props {
  onClose: () => void;
  onMerged: () => void;
}

export default function MergeClientesModal({ onClose, onMerged }: Props) {
  const { showToast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [merging,  setMerging]  = useState(false);
  const [step,     setStep]     = useState<'list' | 'confirm'>('list');
  const [selected, setSelected] = useState<DuplicateGroup | null>(null);
  const [primaryId, setPrimaryId] = useState('');

  useEffect(() => {
    clientesApi.getAll()
      .then(setClientes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const duplicates = useMemo((): DuplicateGroup[] => {
    const map: Record<string, Cliente[]> = {};
    for (const c of clientes) {
      const doc = (c.cpf || c.cnpj || '').replace(/\D/g, '');
      if (!doc) continue;
      if (!map[doc]) map[doc] = [];
      map[doc].push(c);
    }
    return Object.entries(map)
      .filter(([, list]) => list.length > 1)
      .map(([doc, list]) => ({ doc, clientes: list }));
  }, [clientes]);

  function startMerge(group: DuplicateGroup) {
    setSelected(group);
    // Default primary = the one with the most recent criadoEm
    const sorted = [...group.clientes].sort((a, b) =>
      (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''),
    );
    setPrimaryId(sorted[0].id);
    setStep('confirm');
  }

  async function doMerge() {
    if (!selected || !primaryId) return;
    setMerging(true);
    try {
      const duplicates = selected.clientes.filter(c => c.id !== primaryId);
      const primary    = selected.clientes.find(c => c.id === primaryId)!;

      for (const dup of duplicates) {
        // Transfer related records to primary
        const [procs, conts, lancs] = await Promise.all([
          processosApi.getAll(),
          contratosApi.getAll(),
          lancamentosApi.getAll(),
        ]);

        await Promise.all([
          ...procs.filter(p => p.clienteId === dup.id)
            .map(p => processosApi.update(p.id, {
              clienteId:   primary.id,
              clienteNome: primary.nome,
            })),
          ...conts.filter(c => c.clienteId === dup.id)
            .map(c => contratosApi.update(c.id, {
              clienteId:   primary.id,
              clienteNome: primary.nome,
            })),
          ...lancs.filter(l => l.clienteId === dup.id)
            .map(l => lancamentosApi.update(l.id, {
              clienteId:   primary.id,
              clienteNome: primary.nome,
            })),
        ]);

        // Delete the duplicate
        await clientesApi.remove(dup.id);
      }

      showToast('success', 'Mesclagem concluída!',
        `${duplicates.length} cliente(s) duplicado(s) removido(s). Dados transferidos para "${primary.nome}".`);
      onMerged();
      onClose();
    } catch (err: any) {
      showToast('error', 'Erro ao mesclar', err.message);
    } finally {
      setMerging(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <h2 className="font-playfair text-base font-bold text-[#f5f5f5]">
                {step === 'list' ? 'Clientes Duplicados' : 'Confirmar Mesclagem'}
              </h2>
            </div>
            <button onClick={onClose} className="text-[#505050] hover:text-[#f5f5f5]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── List step ── */}
            {step === 'list' && (
              <>
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  </div>
                ) : duplicates.length === 0 ? (
                  <div className="flex flex-col items-center py-10 gap-3 text-[#505050]">
                    <CheckCircle className="w-12 h-12 text-green-400 opacity-70" />
                    <p className="text-sm font-medium text-green-400">Nenhum duplicado encontrado!</p>
                    <p className="text-xs text-center">Todos os clientes têm CPF/CNPJ únicos na base.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-400 flex items-center gap-1.5 mb-4">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {duplicates.length} grupo(s) de clientes com mesmo CPF/CNPJ
                    </p>
                    {duplicates.map(group => (
                      <div key={group.doc} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4">
                        <p className="text-xs text-[#505050] mb-2 font-mono">
                          Documento: {group.doc}
                        </p>
                        <div className="space-y-1.5 mb-3">
                          {group.clientes.map(c => (
                            <div key={c.id} className="flex items-center gap-2 text-sm">
                              <div className={`w-2 h-2 rounded-full ${c.status === 'ativo' ? 'bg-green-400' : 'bg-gray-500'}`} />
                              <span className="text-[#f5f5f5]">{c.nome}</span>
                              <span className="text-[#505050] text-xs">{c.status}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => startMerge(group)}
                          className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition-all"
                        >
                          Mesclar este grupo
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Confirm step ── */}
            {step === 'confirm' && selected && (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-400 mb-1">Escolha o cliente principal</p>
                  <p className="text-xs text-[#a0a0a0]">
                    Os processos, contratos e lançamentos dos outros serão transferidos para este.
                    Os duplicados serão excluídos permanentemente.
                  </p>
                </div>

                <div className="space-y-2">
                  {selected.clientes.map(c => (
                    <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      primaryId === c.id
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]'
                    }`}>
                      <input
                        type="radio"
                        name="primary"
                        value={c.id}
                        checked={primaryId === c.id}
                        onChange={() => setPrimaryId(c.id)}
                        className="text-amber-500 accent-amber-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#f5f5f5]">{c.nome}</p>
                        <p className="text-xs text-[#505050]">
                          {c.tipoPessoa} · {c.status} · {c.email}
                        </p>
                      </div>
                      {primaryId === c.id && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          Principal
                        </span>
                      )}
                      {primaryId !== c.id && (
                        <span className="text-[10px] text-red-400 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Será excluído
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-[#a0a0a0]">
                    Esta ação <strong className="text-red-400">não pode ser desfeita</strong>.
                    Os dados dos duplicados serão transferidos, mas os registros serão apagados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a] shrink-0">
            {step === 'confirm' ? (
              <>
                <button onClick={() => setStep('list')}
                  className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">
                  Voltar
                </button>
                <button onClick={doMerge} disabled={merging || !primaryId}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {merging
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Mesclando…</>
                    : <><ArrowRight className="w-4 h-4" /> Confirmar mesclagem</>
                  }
                </button>
              </>
            ) : (
              <button onClick={onClose}
                className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
