import React, { useState } from 'react';
import { Building2, Shield, Bell, Save, User, Globe, Phone, Mail, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';

type Tab = 'escritorio' | 'oab' | 'notificacoes';

export default function Configuracoes() {
  const { escritorio, setEscritorio, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('escritorio');
  const [form, setForm] = useState(escritorio);

  const handleSave = () => {
    setEscritorio(form);
    addToast('Configurações salvas com sucesso!', 'success');
  };

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'escritorio', label: 'Dados do Escritório', icon: <Building2 size={16} /> },
    { key: 'oab', label: 'OAB & Responsável', icon: <Shield size={16} /> },
    { key: 'notificacoes', label: 'Notificações', icon: <Bell size={16} /> },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl"
        style={{ background: '#141414', border: '1px solid #2e2e2e' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200
              ${activeTab === tab.key ? 'text-dark-900' : 'text-gray-500 hover:text-white'}`}
            style={activeTab === tab.key ? {
              background: 'linear-gradient(135deg, #d97706, #f59e0b)',
            } : undefined}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 rounded-2xl border"
        style={{ background: '#141414', borderColor: '#2e2e2e' }}>

        {activeTab === 'escritorio' && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-4"
                style={{ fontFamily: 'Playfair Display, serif' }}>
                Informações do Escritório
              </h3>

              {/* Logo / name area */}
              <div className="flex items-center gap-4 p-4 rounded-xl mb-6"
                style={{ background: '#1e1e1e' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-dark-900 text-2xl"
                  style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
                  M
                </div>
                <div>
                  <p className="text-lg font-bold text-white msk-logo">{form.nome}</p>
                  <p className="text-sm" style={{ color: '#d97706' }}>{form.oab}</p>
                  <p className="text-xs text-gray-500">{form.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input label="Nome do Escritório" value={form.nome} onChange={f('nome')} />
                </div>
                <Input label="CNPJ" value={form.cnpj} onChange={f('cnpj')} className="font-mono" />
                <Input label="Telefone" value={form.telefone} onChange={f('telefone')} />
                <Input label="E-mail Principal" type="email" value={form.email} onChange={f('email')} />
                <Input label="Site" value={form.site || ''} onChange={f('site')} placeholder="www.escritorio.com.br" />
                <div className="sm:col-span-2">
                  <Input label="Endereço" value={form.endereco} onChange={f('endereco')} />
                </div>
                <Input label="Cidade" value={form.cidade} onChange={f('cidade')} />
                <Input label="Estado" value={form.estado} onChange={f('estado')} />
                <Input label="CEP" value={form.cep} onChange={f('cep')} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'oab' && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-4"
                style={{ fontFamily: 'Playfair Display, serif' }}>
                OAB & Responsável
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Inscrição OAB" value={form.oab} onChange={f('oab')}
                  placeholder="OAB/SP 000.000" className="font-mono" />
                <Input label="Advogado Responsável" value={form.responsavel} onChange={f('responsavel')}
                  placeholder="Dr. Nome Sobrenome" />
              </div>

              <div className="mt-6 p-4 rounded-xl border"
                style={{ borderColor: '#2e2e2e', background: '#1e1e1e' }}>
                <h4 className="text-sm font-semibold text-white mb-3">Assinatura de E-mail</h4>
                <Textarea
                  label="Assinatura padrão"
                  value={form.assinaturaEmail || ''}
                  onChange={f('assinaturaEmail')}
                  rows={4}
                  placeholder="MSK Consultation — Advocacia & Consultoria Jurídica&#10;OAB/SP 000.000&#10;(11) 0000-0000"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Esta assinatura será utilizada nas notificações automáticas enviadas por e-mail.
                </p>
              </div>

              {/* Áreas de atuação */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-white mb-3">Áreas de Atuação</h4>
                <div className="flex flex-wrap gap-2">
                  {['Trabalhista', 'Civil', 'Empresarial', 'Tributário', 'Família', 'Criminal', 'Previdenciário'].map(area => (
                    <span key={area}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border"
                      style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.2)' }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notificacoes' && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-4"
                style={{ fontFamily: 'Playfair Display, serif' }}>
                Configurações de Notificação
              </h3>

              <div className="flex flex-col gap-4">
                {/* Toggle items */}
                {[
                  {
                    key: 'notificacoesEmail' as const,
                    icon: <Mail size={18} />,
                    label: 'Notificações por E-mail',
                    desc: 'Receber alertas de prazos e audiências por e-mail',
                  },
                  {
                    key: 'notificacoesWhatsapp' as const,
                    icon: <Phone size={18} />,
                    label: 'Notificações por WhatsApp',
                    desc: 'Receber alertas via WhatsApp Business',
                  },
                ].map(item => (
                  <div key={item.key}
                    className="flex items-center justify-between p-4 rounded-xl border"
                    style={{ background: '#1e1e1e', borderColor: '#2e2e2e' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className={`relative w-12 h-6 rounded-full transition-all duration-200`}
                      style={{
                        background: form[item.key]
                          ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                          : '#2e2e2e',
                      }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                        style={{ transform: form[item.key] ? 'translateX(24px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                ))}

                {/* Days before */}
                <div className="p-4 rounded-xl border" style={{ background: '#1e1e1e', borderColor: '#2e2e2e' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                      <Bell size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Antecipação de Avisos</p>
                      <p className="text-xs text-gray-500">Quantos dias antes notificar sobre prazos e audiências</p>
                    </div>
                  </div>
                  <Select
                    label=""
                    value={String(form.diasAntecipaAviso)}
                    onChange={e => setForm(p => ({ ...p, diasAntecipaAviso: Number(e.target.value) }))}
                    options={[
                      { value: '1', label: '1 dia de antecedência' },
                      { value: '3', label: '3 dias de antecedência' },
                      { value: '5', label: '5 dias de antecedência' },
                      { value: '7', label: '7 dias de antecedência' },
                      { value: '10', label: '10 dias de antecedência' },
                      { value: '15', label: '15 dias de antecedência' },
                    ]}
                  />
                </div>

                {/* Info box */}
                <div className="p-4 rounded-xl border"
                  style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                  <p className="text-xs text-amber-400 font-medium mb-1">Sistema de notificações local</p>
                  <p className="text-xs text-gray-500">
                    Por ser uma aplicação local, as notificações são exibidas dentro do sistema.
                    Integrações externas (e-mail, WhatsApp) requerem configuração de servidor SMTP/API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 mt-4 border-t" style={{ borderColor: '#2e2e2e' }}>
          <Button icon={<Save size={16} />} onClick={handleSave}>
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
