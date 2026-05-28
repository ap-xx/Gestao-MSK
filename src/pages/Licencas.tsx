import { useEffect, useState, useCallback } from 'react';
import {
  KeyRound, Plus, Copy, CheckCheck, ShieldOff, ShieldCheck,
  Trash2, RefreshCw, Monitor, MapPin, Database, Clock,
  Hash, AlertCircle, X, ChevronDown, ChevronUp, Wifi, WifiOff,
  Fingerprint,
} from 'lucide-react';
import { licenseApi } from '../services/api';
import { LicenseDB } from '../data/db';
import { calcDbSizeKb } from '../utils/license';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import Portal from '../components/ui/Portal';
import type { LicenseRecord, LocalLicense } from '../types';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────

function fmt(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ─── Generate key modal ───────────────────────────────────────

function GerarModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (r: LicenseRecord) => void;
}) {
  const [desc,    setDesc]    = useState('');
  const [record,  setRecord]  = useState<LicenseRecord | null>(null);
  const [copied,  setCopied]  = useState(false);

  const generate = () => {
    const r = licenseApi.generate(desc.trim() || undefined);
    setRecord(r);
  };

  const copy = () => {
    if (!record) return;
    navigator.clipboard.writeText(record.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const finish = () => {
    if (record) onGenerated(record);
    onClose();
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Gerar nova licença</h3>
          </div>
          <button onClick={onClose} className="text-[#505050] hover:text-[#a0a0a0] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!record ? (
          <>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">
                Identificação (opcional)
              </label>
              <input
                type="text"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="Ex: PC Recepção, Notebook Dra. Miriam"
                maxLength={60}
                autoFocus
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#404040] outline-none transition-colors"
              />
            </div>
            <button
              onClick={generate}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              Gerar chave
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-[#a0a0a0] mb-3">
              Chave gerada com sucesso. Copie e envie ao responsável pela máquina.
            </p>

            {/* Key display */}
            <div className="bg-[#0a0a0a] border border-amber-500/20 rounded-xl p-4 mb-4 text-center">
              <p className="text-lg font-mono font-bold text-amber-400 tracking-widest select-all">
                {record.key}
              </p>
              {record.descricao && (
                <p className="text-xs text-[#505050] mt-1">{record.descricao}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-2 border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400 text-sm py-2.5 rounded-lg transition-colors"
              >
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar chave'}
              </button>
              <button
                onClick={finish}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm py-2.5 rounded-lg transition-colors"
              >
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function Licencas() {
  const { user }  = useAuth();
  const { showToast } = useToast();

  const [records,    setRecords]   = useState<LicenseRecord[]>([]);
  const [myLicense,  setMyLicense] = useState<LocalLicense | null>(null);
  const [myDbSize,   setMyDbSize]  = useState(0);
  const [syncing,    setSyncing]   = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'sleeping' | 'error'>('idle');
  const [showModal,  setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId,  setCopiedId]  = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<LicenseRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LicenseRecord | null>(null);

  const load = useCallback(() => {
    setRecords(licenseApi.getAll());
    setMyLicense(LicenseDB.get());
    setMyDbSize(calcDbSizeKb());
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Stats ────────────────────────────────────────────────────
  const total   = records.length;
  const active  = records.filter(r => r.status === 'active').length;
  const revoked = records.filter(r => r.status === 'revoked').length;

  // ── Actions ──────────────────────────────────────────────────
  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRevoke = (r: LicenseRecord) => setConfirmRevoke(r);

  const doRevoke = () => {
    if (!confirmRevoke) return;
    licenseApi.revoke(confirmRevoke.id);
    setConfirmRevoke(null);
    load();
    showToast('success', 'Licença revogada.');
  };

  const handleReactivate = (r: LicenseRecord) => {
    licenseApi.reactivate(r.id);
    load();
    showToast('success', 'Licença reativada.');
  };

  const handleDelete = (r: LicenseRecord) => setConfirmDelete(r);

  const doDelete = () => {
    if (!confirmDelete) return;
    licenseApi.delete(confirmDelete.id);
    setConfirmDelete(null);
    load();
    showToast('success', 'Registro excluído.');
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('idle');
    try {
      const serverData = await licenseApi.syncFromServer();
      licenseApi.mergeServerData(serverData);
      load();
      setSyncStatus('ok');
      showToast('success', `Sincronizado — ${serverData.length} máquina(s) encontrada(s).`);
    } catch (err) {
      // Distinguish "server sleeping / network down" from other errors
      const msg = err instanceof Error ? err.message : '';
      const isSleeping =
        err instanceof TypeError ||          // fetch() threw (network unreachable)
        msg.includes('AbortError') ||
        msg.includes('fetch') ||
        msg.includes('504') ||
        msg.includes('502');

      if (isSleeping) {
        setSyncStatus('sleeping');
        showToast('warning', 'Servidor dormindo.', 'O Render free tier acorda em ~30s. Tente novamente em instantes.');
      } else {
        setSyncStatus('error');
        showToast('warning', 'Sincronização indisponível.', msg || 'Verifique se o servidor está atualizado.');
      }
    } finally {
      setSyncing(false);
    }
  };

  // Only admin can access this page
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ShieldOff className="w-10 h-10 text-[#303030]" />
        <p className="text-[#505050] text-sm">Acesso restrito ao administrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-[#f5f5f5]">Portal de Licenças</h1>
          <p className="text-xs text-[#505050] mt-0.5">
            Gerencie as chaves de acesso de cada máquina
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSync()}
            disabled={syncing}
            title="Buscar dados das máquinas no servidor"
            className={[
              'flex items-center gap-2 px-3 py-2 border text-xs rounded-lg transition-colors disabled:opacity-40',
              syncStatus === 'ok'
                ? 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/50'
                : syncStatus === 'sleeping' || syncStatus === 'error'
                  ? 'border-amber-500/30 text-amber-400 hover:border-amber-500/50'
                  : 'border-[#2a2a2a] hover:border-[#3a3a3a] text-[#a0a0a0] hover:text-[#f5f5f5]',
            ].join(' ')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : syncStatus === 'sleeping' ? 'Servidor dormindo' : syncStatus === 'ok' ? 'Sincronizado' : 'Sincronizar'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Gerar chave
          </button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total de licenças', value: total,   icon: KeyRound,     color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
          { label: 'Ativas',            value: active,  icon: ShieldCheck,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Revogadas',         value: revoked, icon: ShieldOff,    color: 'text-red-400',     bg: 'bg-red-500/10'    },
        ].map(card => (
          <div key={card.label} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-center gap-4">
            <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#f5f5f5]">{card.value}</p>
              <p className="text-xs text-[#505050]">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── This machine ────────────────────────────────────── */}
      {myLicense && (
        <div className="bg-[#141414] border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-semibold text-amber-400">Esta máquina</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Monitor,  label: 'Nome',          value: myLicense.machineName },
              { icon: MapPin,   label: 'Região',        value: myLicense.cidade ? `${myLicense.cidade} / ${myLicense.uf ?? ''}` : '—' },
              { icon: Database, label: 'Tamanho do BD', value: `${myDbSize} KB` },
              { icon: Hash,     label: 'Acessos',       value: myLicense.loginCount },
            ].map(item => (
              <div key={item.label} className="bg-[#0a0a0a] rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon className="w-3 h-3 text-[#505050]" />
                  <p className="text-[10px] text-[#505050]">{item.label}</p>
                </div>
                <p className="text-sm font-medium text-[#f5f5f5] truncate">{String(item.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-[10px] font-mono text-[#404040] select-all">{myLicense.licenseKey}</p>
            <span className="text-[10px] text-[#505050]">·</span>
            <p className="text-[10px] text-[#404040]">Ativado em {fmtDate(myLicense.activatedAt)}</p>
            <span className="text-[10px] text-[#505050]">·</span>
            <p className="text-[10px] text-[#404040]">Último acesso {fmt(myLicense.lastLogin)}</p>
          </div>
        </div>
      )}

      {/* ── Licenses table ──────────────────────────────────── */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2a2a2a] flex items-center justify-between">
          <p className="text-sm font-medium text-[#f5f5f5]">Licenças geradas</p>
          <p className="text-xs text-[#505050]">{total} registro{total !== 1 ? 's' : ''}</p>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <KeyRound className="w-8 h-8 text-[#303030]" />
            <p className="text-sm text-[#505050]">Nenhuma licença gerada ainda.</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Gerar a primeira chave →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1e1e1e]">
            {records.map(r => {
              const expanded = expandedId === r.id;
              const copied   = copiedId === r.id;
              const isActive = r.status === 'active';

              return (
                <div key={r.id} className="group">
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">

                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-red-500/60'}`} />

                    {/* Key + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-[#f5f5f5] select-all">{r.key}</span>
                        {r.descricao && (
                          <span className="text-xs text-[#505050] bg-[#1e1e1e] px-2 py-0.5 rounded-full">
                            {r.descricao}
                          </span>
                        )}
                        <span className={[
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400',
                        ].join(' ')}>
                          {isActive ? 'Ativa' : 'Revogada'}
                        </span>
                      </div>

                      {/* Quick stats row */}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {r.machineName ? (
                          <span className="flex items-center gap-1 text-[10px] text-[#505050]">
                            <Monitor className="w-3 h-3" />{r.machineName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#404040]">Aguardando ativação</span>
                        )}
                        {r.cidade && (
                          <span className="flex items-center gap-1 text-[10px] text-[#505050]">
                            <MapPin className="w-3 h-3" />{r.cidade} / {r.uf}
                          </span>
                        )}
                        {r.lastLogin && (
                          <span className="flex items-center gap-1 text-[10px] text-[#505050]">
                            <Clock className="w-3 h-3" />Último acesso {fmt(r.lastLogin)}
                          </span>
                        )}
                        {r.dbSizeKb !== undefined && (
                          <span className="flex items-center gap-1 text-[10px] text-[#505050]">
                            <Database className="w-3 h-3" />{r.dbSizeKb} KB
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleCopy(r.key, r.id)}
                        title="Copiar chave"
                        className="p-1.5 rounded-lg text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >
                        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {isActive ? (
                        <button
                          onClick={() => handleRevoke(r)}
                          title="Revogar"
                          className="p-1.5 rounded-lg text-[#505050] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(r)}
                          title="Reativar"
                          className="p-1.5 rounded-lg text-[#505050] hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(r)}
                        title="Excluir registro"
                        className="p-1.5 rounded-lg text-[#505050] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        title={expanded ? 'Recolher' : 'Detalhes'}
                        className="p-1.5 rounded-lg text-[#505050] hover:text-[#a0a0a0] hover:bg-white/5 transition-colors"
                      >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="px-5 pb-4 pt-1 bg-[#0d0d0d] border-t border-[#1e1e1e]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Machine ID', value: r.machineId ?? '—' },
                          { label: 'IP',         value: r.ip ?? '—' },
                          { label: 'Acessos',    value: r.loginCount !== undefined ? String(r.loginCount) : '—' },
                          { label: 'Ativado em', value: fmtDate(r.activatedAt) },
                          { label: 'Gerado em',  value: fmtDate(r.criadoEm) },
                          { label: 'Atualizado', value: fmt(r.atualizadoEm) },
                        ].map(d => (
                          <div key={d.label} className="bg-[#141414] rounded-lg p-2.5">
                            <p className="text-[10px] text-[#404040] mb-0.5">{d.label}</p>
                            <p className="text-xs text-[#a0a0a0] font-mono break-all">{d.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Server sync note ────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
        <AlertCircle className="w-4 h-4 text-[#505050] shrink-0 mt-0.5" />
        <div className="text-xs text-[#505050] leading-relaxed">
          <strong className="text-[#a0a0a0]">Como funciona:</strong>{' '}
          Cada máquina valida sua chave localmente — sem precisar do servidor.
          Ao fazer login, os dados (nome da máquina, região, tamanho do BD) são
          reportados ao servidor em segundo plano. Use{' '}
          <strong className="text-[#a0a0a0]">Sincronizar</strong>{' '}
          para trazer esses dados para cá.
          <br />
          <span className="flex items-center gap-1 mt-1.5">
            <Wifi className="w-3 h-3 text-emerald-500" /> Validação local: sempre funciona
            <span className="mx-2">·</span>
            <WifiOff className="w-3 h-3 text-amber-500" /> Dados do servidor: requer Render ativo
          </span>
        </div>
      </div>

      {/* ── Generate modal ──────────────────────────────────── */}
      {showModal && (
        <GerarModal
          onClose={() => setShowModal(false)}
          onGenerated={() => { load(); setShowModal(false); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Revogar Licença"
        message={`Revogar a licença "${confirmRevoke?.key}"? A máquina ainda poderá usar o sistema localmente até o próximo login.`}
        confirmLabel="Revogar"
        variant="warning"
        onConfirm={doRevoke}
        onCancel={() => setConfirmRevoke(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir Registro"
        message={`Excluir permanentemente o registro da licença "${confirmDelete?.key}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
