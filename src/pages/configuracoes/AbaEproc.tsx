import { useState, useEffect, useCallback } from 'react';
import {
  Server, Plus, Trash2, CheckCircle, Loader2, X, Eye, EyeOff, AlertCircle,
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

interface Tribunal {
  key: string;
  nome: string;
}

export default function AbaEproc() {
  const { showToast } = useToast();

  const [credenciais,   setCredenciais]   = useState<Credencial[]>([]);
  const [tribunais,     setTribunais]     = useState<Tribunal[]>([]);
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
      const [creds, tribs] = await Promise.all([
        eprocApi.getConfigurados().catch(() => []),
        eprocApi.getTribunais().catch(() => []),
      ]);
      setCredenciais(creds);
      setTribunais(tribs);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!selTribunal || !usuario || !senha) {
      showToast('warning', 'Preencha todos os campos.');
      return;
    }
    setSaving(true);
    try {
      await eprocApi.salvarCredencial(selTribunal, usuario, senha);
      showToast('success', 'Credencial salva!');
      setAddOpen(false); setSelTribunal(''); setUsuario(''); setSenha('');
      await load();
    } catch (e: any) { showToast('error', 'Erro ao salvar', e.message); }
    finally { setSaving(false); }
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

  async function testar() {
    if (!selTribunal || !usuario || !senha) {
      showToast('warning', 'Preencha todos os campos para testar.');
      return;
    }
    setTestando(true);
    try {
      // Save temporarily to test
      await eprocApi.salvarCredencial(selTribunal, usuario, senha);
      showToast('success', 'Credencial válida!', 'Login realizado com sucesso no e-Proc.');
      await load();
      setAddOpen(false); setSelTribunal(''); setUsuario(''); setSenha('');
    } catch (e: any) { showToast('error', 'Falha no login', e.message); }
    finally { setTestando(false); }
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] outline-none focus:border-amber-500/40 transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2 text-sm">
              <Server className="w-4 h-4 text-amber-400" /> Integração e-Proc
            </h3>
            <p className="text-xs text-[#505050] mt-1 leading-relaxed">
              Configure login e senha de cada tribunal com e-Proc para buscar dados de processos
              automaticamente ao digitar o número CNJ.
              <br />
              <span className="text-amber-400/70">Compatível com: TJSC, TJPR, TJRS, TRF4, TRF1.</span>
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar tribunal
          </button>
        </div>

        {/* Configured tribunals list */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>
        ) : credenciais.length === 0 ? (
          <div className="text-center py-8 text-[#505050]">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum tribunal configurado</p>
            <p className="text-xs mt-1">Clique em "Adicionar tribunal" para começar</p>
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
                <button
                  onClick={() => setConfirmDelete(c)}
                  className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remover credencial"
                >
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
          <strong className="text-amber-400">Segurança:</strong> A senha é armazenada criptografada com AES-256-GCM no servidor Render.
          O sistema faz login no e-Proc e guarda a sessão por até 4 horas para evitar logins repetidos.
          Use um login exclusivo para o sistema se preferir.
        </p>
      </div>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" /> Adicionar credencial e-Proc
              </h3>
              <button onClick={() => setAddOpen(false)} className="text-[#505050] hover:text-[#f5f5f5]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Tribunal *</label>
                <select className={inputClass} value={selTribunal} onChange={e => setSelTribunal(e.target.value)}>
                  <option value="">Selecione o tribunal...</option>
                  {tribunais
                    .filter(t => !credenciais.find(c => c.tribunal === t.key))
                    .map(t => <option key={t.key} value={t.key}>{t.nome} ({t.key.toUpperCase()})</option>)
                  }
                </select>
              </div>
              <div>
                <label className={labelClass}>Usuário (CPF, login ou OAB) *</label>
                <input className={inputClass} value={usuario} onChange={e => setUsuario(e.target.value)}
                  placeholder="Ex: 12345678901 ou miriamkuchnier" autoComplete="off" />
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
                  />
                  <button type="button" onClick={() => setShowSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#f5f5f5] transition-colors">
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAddOpen(false)}
                className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={testar} disabled={testando || saving}
                className="flex-1 py-2.5 bg-[#1e1e1e] border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Testar e salvar
              </button>
              <button onClick={handleSave} disabled={saving || testando}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remover Credencial"
        message={`Remover o acesso ao ${confirmDelete?.nome}? Você poderá reconfigurar a qualquer momento.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
