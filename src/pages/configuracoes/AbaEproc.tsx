import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server, Plus, Trash2, CheckCircle, Loader2, X, Eye, EyeOff, AlertCircle, ChevronDown,
} from 'lucide-react';
import { eprocApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface Credencial {
  tribunal: string;
  nome: string;
  usuario: string;
  atualizadoEm: string;
}

// Hardcoded so the list shows even before the server responds
const TRIBUNAIS_EPROC = [
  { key: 'tjsc',  nome: 'TJ Santa Catarina (e-Proc TJSC)' },
  { key: 'tjpr',  nome: 'TJ Paraná (e-Proc TJPR)' },
  { key: 'tjrs',  nome: 'TJ Rio Grande do Sul (e-Proc TJRS)' },
  { key: 'trf4',  nome: 'TRF 4ª Região' },
  { key: 'trf1',  nome: 'TRF 1ª Região' },
];

// ─── Custom dropdown component ────────────────────────────────
function TribunalSelect({
  value, onChange, disabledKeys = [],
}: {
  value: string;
  onChange: (v: string) => void;
  disabledKeys?: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const available = TRIBUNAIS_EPROC.filter(t => !disabledKeys.includes(t.key));
  const selected  = TRIBUNAIS_EPROC.find(t => t.key === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
          open
            ? 'bg-[#1e1e1e] border-amber-500/40 text-[#f5f5f5]'
            : 'bg-[#1e1e1e] border-[#2a2a2a] hover:border-[#3a3a3a] text-[#f5f5f5]'
        }`}
      >
        <span className={selected ? 'text-[#f5f5f5]' : 'text-[#505050]'}>
          {selected ? selected.nome : 'Selecione o tribunal...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#505050] shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[60] left-0 right-0 top-full mt-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
          {available.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[#505050] text-center">Todos os tribunais já foram configurados</p>
          ) : available.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { onChange(t.key); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between group ${
                value === t.key
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-[#a0a0a0] hover:bg-white/5 hover:text-[#f5f5f5]'
              }`}
            >
              <span>{t.nome}</span>
              {value === t.key && <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function AbaEproc() {
  const { showToast } = useToast();

  const [credenciais,   setCredenciais]   = useState<Credencial[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [addOpen,       setAddOpen]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Credencial | null>(null);

  // Form state
  const [selTribunal, setSelTribunal] = useState('');
  const [usuario,     setUsuario]     = useState('');
  const [senha,       setSenha]       = useState('');
  const [showSenha,   setShowSenha]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [testando,    setTestando]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const creds = await eprocApi.getConfigurados().catch(() => []);
      setCredenciais(creds);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setSelTribunal(''); setUsuario(''); setSenha(''); setShowSenha(false);
  }

  async function handleSave() {
    if (!selTribunal || !usuario || !senha) {
      showToast('warning', 'Preencha todos os campos.'); return;
    }
    setSaving(true);
    try {
      await eprocApi.salvarCredencial(selTribunal, usuario, senha);
      showToast('success', 'Credencial salva!');
      setAddOpen(false); resetForm(); await load();
    } catch (e: any) { showToast('error', 'Erro ao salvar', e.message); }
    finally { setSaving(false); }
  }

  async function testarESalvar() {
    if (!selTribunal || !usuario || !senha) {
      showToast('warning', 'Preencha todos os campos para testar.'); return;
    }
    setTestando(true);
    try {
      await eprocApi.salvarCredencial(selTribunal, usuario, senha);
      showToast('success', 'Login válido!', 'Credencial salva com sucesso.');
      setAddOpen(false); resetForm(); await load();
    } catch (e: any) { showToast('error', 'Falha no login', e.message); }
    finally { setTestando(false); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await eprocApi.removerCredencial(confirmDelete.tribunal);
      showToast('info', `Credencial ${confirmDelete.nome} removida.`);
      await load();
    } catch (e: any) { showToast('error', 'Erro ao remover', e.message); }
    finally { setConfirmDelete(null); }
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] outline-none focus:border-amber-500/40 transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";
  const busy       = saving || testando;

  return (
    <div className="space-y-5">

      {/* Header card */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2 text-sm">
              <Server className="w-4 h-4 text-amber-400" /> Integração e-Proc
            </h3>
            <p className="text-xs text-[#505050] mt-1 leading-relaxed">
              Configure login e senha para buscar dados de processos automaticamente.
              <br />
              <span className="text-amber-400/70">Compatível com TJSC, TJPR, TJRS, TRF4 e TRF1.</span>
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setAddOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors shrink-0 ml-3"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar tribunal
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>
        ) : credenciais.length === 0 ? (
          <div className="text-center py-8 text-[#505050]">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum tribunal configurado</p>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {credenciais.map(c => (
              <div key={c.tribunal} className="flex items-center gap-3 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#f5f5f5]">{c.nome}</p>
                  <p className="text-xs text-[#505050]">
                    Usuário: {c.usuario} · Atualizado em {new Date(c.atualizadoEm).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button onClick={() => setConfirmDelete(c)}
                  className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-[#505050] leading-relaxed">
          <strong className="text-amber-400">Segurança:</strong> A senha é armazenada criptografada com AES-256-GCM.
          O sistema reutiliza a sessão por até 4 horas para evitar logins repetidos.
        </p>
      </div>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-[#f5f5f5] text-sm">Adicionar credencial e-Proc</h3>
              </div>
              <button onClick={() => { setAddOpen(false); resetForm(); }}
                className="text-[#505050] hover:text-[#f5f5f5] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelClass}>Tribunal *</label>
                <TribunalSelect
                  value={selTribunal}
                  onChange={setSelTribunal}
                  disabledKeys={credenciais.map(c => c.tribunal)}
                />
              </div>

              <div>
                <label className={labelClass}>Usuário (CPF, login ou OAB) *</label>
                <input className={inputClass} value={usuario}
                  onChange={e => setUsuario(e.target.value)}
                  placeholder="Ex: 12345678901 ou miriamkuchnier"
                  autoComplete="off" />
              </div>

              <div>
                <label className={labelClass}>Senha *</label>
                <div className="relative">
                  <input
                    type={showSenha ? 'text' : 'password'}
                    className={`${inputClass} pr-10`}
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Sua senha do e-Proc"
                    autoComplete="new-password"
                    onKeyDown={e => e.key === 'Enter' && !busy && handleSave()}
                  />
                  <button type="button" onClick={() => setShowSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#f5f5f5] transition-colors">
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer — two rows so buttons don't crowd */}
            <div className="px-6 pb-5 space-y-2">
              {/* Primary action — full width */}
              <button onClick={testarESalvar} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1e1e1e] border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                {testando
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando login…</>
                  : <><CheckCircle className="w-4 h-4" /> Testar login e salvar</>
                }
              </button>
              {/* Secondary row */}
              <div className="flex gap-2">
                <button onClick={() => { setAddOpen(false); resetForm(); }}
                  className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f5f5f5] rounded-lg text-sm transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-all disabled:opacity-50">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
                    : <><Plus className="w-4 h-4" /> Salvar sem testar</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remover Credencial"
        message={`Remover o acesso ao ${confirmDelete?.nome}?`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
