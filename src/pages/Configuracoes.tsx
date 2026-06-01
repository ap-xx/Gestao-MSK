import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, User, Bell, Save, Loader2, MapPin,
  Mail, Phone, Globe, Shield, Users, Database,
  Plus, Trash2, Eye, EyeOff, Download, Upload, X,
  Calendar, RefreshCw, Link2, Link2Off, CheckCircle2, AlertCircle,
  ClipboardList, Clock, Edit2, ShieldCheck, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { escritorioApi, usersApi, configApi, backupApi, googleApi, auditoriaApi, perfisApi } from '../services/api';
import {
  type BackupSchedule, type BackupMode,
  BACKUP_SCHED_KEY, BACKUP_LAST_KEY, BACKUP_MODE_KEY,
  BACKUP_TIME_KEY, BACKUP_DOW_KEY, BACKUP_DOM_KEY,
  triggerBackupDownload,
} from '../hooks/useAutoBackup';
import type { AuditEntry, Perfil } from '../services/api';
import { consultarCNPJ, consultarCEP, formatCNPJ, formatCEP, formatTelefone } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Portal from '../components/ui/Portal';

import type { Escritorio, User as UserType, UserRole } from '../types';

type Tab = 'escritorio' | 'responsavel' | 'notificacoes' | 'usuarios' | 'email' | 'dados' | 'google' | 'auditoria' | 'permissoes';

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

  // ── Backup automático ──
  const [backupSchedule, setBackupSchedule] = useState<BackupSchedule>(
    () => (localStorage.getItem(BACKUP_SCHED_KEY) as BackupSchedule) || 'desabilitado',
  );
  const [backupMode, setBackupMode] = useState<BackupMode>(
    () => (localStorage.getItem(BACKUP_MODE_KEY) as BackupMode) || 'auto',
  );
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(
    () => localStorage.getItem(BACKUP_LAST_KEY),
  );
  const [backupBaixando, setBackupBaixando] = useState(false);

  // ── Backup horário / dia ──
  const [backupTime, setBackupTime] = useState<string>(
    () => localStorage.getItem(BACKUP_TIME_KEY) || '08:00',
  );
  const [backupDow, setBackupDow] = useState<number>(
    () => Number(localStorage.getItem(BACKUP_DOW_KEY) ?? '1'),
  );
  const [backupDom, setBackupDom] = useState<number>(
    () => Number(localStorage.getItem(BACKUP_DOM_KEY) ?? '1'),
  );

  // ── Filtros de auditoria ──
  const [auditFiltroAcao,        setAuditFiltroAcao]        = useState('');
  const [auditFiltroUsuario,     setAuditFiltroUsuario]     = useState('');
  const [auditFiltroDataInicio,  setAuditFiltroDataInicio]  = useState('');
  const [auditFiltroDataFim,     setAuditFiltroDataFim]     = useState('');
  const [auditFiltroHoraInicio,  setAuditFiltroHoraInicio]  = useState('');
  const [auditFiltroHoraFim,     setAuditFiltroHoraFim]     = useState('');

  // ── Editar usuário ──
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editUserForm, setEditUserForm] = useState({ nome: '', email: '', role: 'assistente' as UserRole, oab: '', novaSenha: '' });
  const [editUserSaving, setEditUserSaving] = useState(false);

  // ── Permissões / Perfis ──
  const ALL_MODULES: Array<{ key: string; label: string }> = [
    { key: 'dashboard',     label: 'Dashboard' },
    { key: 'clientes',      label: 'Clientes' },
    { key: 'contratos',     label: 'Contratos' },
    { key: 'processos',     label: 'Processos' },
    { key: 'honorarios',    label: 'Honorários' },
    { key: 'agenda',        label: 'Agenda' },
    { key: 'inadimplencia', label: 'Inadimplência' },
    { key: 'avisos',        label: 'Avisos' },
    { key: 'relatorios',    label: 'Relatórios' },
    { key: 'configuracoes', label: 'Configurações' },
  ];
  const [perfis, setPerfis]             = useState<Perfil[]>([]);
  const [permissions, setPermissions]   = useState<Record<string, string[]>>({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms]   = useState(false);
  const [novoPerfilForm, setNovoPerfilForm] = useState<{ nome: string; descricao: string; modulos: string[] } | null>(null);
  const [editandoPerfil, setEditandoPerfil] = useState<Perfil | null>(null);
  const [editPerfilForm, setEditPerfilForm] = useState<{ nome: string; descricao: string; modulos: string[] }>({ nome: '', descricao: '', modulos: [] });

  // ── Google Calendar ──
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; connectedAt?: string } | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [conectandoGoogle, setConectandoGoogle] = useState(false);

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
  // Cleanup
  const [limpezaModo, setLimpezaModo] = useState<'periodo' | 'antes' | 'tudo'>('antes');
  const [limpezaInicio, setLimpezaInicio] = useState('');
  const [limpezaFim,    setLimpezaFim]    = useState('');
  const [limpezaLoading, setLimpezaLoading] = useState(false);

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
        setConectandoGoogle(false);
      } else if (e.data?.type === 'msk-google-error') {
        showToast('error', 'Erro ao conectar Google Calendar');
        setConectandoGoogle(false);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadGoogleStatus, showToast]);

  async function conectarGoogle() {
    setConectandoGoogle(true);
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    let checkClosed: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (keepAlive)   clearInterval(keepAlive);
      if (checkClosed) clearInterval(checkClosed);
      setConectandoGoogle(false);
    };

    try {
      // authUrl request wakes the Render server; only then open the popup
      const { url } = await googleApi.authUrl();

      const popup = window.open(url, 'google-auth', 'width=520,height=620,scrollbars=yes');
      if (!popup) {
        showToast('error', 'Popup bloqueado pelo navegador. Permita popups para este site.');
        cleanup();
        return;
      }

      // Ping the server every 12 s to prevent Render free tier from sleeping
      // while the user completes Google's consent screen
      keepAlive = setInterval(() => {
        googleApi.status().catch(() => {});
      }, 12_000);

      // Detect popup close (user cancelled or OAuth completed)
      checkClosed = setInterval(() => {
        if (popup.closed) cleanup();
      }, 1_000);

    } catch (err: any) {
      showToast('error', 'Erro ao obter URL de autenticação', err.message);
      cleanup();
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

  function saveBackupSchedule(v: BackupSchedule) {
    setBackupSchedule(v);
    localStorage.setItem(BACKUP_SCHED_KEY, v);
    showToast('info', `Frequência de backup: ${
      { desabilitado: 'desabilitado', diario: 'diário', semanal: 'semanal', mensal: 'mensal' }[v]
    }`);
  }

  function saveBackupMode(v: BackupMode) {
    setBackupMode(v);
    localStorage.setItem(BACKUP_MODE_KEY, v);
    showToast('info', v === 'auto' ? 'Backup: baixar automaticamente' : 'Backup: apenas notificar');
  }

  function saveBackupTime(v: string) {
    setBackupTime(v);
    localStorage.setItem(BACKUP_TIME_KEY, v);
  }
  function saveBackupDow(v: number) {
    setBackupDow(v);
    localStorage.setItem(BACKUP_DOW_KEY, String(v));
  }
  function saveBackupDom(v: number) {
    setBackupDom(v);
    localStorage.setItem(BACKUP_DOM_KEY, String(v));
  }

  // ── Auditoria: dados derivados ──
  const auditAcoes = useMemo(
    () => Array.from(new Set(auditorias.map(a => a.acao))).sort(),
    [auditorias],
  );
  const auditUsuarios = useMemo(
    () => Array.from(new Set(auditorias.map(a => a.userNome))).sort(),
    [auditorias],
  );
  const auditFiltered = useMemo(() => {
    return auditorias.filter(a => {
      if (auditFiltroAcao    && a.acao     !== auditFiltroAcao)    return false;
      if (auditFiltroUsuario && a.userNome !== auditFiltroUsuario) return false;
      const dt       = new Date(a.criadoEm);
      const dateStr  = dt.toISOString().slice(0, 10);
      const hh       = String(dt.getHours()).padStart(2, '0');
      const mm       = String(dt.getMinutes()).padStart(2, '0');
      const timeStr  = `${hh}:${mm}`;
      if (auditFiltroDataInicio && dateStr < auditFiltroDataInicio) return false;
      if (auditFiltroDataFim    && dateStr > auditFiltroDataFim)    return false;
      if (auditFiltroHoraInicio && timeStr < auditFiltroHoraInicio) return false;
      if (auditFiltroHoraFim    && timeStr > auditFiltroHoraFim)    return false;
      return true;
    });
  }, [auditorias, auditFiltroAcao, auditFiltroUsuario, auditFiltroDataInicio, auditFiltroDataFim, auditFiltroHoraInicio, auditFiltroHoraFim]);

  function limparFiltrosAuditoria() {
    setAuditFiltroAcao('');
    setAuditFiltroUsuario('');
    setAuditFiltroDataInicio('');
    setAuditFiltroDataFim('');
    setAuditFiltroHoraInicio('');
    setAuditFiltroHoraFim('');
  }

  // ── Permissões / Perfis ──
  const loadPermissions = useCallback(async () => {
    setLoadingPerms(true);
    try {
      const [perfsData, permsData] = await Promise.all([
        perfisApi.getAll(),
        perfisApi.getPermissions(),
      ]);
      setPerfis(perfsData);
      // ensure all roles exist in permissions
      const base: Record<string, string[]> = {
        admin:      ALL_MODULES.map(m => m.key),
        advogado:   ['dashboard','clientes','contratos','processos','honorarios','agenda','inadimplencia','avisos','relatorios'],
        assistente: ['dashboard','clientes','contratos','honorarios','agenda','avisos'],
        ...permsData,
      };
      setPermissions(base);
    } catch {
      showToast('error', 'Erro ao carregar permissões');
    } finally {
      setLoadingPerms(false);
    }
  }, [showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'permissoes') loadPermissions();
  }, [tab, loadPermissions]);

  async function salvarPermissions() {
    setSavingPerms(true);
    try {
      await perfisApi.setPermissions(permissions);
      showToast('success', 'Permissões salvas!');
    } catch {
      showToast('error', 'Erro ao salvar permissões');
    } finally {
      setSavingPerms(false);
    }
  }

  function togglePerm(role: string, module: string) {
    setPermissions(prev => {
      const cur = prev[role] ?? [];
      const updated = cur.includes(module) ? cur.filter(m => m !== module) : [...cur, module];
      return { ...prev, [role]: updated };
    });
  }

  async function criarPerfil() {
    if (!novoPerfilForm || !novoPerfilForm.nome.trim()) return;
    try {
      await perfisApi.create({ nome: novoPerfilForm.nome, descricao: novoPerfilForm.descricao, modulos: novoPerfilForm.modulos });
      showToast('success', 'Perfil criado!');
      setNovoPerfilForm(null);
      loadPermissions();
    } catch (err: any) {
      showToast('error', 'Erro ao criar perfil', err.message);
    }
  }

  async function salvarEditarPerfil() {
    if (!editandoPerfil) return;
    try {
      await perfisApi.update(editandoPerfil.id, editPerfilForm);
      showToast('success', 'Perfil atualizado!');
      setEditandoPerfil(null);
      loadPermissions();
    } catch (err: any) {
      showToast('error', 'Erro ao atualizar perfil', err.message);
    }
  }

  function removerPerfil(p: Perfil) {
    openConfirm(
      'Remover Perfil',
      `Remover o perfil "${p.nome}"? Usuários com este perfil voltarão ao perfil padrão.`,
      'Remover',
      async () => {
        await perfisApi.remove(p.id);
        showToast('info', 'Perfil removido');
        loadPermissions();
      },
    );
  }

  // ── Editar usuário ──
  function openEditUser(u: UserType) {
    setEditingUser(u);
    setEditUserForm({ nome: u.nome, email: u.email, role: u.role, oab: u.oab || '', novaSenha: '' });
  }

  async function salvarEditarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserSaving(true);
    try {
      const payload: any = { nome: editUserForm.nome, email: editUserForm.email, role: editUserForm.role, oab: editUserForm.oab };
      if (editUserForm.novaSenha.trim()) payload.senha = editUserForm.novaSenha;
      await usersApi.update(editingUser.id, payload);
      showToast('success', 'Usuário atualizado!');
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      showToast('error', 'Erro ao atualizar usuário', err.message);
    } finally {
      setEditUserSaving(false);
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
    setBackupBaixando(true);
    try {
      await triggerBackupDownload();
      setLastAutoBackup(localStorage.getItem(BACKUP_LAST_KEY));
      showToast('success', 'Backup exportado!');
    } catch {
      showToast('error', 'Erro ao exportar backup');
    } finally {
      setBackupBaixando(false);
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
    { key: 'escritorio',  label: 'Dados do Escritório', icon: Building2 },
    { key: 'responsavel', label: 'OAB & Responsável',   icon: User },
    { key: 'notificacoes',label: 'Notificações',         icon: Bell },
    { key: 'google',      label: 'Google Calendar',      icon: Calendar },
    { key: 'usuarios',    label: 'Usuários',             icon: Users,        adminOnly: true },
    { key: 'permissoes',  label: 'Permissões',           icon: ShieldCheck,  adminOnly: true },
    { key: 'email',       label: 'E-mail SMTP',          icon: Mail },
    { key: 'dados',       label: 'Dados / Backup',       icon: Database },
    { key: 'auditoria',   label: 'Auditoria',            icon: ClipboardList },
  ];

  // admin: all tabs; advogado: all except adminOnly; assistente: can't reach this page
  const visibleTabs = tabs.filter(t => {
    if (t.adminOnly) return isAdmin;
    if (user?.role === 'assistente') return !['email', 'dados', 'auditoria', 'usuarios', 'permissoes'].includes(t.key);
    return true;
  });

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

            {/* ── Chave PIX ── */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
              <div>
                <h3 className="font-semibold text-[#f5f5f5] mb-0.5 flex items-center gap-2 text-sm">
                  <span className="text-green-400">◆</span> Chave PIX
                </h3>
                <p className="text-xs text-[#505050]">
                  Usada para gerar cobranças PIX estáticas diretamente dos lançamentos.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Tipo da chave</label>
                  <select
                    className={inputClass}
                    value={escritorio.pixKeyType || ''}
                    onChange={e => setEscritorio(prev => ({ ...prev, pixKeyType: e.target.value as any }))}
                  >
                    <option value="">Selecione…</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone (+55…)</option>
                    <option value="aleatoria">Chave Aleatória</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Chave PIX</label>
                  <input
                    className={inputClass}
                    value={escritorio.pixKey || ''}
                    onChange={e => setEscritorio(prev => ({ ...prev, pixKey: e.target.value }))}
                    placeholder={
                      escritorio.pixKeyType === 'cpf'      ? '000.000.000-00' :
                      escritorio.pixKeyType === 'cnpj'     ? '00.000.000/0000-00' :
                      escritorio.pixKeyType === 'email'    ? 'seuemail@exemplo.com' :
                      escritorio.pixKeyType === 'telefone' ? '+5511999999999' :
                      'Cole sua chave aleatória aqui'
                    }
                  />
                </div>
              </div>
              {escritorio.pixKey && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  ✓ Chave configurada — botão PIX aparecerá nos lançamentos &quot;A Receber&quot;
                </p>
              )}
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
                    <th className="px-4 py-3 text-xs font-medium text-[#505050] uppercase text-right">Ações</th>
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditUser(u)}
                            className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => removerUsuario(u)}
                              className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
            <Portal>
            <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
              <div className="flex justify-center p-4">
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
            </Portal>
          )}

          {/* Modal: Editar Usuário */}
          {editingUser && (
            <Portal>
            <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
              <div className="flex justify-center p-4">
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
                  <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Editar Usuário</h2>
                  <button onClick={() => setEditingUser(null)} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={salvarEditarUsuario} className="px-6 py-5 space-y-4">
                  <div>
                    <label className={labelClass}>Nome *</label>
                    <input className={inputClass} value={editUserForm.nome} onChange={e => setEditUserForm(p => ({ ...p, nome: e.target.value }))} required />
                  </div>
                  <div>
                    <label className={labelClass}>E-mail *</label>
                    <input type="email" className={inputClass} value={editUserForm.email} onChange={e => setEditUserForm(p => ({ ...p, email: e.target.value }))} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Perfil</label>
                      <select className={inputClass} value={editUserForm.role} onChange={e => setEditUserForm(p => ({ ...p, role: e.target.value as UserRole }))}>
                        <option value="assistente">Assistente</option>
                        <option value="advogado">Advogado</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>OAB</label>
                      <input className={inputClass} value={editUserForm.oab} onChange={e => setEditUserForm(p => ({ ...p, oab: e.target.value }))} placeholder="SP 123456" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Nova Senha <span className="text-[#505050]">(deixe vazio para não alterar)</span></label>
                    <input
                      type="password"
                      className={inputClass}
                      value={editUserForm.novaSenha}
                      onChange={e => setEditUserForm(p => ({ ...p, novaSenha: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-[#2a2a2a]">
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
                    <button type="submit" disabled={editUserSaving} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                      {editUserSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
              </div>
            </div>
            </Portal>
          )}
        </div>
      )}

      {/* ── Tab: E-mail SMTP ──────────────────────────────── */}
      {tab === 'email' && (
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
                <div className="flex flex-wrap gap-3 items-center">
                  {!googleStatus?.connected ? (
                    <>
                      <button
                        onClick={conectarGoogle}
                        disabled={conectandoGoogle}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {conectandoGoogle
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Link2 className="w-4 h-4" />
                        }
                        {conectandoGoogle ? 'Aguardando servidor...' : 'Conectar Google Calendar'}
                      </button>
                      {conectandoGoogle && (
                        <p className="text-xs text-[#505050] leading-tight">
                          O servidor pode levar até 30 s para acordar.<br />
                          A janela do Google permanece válida.
                        </p>
                      )}
                    </>
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

      {/* ── Tab: Dados / Backup ─────────────────────────────── */}
      {tab === 'dados' && (
        <div className="space-y-5">

          {/* Backup Automático */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-5">
            <div>
              <h3 className="font-semibold text-[#f5f5f5] mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Backup Automático
              </h3>
              <p className="text-xs text-[#505050]">
                Roda quando o site é aberto, respeitando o intervalo configurado.
              </p>
            </div>

            {/* Frequência */}
            <div>
              <p className="text-xs font-medium text-[#a0a0a0] mb-2">Frequência</p>
              <div className="flex flex-wrap gap-2">
                {(['desabilitado','diario','semanal','mensal'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => saveBackupSchedule(v)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      backupSchedule === v
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f5f5f5]'
                    }`}
                  >
                    {{ desabilitado: 'Desabilitado', diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' }[v]}
                  </button>
                ))}
              </div>
            </div>

            {/* Modo — só exibe se backup não for desabilitado */}
            {backupSchedule !== 'desabilitado' && (
              <div>
                <p className="text-xs font-medium text-[#a0a0a0] mb-2">Quando vencer</p>
                <div className="flex gap-2">
                  {([
                    { v: 'auto',      label: 'Baixar automaticamente', desc: 'O arquivo é baixado sem perguntar' },
                    { v: 'notificar', label: 'Apenas notificar',        desc: 'Mostra um aviso; você decide quando baixar' },
                  ] as { v: BackupMode; label: string; desc: string }[]).map(({ v, label, desc }) => (
                    <button
                      key={v}
                      onClick={() => saveBackupMode(v)}
                      className={`flex-1 text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                        backupMode === v
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f5f5f5]'
                      }`}
                    >
                      <p className="font-medium">{label}</p>
                      <p className="text-[11px] mt-0.5 opacity-70">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Horário / Dia — visível apenas quando schedule não é desabilitado */}
            {backupSchedule !== 'desabilitado' && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-[#a0a0a0]">Agendamento</p>
                <div className="flex flex-wrap gap-3 items-end">
                  {backupSchedule === 'semanal' && (
                    <div>
                      <p className="text-[11px] text-[#505050] mb-1.5">Dia da semana</p>
                      <select
                        value={backupDow}
                        onChange={e => saveBackupDow(Number(e.target.value))}
                        className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm"
                      >
                        {(['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'] as const)
                          .map((label, i) => <option key={i} value={i}>{label}</option>)}
                      </select>
                    </div>
                  )}
                  {backupSchedule === 'mensal' && (
                    <div>
                      <p className="text-[11px] text-[#505050] mb-1.5">Dia do mês</p>
                      <select
                        value={backupDom}
                        onChange={e => saveBackupDom(Number(e.target.value))}
                        className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>Dia {d}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-[#505050] mb-1.5">Horário</p>
                    <input
                      type="time"
                      value={backupTime}
                      onChange={e => setBackupTime(e.target.value)}
                      onBlur={e  => saveBackupTime(e.target.value)}
                      className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm [color-scheme:dark]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#505050] leading-relaxed">
                  O backup é executado ao abrir o sistema, se as condições de
                  {backupSchedule === 'diario'  && ' horário forem atendidas.'}
                  {backupSchedule === 'semanal' && ' dia da semana e horário forem atendidas.'}
                  {backupSchedule === 'mensal'  && ' dia do mês e horário forem atendidas.'}
                </p>
              </div>
            )}

            {/* Status */}
            {lastAutoBackup && (
              <p className="text-xs text-[#505050]">
                Último backup: {new Date(lastAutoBackup).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
          </div>

          {/* Exportar */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="font-semibold text-[#f5f5f5] mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400" /> Exportar Backup Manual
            </h3>
            <p className="text-xs text-[#505050] mb-4">
              Exporta todos os dados do sistema (clientes, contratos, processos, lançamentos, avisos) em formato JSON.
            </p>
            <button
              onClick={exportarBackup}
              disabled={backupBaixando}
              className="flex items-center gap-2 px-6 py-3 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backupBaixando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</>
                : <><Download className="w-4 h-4" /> Baixar Backup JSON</>
              }
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

          {/* ── Zona de Perigo (somente admin) ── */}
          {isAdmin && (
            <div className="bg-[#141414] border border-red-500/20 rounded-xl p-5">
              <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Zona de Perigo
              </h3>
              <p className="text-xs text-[#505050] mb-4 leading-relaxed">
                Remove <strong className="text-red-400">permanentemente</strong> todos os clientes,
                contratos, processos, lançamentos, avisos e log de auditoria.
                Usuários, configurações do escritório e licença são mantidos.
                Esta ação <strong className="text-red-400">não pode ser desfeita</strong>.
              </p>
              <button
                onClick={() => openConfirm(
                  'Zerar Banco de Dados',
                  'Isso apagará PERMANENTEMENTE todos os clientes, contratos, processos, lançamentos e avisos. Usuários e configurações do escritório serão mantidos. Não é possível desfazer.',
                  'Zerar Banco',
                  async () => {
                    [
                      'msk_clientes', 'msk_contratos', 'msk_processos',
                      'msk_lancamentos', 'msk_avisos', 'msk_auditoria',
                      'msk_perfis', 'msk_permissions',
                    ].forEach(k => localStorage.removeItem(k));
                    window.location.reload();
                  },
                )}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Zerar Banco de Dados
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Permissões (admin only) ──────────────────────── */}
      {tab === 'permissoes' && isAdmin && (
        <div className="space-y-5">
          {loadingPerms ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-amber-500" /></div>
          ) : (
            <>
              {/* Acesso por perfil */}
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" /> Acesso por Perfil
                  </h3>
                  <button
                    onClick={salvarPermissions}
                    disabled={savingPerms}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {savingPerms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </div>
                <p className="text-xs text-[#505050] mb-5">
                  Defina quais módulos cada perfil pode acessar. O perfil Admin tem acesso total por padrão.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className="text-left px-3 py-2.5 text-xs text-[#505050] font-medium uppercase">Módulo</th>
                        {['admin', 'advogado', 'assistente'].map(role => (
                          <th key={role} className="px-3 py-2.5 text-xs text-[#505050] font-medium uppercase text-center">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${roleBadge[role]}`}>{role}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MODULES.map(mod => (
                        <tr key={mod.key} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#1a1a1a] transition-colors">
                          <td className="px-3 py-2.5 text-[#f5f5f5] font-medium">{mod.label}</td>
                          {['admin', 'advogado', 'assistente'].map(role => {
                            const checked = (permissions[role] ?? []).includes(mod.key);
                            return (
                              <td key={role} className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => role !== 'admin' && togglePerm(role, mod.key)}
                                  disabled={role === 'admin'}
                                  title={role === 'admin' ? 'Admin sempre tem acesso total' : ''}
                                  className={`transition-all ${role === 'admin' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                >
                                  {checked
                                    ? <ToggleRight className={`w-6 h-6 mx-auto ${role === 'admin' ? 'text-amber-500' : 'text-green-400'}`} />
                                    : <ToggleLeft className="w-6 h-6 mx-auto text-[#3a3a3a]" />
                                  }
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Perfis personalizados */}
              <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#f5f5f5] flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" /> Perfis Personalizados
                  </h3>
                  <button
                    onClick={() => setNovoPerfilForm({ nome: '', descricao: '', modulos: [] })}
                    className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-all"
                  >
                    <Plus className="w-4 h-4" /> Novo Perfil
                  </button>
                </div>
                <p className="text-xs text-[#505050] mb-4">
                  Crie perfis customizados com conjuntos específicos de módulos.
                </p>

                {perfis.length === 0 ? (
                  <div className="text-center py-8 text-[#505050] text-sm">
                    Nenhum perfil personalizado criado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {perfis.map(p => (
                      <div key={p.id} className="flex items-start gap-3 p-4 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-[#f5f5f5]">{p.nome}</span>
                            {p.descricao && <span className="text-xs text-[#505050]">— {p.descricao}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {p.modulos.map(m => {
                              const mod = ALL_MODULES.find(x => x.key === m);
                              return (
                                <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                  {mod?.label ?? m}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setEditandoPerfil(p); setEditPerfilForm({ nome: p.nome, descricao: p.descricao, modulos: p.modulos }); }}
                            className="p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removerPerfil(p)}
                            className="p-1.5 text-[#505050] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline form: Novo perfil */}
                {novoPerfilForm && (
                  <div className="mt-4 p-4 bg-[#1a1a1a] rounded-xl border border-amber-500/20 space-y-3">
                    <p className="text-sm font-semibold text-[#f5f5f5]">Novo Perfil</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Nome *</label>
                        <input className={inputClass} value={novoPerfilForm.nome} onChange={e => setNovoPerfilForm(p => p ? ({ ...p, nome: e.target.value }) : null)} placeholder="ex: Estagiário" />
                      </div>
                      <div>
                        <label className={labelClass}>Descrição</label>
                        <input className={inputClass} value={novoPerfilForm.descricao} onChange={e => setNovoPerfilForm(p => p ? ({ ...p, descricao: e.target.value }) : null)} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Módulos</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_MODULES.map(mod => {
                          const checked = novoPerfilForm.modulos.includes(mod.key);
                          return (
                            <button
                              key={mod.key}
                              type="button"
                              onClick={() => setNovoPerfilForm(p => p ? ({ ...p, modulos: checked ? p.modulos.filter(m => m !== mod.key) : [...p.modulos, mod.key] }) : null)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${checked ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#505050] hover:text-[#a0a0a0]'}`}
                            >
                              {mod.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setNovoPerfilForm(null)} className="px-4 py-2 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">Cancelar</button>
                      <button type="button" onClick={criarPerfil} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium">Criar</button>
                    </div>
                  </div>
                )}

                {/* Inline form: Editar perfil */}
                {editandoPerfil && (
                  <div className="mt-4 p-4 bg-[#1a1a1a] rounded-xl border border-blue-500/20 space-y-3">
                    <p className="text-sm font-semibold text-[#f5f5f5]">Editar — {editandoPerfil.nome}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Nome *</label>
                        <input className={inputClass} value={editPerfilForm.nome} onChange={e => setEditPerfilForm(p => ({ ...p, nome: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelClass}>Descrição</label>
                        <input className={inputClass} value={editPerfilForm.descricao} onChange={e => setEditPerfilForm(p => ({ ...p, descricao: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Módulos</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_MODULES.map(mod => {
                          const checked = editPerfilForm.modulos.includes(mod.key);
                          return (
                            <button
                              key={mod.key}
                              type="button"
                              onClick={() => setEditPerfilForm(p => ({ ...p, modulos: checked ? p.modulos.filter(m => m !== mod.key) : [...p.modulos, mod.key] }))}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${checked ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#505050] hover:text-[#a0a0a0]'}`}
                            >
                              {mod.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditandoPerfil(null)} className="px-4 py-2 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">Cancelar</button>
                      <button type="button" onClick={salvarEditarPerfil} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-sm font-medium">Salvar</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Auditoria ──────────────────────────────────── */}
      {tab === 'auditoria' && (() => {
        // Preview: count how many entries would be removed
        const limpezaPreview = auditorias.filter(e => {
          const t = e.criadoEm;
          if (limpezaModo === 'tudo') return true;
          if (limpezaModo === 'antes') {
            return limpezaFim ? t <= limpezaFim + 'T23:59:59Z' : false;
          }
          // periodo
          const from = limpezaInicio ? limpezaInicio + 'T00:00:00Z' : undefined;
          const to   = limpezaFim    ? limpezaFim    + 'T23:59:59Z' : undefined;
          if (from && t < from) return false;
          if (to   && t > to  ) return false;
          return true;
        }).length;

        async function executarLimpeza() {
          if (limpezaModo !== 'tudo' && !limpezaFim && !limpezaInicio) {
            showToast('warning', 'Informe pelo menos uma data de referência');
            return;
          }
          setLimpezaLoading(true);
          try {
            let removed = 0;
            if (limpezaModo === 'tudo') {
              removed = await auditoriaApi.limparTudo();
            } else if (limpezaModo === 'antes') {
              const to = limpezaFim ? limpezaFim + 'T23:59:59.999Z' : undefined;
              removed = await auditoriaApi.limpar(undefined, to);
            } else {
              const from = limpezaInicio ? limpezaInicio + 'T00:00:00.000Z' : undefined;
              const to   = limpezaFim    ? limpezaFim    + 'T23:59:59.999Z' : undefined;
              removed = await auditoriaApi.limpar(from, to);
            }
            await loadAuditoria();
            setLimpezaInicio('');
            setLimpezaFim('');
            showToast('success', `${removed} registro${removed !== 1 ? 's' : ''} removido${removed !== 1 ? 's' : ''} do log`);
          } catch {
            showToast('error', 'Erro ao limpar auditoria');
          } finally {
            setLimpezaLoading(false);
          }
        }

        return (
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
            {/* ── Filtros ── */}
            {!loadingAuditoria && auditorias.length > 0 && (
              <div className="px-5 py-3 border-b border-[#2a2a2a] space-y-2.5">
                {/* Linha 1: período + horário */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#505050] shrink-0">De</span>
                    <input
                      type="date"
                      value={auditFiltroDataInicio}
                      onChange={e => setAuditFiltroDataInicio(e.target.value)}
                      className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#f5f5f5] text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#505050] shrink-0">até</span>
                    <input
                      type="date"
                      value={auditFiltroDataFim}
                      onChange={e => setAuditFiltroDataFim(e.target.value)}
                      className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#f5f5f5] text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[11px] text-[#505050] shrink-0">Das</span>
                    <input
                      type="time"
                      value={auditFiltroHoraInicio}
                      onChange={e => setAuditFiltroHoraInicio(e.target.value)}
                      className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#f5f5f5] text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#505050] shrink-0">às</span>
                    <input
                      type="time"
                      value={auditFiltroHoraFim}
                      onChange={e => setAuditFiltroHoraFim(e.target.value)}
                      className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#f5f5f5] text-xs [color-scheme:dark]"
                    />
                  </div>
                </div>
                {/* Linha 2: ação + usuário + limpar */}
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={auditFiltroAcao}
                    onChange={e => setAuditFiltroAcao(e.target.value)}
                    className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#a0a0a0] text-xs"
                  >
                    <option value="">Todas as ações</option>
                    {auditAcoes.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={auditFiltroUsuario}
                    onChange={e => setAuditFiltroUsuario(e.target.value)}
                    className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[#a0a0a0] text-xs"
                  >
                    <option value="">Todos os usuários</option>
                    {auditUsuarios.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {(auditFiltroAcao || auditFiltroUsuario || auditFiltroDataInicio || auditFiltroDataFim || auditFiltroHoraInicio || auditFiltroHoraFim) && (
                    <button
                      onClick={limparFiltrosAuditoria}
                      className="px-3 py-1.5 text-xs text-[#505050] hover:text-[#a0a0a0] border border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#1e1e1e] rounded-lg transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                  <span className="ml-auto text-[11px] text-[#505050] tabular-nums">
                    {auditFiltered.length === auditorias.length
                      ? `${auditorias.length} registro${auditorias.length !== 1 ? 's' : ''}`
                      : `${auditFiltered.length} de ${auditorias.length} registros`
                    }
                  </span>
                </div>
              </div>
            )}

            {loadingAuditoria ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : auditorias.length === 0 ? (
              <p className="text-center py-8 text-[#505050] text-sm">Nenhum registro de auditoria encontrado</p>
            ) : auditFiltered.length === 0 ? (
              <p className="text-center py-8 text-[#505050] text-sm">Nenhum resultado com os filtros aplicados</p>
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
                    {auditFiltered.map(a => (
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

          {/* ── Limpeza do Log ── */}
          {isAdmin && (
            <div className="bg-[#141414] border border-orange-500/20 rounded-xl p-5">
              <h3 className="font-semibold text-orange-400 mb-1 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Limpeza do Log
              </h3>
              <p className="text-xs text-[#505050] mb-4 leading-relaxed">
                Remove entradas do log de auditoria de forma permanente e irreversível.
                Use para reduzir o tamanho do armazenamento ou apagar dados antigos.
              </p>

              {/* Modo */}
              <div className="flex flex-wrap gap-2 mb-4">
                {([
                  { key: 'antes',   label: 'Anteriores a uma data' },
                  { key: 'periodo', label: 'Em um período'         },
                  { key: 'tudo',    label: 'Tudo'                  },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    onClick={() => { setLimpezaModo(m.key); setLimpezaInicio(''); setLimpezaFim(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      limpezaModo === m.key
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                        : 'bg-[#1e1e1e] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f5f5f5]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Date inputs */}
              {limpezaModo !== 'tudo' && (
                <div className="flex flex-wrap gap-3 mb-4 items-center">
                  {limpezaModo === 'periodo' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#505050]">De</span>
                      <input
                        type="date"
                        value={limpezaInicio}
                        onChange={e => setLimpezaInicio(e.target.value)}
                        className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm [color-scheme:dark]"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#505050]">
                      {limpezaModo === 'antes' ? 'Anteriores a' : 'até'}
                    </span>
                    <input
                      type="date"
                      value={limpezaFim}
                      onChange={e => setLimpezaFim(e.target.value)}
                      className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm [color-scheme:dark]"
                    />
                  </div>
                </div>
              )}

              {/* Preview + action */}
              <div className="flex items-center gap-4">
                {auditorias.length > 0 && (
                  <p className="text-xs text-[#505050]">
                    {limpezaPreview === 0
                      ? 'Nenhum registro seria removido'
                      : <span>
                          Serão removidos{' '}
                          <strong className="text-orange-400">{limpezaPreview}</strong>
                          {' '}de {auditorias.length} registro{auditorias.length !== 1 ? 's' : ''}
                        </span>
                    }
                  </p>
                )}
                <button
                  onClick={() => openConfirm(
                    'Limpar Log de Auditoria',
                    limpezaModo === 'tudo'
                      ? `Isso removerá permanentemente todos os ${auditorias.length} registros do log. Não é possível desfazer.`
                      : `Isso removerá permanentemente ${limpezaPreview} registro${limpezaPreview !== 1 ? 's' : ''} do log. Não é possível desfazer.`,
                    'Limpar',
                    executarLimpeza,
                  )}
                  disabled={limpezaLoading || limpezaPreview === 0}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {limpezaLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Limpando…</>
                    : <><Trash2 className="w-4 h-4" /> Limpar {limpezaPreview > 0 ? `(${limpezaPreview})` : ''}</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })()}

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
