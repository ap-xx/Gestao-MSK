import React from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const moduleLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  clientes: 'Clientes',
  contratos: 'Contratos',
  processos: 'Processos',
  honorarios: 'Honorários',
  inadimplencia: 'Inadimplência',
  avisos: 'Avisos & Prazos',
  configuracoes: 'Configurações',
};

const moduleDescriptions: Record<string, string> = {
  dashboard: 'Visão geral do escritório',
  clientes: 'Gestão de clientes e dados cadastrais',
  contratos: 'Contratos de honorários',
  processos: 'Processos judiciais em andamento',
  honorarios: 'Lançamentos financeiros',
  inadimplencia: 'Clientes com pendências financeiras',
  avisos: 'Prazos processuais e audiências',
  configuracoes: 'Configurações do escritório',
};

export default function Header() {
  const {
    activeModule,
    notificationPanelOpen,
    setNotificationPanelOpen,
    unreadAvisosCount,
    sidebarCollapsed,
    setSidebarCollapsed,
    escritorio,
  } = useApp();

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b shrink-0"
      style={{
        background: '#0a0a0a',
        borderColor: '#1e1e1e',
        minHeight: '72px',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            {moduleLabels[activeModule]}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{moduleDescriptions[activeModule]}</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Date */}
        <div className="hidden md:block text-xs text-gray-500 capitalize">
          {today}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-6 bg-white/10" />

        {/* Notification bell */}
        <button
          onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
          className="relative p-2.5 rounded-xl transition-all duration-200 hover:bg-white/5"
          style={notificationPanelOpen ? { background: 'rgba(217,119,6,0.15)' } : undefined}
        >
          <Bell
            size={20}
            className={unreadAvisosCount > 0 ? 'text-amber-400' : 'text-gray-400'}
          />
          {unreadAvisosCount > 0 && (
            <span
              className="badge-pulse absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: '#ef4444', fontSize: '10px' }}
            >
              {unreadAvisosCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-dark-900"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}
          >
            {escritorio.responsavel.replace('Dr. ', '').charAt(0)}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold text-white leading-tight">
              {escritorio.responsavel}
            </p>
            <p className="text-xs text-gray-500">{escritorio.oab}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
