import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, User, Bell, Save, Loader2, MapPin,
  Mail, Phone, Globe, Shield, Users, Database,
  Plus, Trash2, Eye, EyeOff, Download, Upload, X,
  Calendar, RefreshCw, Link2, Link2Off, CheckCircle2, AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { escritorioApi, usersApi, configApi, backupApi, googleApi, auditoriaApi } from '../services/api';
import type { AuditEntry } from '../services/api';
import { consultarCNPJ, consultarCEP, formatCNPJ, formatCEP, formatTelefone } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { usePushNotifications } from '../hooks/usePushNotifications';

import type { Escritorio, User as UserType, UserRole } from '../types';

type Tab = 'escritorio' | 'responsavel' | 'notificacoes' | 'usuarios' | 'email' | 'dados' | 'google' | 'auditoria';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${checked ? 'bg-amber-500' : 'bg-[#2a2a2a]'}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

const defaultEscritorio: Escritorio = {
  nome: '',
  cnpj: '',
  telefone: '',
  email: '',
  site: '',
  endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
  oabPrincipal: '',
  responsavel: '',
  notificacoes: {
    emailAlertas: true,
    whatsappAlertas: false,
    prazosDias: 5,
    inadimplenciaAuto: true,
  },
};

export default function Configuracoes() {
  const { showToast } = useToast();
  const { user, updateUser, changePassword } = useAuth();
  const [tab, setTab] = useState<Tab>('escritorio');
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEscritorio, setLoadingEscritorio] = useState(true);

  const [escritorio, setEscritorio] = useState<Escritorio>(defaultEscritorio);

  const [userForm, setUserForm] = useState({
    nome: user?.nome || '',
    email: user?.email || '',
    oab: user?.oab || '',
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: '',
  });

  // ── Usuários ──
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [novoUsuarioModal, setNovoUsuarioModal] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', role: 'assistente' as UserRole, oab: '', senha: '' });
  const [showSenha, setShowSenha] = useState(false);

  // ── E-mail SMTP ──
  const [emailConfig, setEmailConfig] = useState<{
    admin: { user: string; configured: boolean };
    advogado: { user: string; configured: boolean };
    assistente: { user: string; configured: boolean };
  } | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailRole, setEmailRole] = useState('admin');
  const [appPassword, setAppPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // ── Backup ──
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);

  // ── Google Calendar ──
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; connectedAt?: string } | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  const isAdmin = user?.role === 'admin';

  // ── Push Notifications ──
  const push = usePushNotifications();

  // ── Generic Confirm Dialog ──
  const [confirmCfg, setConfirmCfg] = useState<null | {
    title: string; message: string; confirmLabel: string; action: () => Promise<void>;
  }>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  function openConfirm(title: string, message: string, label: string, action: () => Promise<void>) {
    setConfirmCfg({ title, message, confirmLabel: label, action });
  }

  async function handleConfirm() {
    if (!confirmCfg) return;
    setConfirmLoading(true);
    try {
      await confirmCfg.action();
    } finally {
      setConfirmLoading(false);
      setConfirmCfg(null);
    }
  }

  // ── Auditoria ──
  const [auditorias, setAuditorias] = useState<AuditEntry[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  const loadAuditoria = useCallback(async () => {
    setLoadingAuditoria(true);
    try {
      const data = await auditoriaApi.getAll();
      setAuditorias(data);
    } catch {
      showToast('error', 'Erro ao carregar log de auditoria');
    } finally {
      setLoadingAuditoria(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'auditoria') loadAuditoria();
  }, [tab, loadAuditoria]);

  // Load escritorio on mount
  useEffect(() => {
    escritorioApi.get()
      .then(data => setEscritorio(data))
      .catch(() => {}) // silencioso — usa default
      .finally(() => setLoadingEscritorio(false));
  }, []);

  // Load users when tab changes to usuarios
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch {
      showToast('error', 'Erro ao carregar usuários');
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === 'usuarios') loadUsers();
  }, [tab, loadUsers]);

  // Load google status when tab changes to google
  const loadGoogleStatus = useCallback(() => {
    setLoadingGoogle(true);
    googleApi.status()
      .then(data => setGoogleStatus(data))
      .catch(() => setGoogleStatus({ connected: false }))
      .finally(() => setLoadingGoogle(false));
  }, []);

  useEffect(() => {
    if (tab === 'google') loadGoogleStatus();
  }, [tab, loadGoogleStatus]);

  // Listen for popup message (OAuth callback)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'msk-google-success') {
        loadGoogleStatus();
        showToast('success', 'Google Calendar conectado!');
      } else if (e.data?.type === 'msk-google-error') {
        showToast('error', 'Erro ao conectar Google Calendar');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadGoogleStatus, showToast]);

  async function conectarGoogle() {
    try {
      const { url } = await googleApi.authUrl();
      const popup = window.open(url, 'google-auth', 'width=520,height=620,scrollbars=yes');
      if (!popup) {
        showToast('error', 'Popup bloqueado pelo navegador. Permita popups para este site.');
      }
    } catch (err: any) {
      showToast('error', 'Erro ao obter URL de autenticação', err.message);
    }
  }

  function desconectarGoogle() {
    openConfirm(
      'Desconectar Google Calendar',
      'Os eventos já criados no Google Calendar não serão removidos. Confirmar desconexão?',
      'Desconectar',
      async () => {
        await googleApi.disconnect();
        setGoogleStatus({ connected: false });
        showToast('info', 'Google Calendar desconectado');
      },
    );
  }

  async function sincronizarGoogle() {
    setSyncingGoogle(true);
    try {
      const result = await googleApi.sync();
      showToast('success', `Sincronização concluída!`, `${result.synced} eventos sincronizados${result.errors > 0 ? `, ${result.errors} erros` : ''}`);
    } catch (err: any) {
      showToast('error', 'Erro ao sincronizar', err.message);
    } finally {
      setSyncingGoogle(false);
    }
  }

  // Load email config when tab changes to email
  useEffect(() => {
    if (tab === 'email') {
      setLoadingEmail(true);
      configApi.getEmail()
        .then(data => setEmailConfig(data))
        .catch(() => showToast('error', 'Erro ao carregar configurações de e-mail'))
        .finally(() => setLoadingEmail(false));
    }
  }, [tab, showToast]);

  function setE(key: string, val: any) {
    setEscritorio(prev => ({ ...prev, [key]: val }));
  }

  function setEnd(key: string, val: string) {
    setEscritorio(prev => ({ ...prev, endereco: { ...prev.endereco, [key]: val } }));
  }

  function setNotif(key: string, val: any) {
    setEscritorio(prev => ({ ...prev, notificacoes: { ...prev.notificacoes, [key]: val } }));
  }

  async function buscarCNPJ() {
    setLoadingCNPJ(true);
    try {
      const data = await consultarCNPJ(escritorio.cnpj);
      const est = data.estabelecimento;
      setEscritorio(prev => ({
        ...prev,
        nome: data.razao_social || prev.nome,
        email: est.email || prev.email,
        telefone: est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : prev.telefone,
        endereco: {
          ...prev.endereco,
          cep: est.cep || prev.endereco.cep,
          logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ') || prev.endereco.logradouro,
          numero: est.numero || prev.endereco.numero,
          bairro: est.bairro || prev.endereco.bairro,
          cidade: est.municipio?.descricao || prev.endereco.cidade,
          uf: est.estado?.sigla || prev.endereco.uf,
        },
      }));
      showToast('success', 'CNPJ consultado!', data.razao_social);
    } catch (err: any) {
      showToast('error', 'Erro ao buscar CNPJ', err.message);
    } finally {
      setLoadingCNPJ(false);
    }
  }

  async function buscarCEP() {
    setLoadingCEP(true);
    try {
      const data = await consultarCEP(escritorio.endereco.cep);
      setEscritorio(prev => ({
        ...prev,
        endereco: {
          ...prev.endereco,
          logradouro: data.logradouro || prev.endereco.logradouro,
          bairro: data.bairro || prev.endereco.bairro,
          cidade: data.localidade || prev.endereco.cidade,
          uf: data.uf || prev.endereco.uf,
        },
      }));
      showToast('success', 'CEP encontrado!');
    } catch (err: any) {
      showToast('error', 'CEP não encontrado', err.message);
    } finally {
      setLoadingCEP(false);
    }
  }

  async function salvarEscritorio(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await escritorioApi.save(escritorio);
      showToast('success', 'Dados do escritório salvos!');
    } catch {
      showToast('error', 'Erro ao salvar dados do escritório');
    } finally {
      setSaving(false);
    }
  }

  async function salvarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (userForm.novaSenha) {
        if (userForm.novaSenha !== userForm.confirmarSenha) {
          showToast('error', 'Senhas não conferem');
          return;
        }
        await changePassword(userForm.senhaAtual, userForm.novaSenha);
        setUserForm(p => ({ ...p, senhaAtual: '', novaSenha: '', confirmarSenha: '' }));
      }
      await usersApi.update(user!.id, { nome: userForm.nome, email: userForm.email, oab: userForm.oab });
      updateUser({ nome: userForm.nome, email: userForm.email, oab: userForm.oab });
      showToast('success', 'Perfil atualizado!');
    } catch (err: any) {
      showToast('error', 'Erro ao salvar', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function salvarNotificacoes(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await escritorioApi.save(escritorio);
      showToast('success', 'Preferências de notificação salvas!');
    } catch {
      showToast('error', 'Erro ao salvar notificações');
    } finally {
      setSaving(false);
    }
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await usersApi.create(novoUsuario);
      showToast('success', 'Usuário criado!');
      setNovoUsuarioModal(false);
      setNovoUsuario({ nome: '', email: '', role: 'assistente', oab: '', senha: '' });
      loadUsers();
    } catch (err: any) {
      showToast('error', 'Erro ao criar usuário', err.message);
    } finally {
      setSaving(false);
    }
  }

  function removerUsuario(u: UserType) {
    openConfirm(
      'Remover Usuário',
      `Tem certeza que deseja remover "${u.nome}" (${u.email})?`,
      'Remover',
      async () => {
        await usersApi.remove(u.id);
        showToast('info', 'Usuário removido');
        loadUsers();
      },
    );
  }

  async function salvarEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!appPassword.trim()) { showToast('error', 'Informe a senha de app'); return; }
    setSavingEmail(true);
    try {
      await configApi.setEmail(emailRole, appPassword);
      showToast('success', 'Configuração de e-mail salva!');
      setAppPassword('');
      // reload email config
      const updated = await configApi.getEmail();
      setEmailConfig(updated);
    } catch {
      showToast('error', 'Erro ao salvar configuração de e-mail');
    } finally {
      setSavingEmail(false);
    }
  }

  async function exportarBackup() {
    try {
      const data = await backupApi.exportar();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `msk-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Backup exportado!');
    } catch {
      showToast('error', 'Erro ao exportar backup');
    }
  }

  function importarBackup() {
    if (!importFile) return;
    const file = importFile; // capture non-null ref for async closure
    openConfirm(
      'Importar Backup',
      `Isso substituirá TODOS os dados atuais pelo conteúdo de "${file.name}". Esta ação não pode ser desfeita.`,
      'Importar e Substituir',
      async () => {
        setImportando(true);
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const result = await backupApi.importar(data);
          const summary = Object.entries(result.summary).map(([k, v]) => `${k}: ${v}`).join(', ');
          showToast('success', `Backup importado! ${summary}`);
          setImportFile(null);
        } catch {
          showToast('error', 'Erro ao importar backup. Verifique o arquivo.');
        } finally {
          setImportando(false);
        }
      },
    );
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  const roleBadge: Record<string, string> = {
    admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    advogado: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    assistente: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const tabs: Array<{ key: Tab; label: string; icon: any; adminOnly?: boolean }> = [
    { key: 'escritorio', label: 'Dados do Escritório', icon: Building2 },
    { key: 'responsavel', label: 'OAB & Responsável', icon: User },
    { key: 'notificacoes', label: 'Notificações', icon: Bell },
    { key: 'google', label: 'Google Calendar', icon: Calendar },
    { key: 'usuarios', label: 'Usuários', icon: Users, adminOnly: true },
    { key: 'email', label: 'E-mail SMTP', icon: Mail, adminOnly: true },
    { key: 'dados', label: 'Dados / Backup', icon: Database, adminOnly: true },
    { key: 'auditoria', label: 'Auditoria', icon: ClipboardList, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-5 animate-fade-in-up max-w-3xl">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Configurações</h1>
        <p className="text-[#a0a0a0] text-sm">Personalize o sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#2a2a2a]">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === t.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-[#505050] hover:text-[#a0a0a0]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Escritório ────────────────────────────────── */}
      {tab === 'escritorio' && (
        loadingEscritorio ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
        ) : (
          <form onSubmit={salvarEscritorio} className="space-y-5">
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <h3 className="font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" /> Identificação
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>CNPJ</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={escritorio.cnpj}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 14) val = formatCNPJ(val);
                        setE('cnpj', val);
                      }}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    <button
                      type="button"
                      onClick={buscarCNPJ}
                      disabled={loadingCNPJ}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 text-sm rounded-lg transition-colors whitespace-nowrap"
                    >
                      {loadingCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                      Buscar
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Nome / Razão Social</label>
                  <input className={inputClass} value={escritorio.nome} onChange={e => setE('nome', e.target.value)} placeholder="Nome do escritório" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}><Mail className="inline w-3 h-3 mr-1" /> E-mail</label>
                    <input type="email" className={inputClass} value={escritorio.email} onChange={e => setE('email', e.target.value)} placeholder="contato@escritorio.adv.br" />
                  </div>
                  <div>
                    <label className={labelClass}><Phone className="inline w-3 h-3 mr-1" /> Telefone</label>
                    <input className={inputClass} value={escritorio.telefone} onChange={e => setE('telefone', formatTelefone(e.target.value.replace(/\D/g, '')))} placeholder="(00) 0000-0000" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}><Globe className="inline w-3 h-3 mr-1" /> Site</label>
                  <input className={inputClass} value={escritorio.site || ''} onChange={e => setE('site', e.target.value)} placeholder="www.escritorio.adv.br" />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <h3 className="font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" /> Endereço
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelClass}>CEP</label>
                    <input
                      className={inputClass}
                      value={escritorio.endereco?.cep || ''}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 8) setEnd('cep', formatCEP(val));
                      }}
                      onBlur={() => { if ((escritorio.endereco?.cep || '').replace(/\D/g, '').length === 8) buscarCEP(); }}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={buscarCEP}
                    disabled={loadingCEP}
                    className="self-end flex items-center gap-2 px-4 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] text-sm rounded-lg transition-colors"
                  >
                    {loadingCEP ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelClass}>Logradouro</label>
                    <input className={inputClass} value={escritorio.endereco?.logradouro || ''} onChange={e => setEnd('logradouro', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Número</label>
                    <input className={inputClass} value={escritorio.endereco?.numero || ''} onChange={e => setEnd('numero', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Complemento</label>
                    <input className={inputClass} value={escritorio.endereco?.complemento || ''} onChange={e => setEnd('complemento', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Bairro</label>
                    <input className={inputClass} value={escritorio.endereco?.bairro || ''} onChange={e => setEnd('bairro', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Cidade</label>
                    <input className={inputClass} value={escritorio.endereco?.cidade || ''} onChange={e => setEnd('cidade', e.target.value)} />
                  </div>
                </div>
                <div className="w-24">
                  <label className={labelClass}>UF</label>
                  <input className={inputClass} value={escritorio.endereco?.uf || ''} onChange={e => setEnd('uf', e.target.value.toUpperCase())} maxLength={2} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Dados do Escritório
            </button>
          </form>
        )
      )}

      {/* ── Tab: Responsável ────────────────────────────────── */}
      {tab === 'responsavel' && (
        <form onSubmit={salvarUsuario} className="space-y-5">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> Dados OAB & Responsável
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nome Completo</label>
                <input className={inputClass} value={userForm.nome} onChange={e => setUserForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>E-mail</label>
                  <input type="email" className={inputClass} value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Inscrição OAB</label>
                  <input className={inputClass} value={userForm.oab} onChange={e => setUserForm(p => ({ ...p, oab: e.target.value }))} placeholder="SP 123456" />
                </div>
              </div>
              <div>
                <label className={labelClass}>OAB Principal do Escritório</label>
                <input className={inputClass} value={escritorio.oabPrincipal} onChange={e => setE('oabPrincipal', e.target.value)} placeholder="SP 123456" />
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-4">Alterar Senha</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Senha Atual</label>
                <input type="password" className={inputClass} value={userForm.senhaAtual} onChange={e => setUserForm(p => ({ ...p, senhaAtual: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nova Senha</label>
                  <input type="password" className={inputClass} value={userForm.novaSenha} onChange={e => setUserForm(p => ({ ...p, novaSenha: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label className={labelClass}>Confirmar Nova Senha</label>
                  <input type="password" className={inputClass} value={userForm.confirmarSenha} onChange={e => setUserForm(p => ({ ...p, confirmarSenha: e.target.value }))} placeholder="••••••••" />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Perfil
          </button>
        </form>
      )}

      {/* ── Tab: Notificações ────────────────────────────────── */}
      {tab === 'notificacoes' && (
        <form onSubmit={salvarNotificacoes} className="space-y-5">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-5 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" /> Preferências de Notificação
            </h3>
            <div className="space-y-5">
              {[
                {
                  key: 'emailAlertas',
                  label: 'Alertas por E-mail',
                  desc: 'Receba notificações de prazos, audiências e inadimplência por e-mail.',
                  icon: Mail,
                },
                {
                  key: 'whatsappAlertas',
                  label: 'Alertas por WhatsApp',
                  desc: 'Receba notificações via WhatsApp Business API.',
                  icon: () => <span className="text-lg">📱</span>,
                },
                {
                  key: 'inadimplenciaAuto',
                  label: 'Notificação automática de inadimplência',
                  desc: 'Enviar automaticamente aviso para clientes com pagamentos vencidos.',
                  icon: () => <span className="text-lg">⚠️</span>,
                },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-0">
                  <div className="flex items-start gap-3">
                    <item.icon className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#f5f5f5]">{item.label}</p>
                      <p className="text-xs text-[#505050] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={!!escritorio.notificacoes?.[item.key as keyof typeof escritorio.notificacoes]}
                    onChange={v => setNotif(item.key, v)}
                  />
                </div>
              ))}

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-[#f5f5f5]">Antecedência de prazos (dias)</p>
                  <p className="text-xs text-[#505050] mt-0.5">Quantos dias antes receber alertas de prazos processuais.</p>
                </div>
                <select
                  className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm w-24"
                  value={escritorio.notificacoes?.prazosDias || 5}
                  onChange={e => setNotif('prazosDias', parseInt(e.target.value))}
                >
                  {[1, 2, 3, 5, 7, 10, 15, 30].map(d => <option key={d} value={d}>{d} dias</option>)}
                </select>
              </div>

              {/* Browser push notifications */}
              <div className="flex items-center justify-between py-3 border-t border-[#2a2a2a]">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">Notificações no Navegador</p>
                    <p className="text-xs text-[#505050] mt-0.5">
                      Receba alertas como pop-up mesmo com o sistema minimizado.
                      {push.permission === 'denied' && (
                        <span className="text-red-400"> (Bloqueado — libere nas configurações do navegador)</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  {!push.supported ? (
                    <span className="text-xs text-[#505050]">Não suportado</span>
                  ) : push.permission === 'granted' ? (
                    <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                    </span>
                  ) : push.permission === 'denied' ? (
                    <span className="text-xs text-red-400">Bloqueado</span>
                  ) : (
                    <button
                      type="button"
                      onClick={push.request}
                      className="text-xs px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg transition-colors"
                    >
                      Ativar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Notificações
          </button>
        </form>
      )}

      {/* ── Tab: Usuários (admin only) ─────────────────────── */}
      {tab === 'usuarios' && isAdmin && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={() => setNovoUsuarioModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>

          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
            {loadingUsers ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#505050] uppercase">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#505050] uppercase">E-mail</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#505050] uppercase">Perfil</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-[#505050] uppercase">OAB</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-4 py-3 text-[#f5f5f5] font-medium">{u.nome}</td>
                      <td className="px-4 py-3 text-[#a0a0a0]">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadge[u.role]}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#a0a0a0]">{u.oab || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => removerUsuario(u)}
                            className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#505050]">Nenhum usuário encontrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal: Novo Usuário */}
          {novoUsuarioModal && (
            <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
              <div className="flex min-h-screen items-center justify-center p-4">
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
                  <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Novo Usuário</h2>
                  <button onClick={() => setNovoUsuarioModal(false)} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={criarUsuario} className="px-6 py-5 space-y-4">
                  <div>
                    <label className={labelClass}>Nome *</label>
                    <input className={inputClass} value={novoUsuario.nome} onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))} required />
                  </div>
                  <div>
                    <label className={labelClass}>E-mail *</label>
                    <input type="email" className={inputClass} value={novoUsuario.email} onChange={e => setNovoUsuario(p => ({ ...p, email: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Perfil</label>
                      <select className={inputClass} value={novoUsuario.role} onChange={e => setNovoUsuario(p => ({ ...p, role: e.target.value as UserRole }))}>
                        <option value="assistente">Assistente</option>
                        <option value="advogado">Advogado</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>OAB</label>
                      <input className={inputClass} value={novoUsuario.oab} onChange={e => setNovoUsuario(p => ({ ...p, oab: e.target.value }))} placeholder="SP 123456" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Senha *</label>
                    <div className="relative">
                      <input
                        type={showSenha ? 'text' : 'password'}
                        className={inputClass}
                        value={novoUsuario.senha}
                        onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))}
                        required
                        minLength={6}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button type="button" onClick={() => setShowSenha(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505050] hover:text-[#a0a0a0]">
                        {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-[#2a2a2a]">
                    <button type="button" onClick={() => setNovoUsuarioModal(false)} className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
                    <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Criar
                    </button>
                  </div>
                </form>
              </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: E-mail SMTP (admin only) ──────────────────── */}
      {tab === 'email' && isAdmin && (
        <div className="space-y-5">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" /> Configuração de E-mail por Perfil
            </h3>
            <p className="text-xs text-[#505050] mb-5">
              Cada perfil de usuário pode ter uma conta Gmail configurada para envio de e-mails. Use uma Senha de App gerada em myaccount.google.com.
            </p>

            {loadingEmail ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : (
              <div className="space-y-3 mb-5">
                {emailConfig && Object.entries(emailConfig).map(([role, cfg]) => (
                  <div key={role} className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-lg border border-[#2a2a2a]">
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadge[role]} mr-2`}>{role}</span>
                      <span className="text-sm text-[#a0a0a0]">{cfg.user || 'Não configurado'}</span>
                    </div>
                    <span className={`text-xs font-medium ${cfg.configured ? 'text-green-400' : 'text-[#505050]'}`}>
                      {cfg.configured ? 'Configurado' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={salvarEmail} className="space-y-4 pt-4 border-t border-[#2a2a2a]">
              <h4 className="text-sm font-medium text-[#f5f5f5]">Configurar / Atualizar</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Perfil</label>
                  <select className={inputClass} value={emailRole} onChange={e => setEmailRole(e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="advogado">Advogado</option>
                    <option value="assistente">Assistente</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Senha de App (Gmail)</label>
                  <input
                    type="password"
                    className={inputClass}
                    value={appPassword}
                    onChange={e => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingEmail}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Configuração
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Google Calendar ───────────────────────────── */}
      {tab === 'google' && (
        <div className="space-y-5">

          {/* Status card */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" /> Google Calendar
            </h3>
            <p className="text-xs text-[#505050] mb-5">
              Sincroniza audiências, prazos e encerramentos de contratos com o Google Calendar de cada usuário.
              A sincronização acontece automaticamente ao cadastrar ou editar eventos.
            </p>

            {loadingGoogle ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : (
              <div className="space-y-4">
                {/* Connection status */}
                <div className={`flex items-center gap-4 p-4 rounded-xl border ${
                  googleStatus?.connected
                    ? 'bg-green-500/8 border-green-500/25'
                    : 'bg-[#1e1e1e] border-[#2a2a2a]'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    googleStatus?.connected ? 'bg-green-500/20' : 'bg-[#2a2a2a]'
                  }`}>
                    {googleStatus?.connected
                      ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                      : <AlertCircle className="w-5 h-5 text-[#505050]" />
                    }
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${googleStatus?.connected ? 'text-green-400' : 'text-[#a0a0a0]'}`}>
                      {googleStatus?.connected ? 'Conectado' : 'Não conectado'}
                    </p>
                    <p className="text-xs text-[#505050]">
                      {googleStatus?.connected && googleStatus.connectedAt
                        ? `Desde ${new Date(googleStatus.connectedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`
                        : 'Clique em "Conectar" para vincular sua conta Google'
                      }
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  {!googleStatus?.connected ? (
                    <button
                      onClick={conectarGoogle}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20"
                    >
                      <Link2 className="w-4 h-4" />
                      Conectar Google Calendar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={sincronizarGoogle}
                        disabled={syncingGoogle}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                      >
                        {syncingGoogle
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <RefreshCw className="w-4 h-4" />
                        }
                        Sincronizar agora
                      </button>
                      <button
                        onClick={desconectarGoogle}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-red-500/30 text-[#a0a0a0] hover:text-red-400 rounded-lg text-sm font-medium transition-all"
                      >
                        <Link2Off className="w-4 h-4" />
                        Desconectar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Setup instructions */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h4 className="text-sm font-semibold text-[#f5f5f5] mb-3">Como configurar</h4>
            <ol className="space-y-3 text-xs text-[#a0a0a0] list-none">
              {[
                { n: '1', text: 'Acesse o Google Cloud Console (console.cloud.google.com) e crie um projeto.' },
                { n: '2', text: 'Em "APIs e Serviços" → "Biblioteca", ative a Google Calendar API.' },
                { n: '3', text: 'Em "Credenciais", crie uma credencial OAuth 2.0 (tipo: Aplicativo da Web). Adicione http://localhost:3001/api/google/callback como URI de redirecionamento autorizado.' },
                { n: '4', text: 'Copie o Client ID e o Client Secret para o arquivo .env do servidor:', extra: 'GOOGLE_CLIENT_ID=seu_client_id\nGOOGLE_CLIENT_SECRET=seu_client_secret\nGOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback' },
                { n: '5', text: 'Reinicie o servidor e clique em "Conectar Google Calendar" acima.' },
              ].map(step => (
                <li key={step.n} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step.n}</span>
                  <div>
                    <p>{step.text}</p>
                    {step.extra && (
                      <pre className="mt-2 p-2 bg-[#0a0a0a] rounded text-[11px] text-green-400 overflow-x-auto">
                        {step.extra}
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* What gets synced */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h4 className="text-sm font-semibold text-[#f5f5f5] mb-3">O que é sincronizado</h4>
            <div className="space-y-2">
              {[
                { icon: '⚖️', label: 'Audiências', desc: 'Data, hora, tipo e local de cada audiência cadastrada nos processos. Lembrete por e-mail 24h antes e popup 1h antes.' },
                { icon: '🔔', label: 'Prazos e avisos', desc: 'Avisos não lidos com data-limite definida. Lembrete 8h antes no dia.' },
                { icon: '📋', label: 'Encerramento de contratos', desc: 'Contratos ativos com data de fim definida. Lembrete por e-mail 7 dias antes.' },
              ].map(item => (
                <div key={item.label} className="flex gap-3 p-3 rounded-lg bg-[#1e1e1e]">
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">{item.label}</p>
                    <p className="text-xs text-[#505050] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Dados / Backup (admin only) ───────────────── */}
      {tab === 'dados' && isAdmin && (
        <div className="space-y-5">
          {/* Exportar */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400" /> Exportar Backup
            </h3>
            <p className="text-xs text-[#505050] mb-4">
              Exporta todos os dados do sistema (clientes, contratos, processos, lançamentos, avisos) em formato JSON.
            </p>
            <button
              onClick={exportarBackup}
              className="flex items-center gap-2 px-6 py-3 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400 rounded-lg text-sm font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Baixar Backup JSON
            </button>
          </div>

          {/* Importar */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" /> Importar Backup
            </h3>
            <p className="text-xs text-[#505050] mb-4">
              Importa dados a partir de um arquivo JSON exportado anteriormente. <strong className="text-red-400">Atenção: substitui todos os dados atuais.</strong>
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-[#1e1e1e] border border-dashed border-[#2a2a2a] hover:border-amber-500/30 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-[#505050] shrink-0" />
                <span className="text-sm text-[#505050]">
                  {importFile ? importFile.name : 'Clique para selecionar arquivo .json'}
                </span>
                <input
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                />
              </label>
              {importFile && (
                <button
                  onClick={importarBackup}
                  disabled={importando}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Importar e Substituir Dados
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── Tab: Auditoria (admin only) ─────────────────────── */}
      {tab === 'auditoria' && isAdmin && (
        <div className="space-y-5">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-400" /> Log de Auditoria
              </h3>
              <button
                onClick={loadAuditoria}
                disabled={loadingAuditoria}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditoria ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
            {loadingAuditoria ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : auditorias.length === 0 ? (
              <p className="text-center py-8 text-[#505050] text-sm">Nenhum registro de auditoria encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2a2a]">
                      <th className="text-left px-4 py-3 text-[#505050] font-medium uppercase tracking-wider">Ação</th>
                      <th className="text-left px-4 py-3 text-[#505050] font-medium uppercase tracking-wider">Entidade</th>
                      <th className="text-left px-4 py-3 text-[#505050] font-medium uppercase tracking-wider hidden md:table-cell">Usuário</th>
                      <th className="text-left px-4 py-3 text-[#505050] font-medium uppercase tracking-wider hidden lg:table-cell">Detalhe</th>
                      <th className="text-left px-4 py-3 text-[#505050] font-medium uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e1e]">
                    {auditorias.map(a => (
                      <tr key={a.id} className="hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-amber-400">{a.acao}</span>
                        </td>
                        <td className="px-4 py-3 text-[#a0a0a0]">
                          {a.entidade}
                          {a.entidadeId && <span className="text-[#505050] ml-1">#{a.entidadeId.slice(0, 6)}</span>}
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
        </div>
      )}

      {/* Generic Confirm Dialog */}
      <ConfirmDialog
        open={confirmCfg !== null}
        title={confirmCfg?.title ?? ''}
        message={confirmCfg?.message ?? ''}
        confirmLabel={confirmCfg?.confirmLabel}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmCfg(null)}
        loading={confirmLoading}
      />
    </div>
  );
}
