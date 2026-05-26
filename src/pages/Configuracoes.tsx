import React, { useState } from 'react';
import {
  Building2, User, Bell, Save, Loader2, MapPin,
  Mail, Phone, Globe, Shield,
} from 'lucide-react';
import { EscritoriooDB, UsersDB } from '../data/db';
import { consultarCNPJ, consultarCEP, formatCNPJ, formatCEP, formatTelefone } from '../services/apis';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import type { Escritorio } from '../types';

type Tab = 'escritorio' | 'responsavel' | 'notificacoes';

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

export default function Configuracoes() {
  const { showToast } = useToast();
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<Tab>('escritorio');
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [saving, setSaving] = useState(false);

  const initial = EscritoriooDB.get() || {} as Escritorio;

  const [escritorio, setEscritorio] = useState<Escritorio>(initial || {
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
  });

  const [userForm, setUserForm] = useState({
    nome: user?.nome || '',
    email: user?.email || '',
    oab: user?.oab || '',
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: '',
  });

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
    await new Promise(r => setTimeout(r, 500)); // simula delay
    EscritoriooDB.save(escritorio);
    setSaving(false);
    showToast('success', 'Dados do escritório salvos!');
  }

  async function salvarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));

    if (userForm.novaSenha) {
      if (!user || user.senha !== userForm.senhaAtual) {
        showToast('error', 'Senha atual incorreta');
        setSaving(false);
        return;
      }
      if (userForm.novaSenha !== userForm.confirmarSenha) {
        showToast('error', 'Senhas não conferem');
        setSaving(false);
        return;
      }
      UsersDB.update(user.id, { nome: userForm.nome, email: userForm.email, oab: userForm.oab, senha: userForm.novaSenha });
    } else {
      UsersDB.update(user!.id, { nome: userForm.nome, email: userForm.email, oab: userForm.oab });
    }
    updateUser({ nome: userForm.nome, email: userForm.email, oab: userForm.oab });
    setSaving(false);
    showToast('success', 'Perfil atualizado!');
  }

  async function salvarNotificacoes(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    EscritoriooDB.save(escritorio);
    setSaving(false);
    showToast('success', 'Preferências de notificação salvas!');
  }

  const inputClass = "w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors";
  const labelClass = "block text-xs font-medium text-[#a0a0a0] mb-1.5";

  const tabs: Array<{ key: Tab; label: string; icon: any }> = [
    { key: 'escritorio', label: 'Dados do Escritório', icon: Building2 },
    { key: 'responsavel', label: 'OAB & Responsável', icon: User },
    { key: 'notificacoes', label: 'Notificações', icon: Bell },
  ];

  return (
    <div className="space-y-5 animate-fade-in-up max-w-3xl">
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Configurações</h1>
        <p className="text-[#a0a0a0] text-sm">Personalize o sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2a2a2a]">
        {tabs.map(t => (
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
                    onBlur={buscarCEP}
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

              {/* Prazo de antecedência */}
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
    </div>
  );
}
