import React, { useState } from 'react';
import {
  Scale, LayoutDashboard, Users, FileText, Gavel, DollarSign,
  AlertTriangle, Bell, Settings, LogOut, Menu, X, ChevronRight,
  ChevronLeft, UserCircle, TrendingDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AvisosDB } from '../data/db';
import NotificacoesPanel from './NotificacoesPanel';

export type PageKey =
  | 'dashboard'
  | 'clientes'
  | 'contratos'
  | 'processos'
  | 'honorarios'
  | 'inadimplencia'
  | 'avisos'
  | 'configuracoes';

interface NavItem {
  key: PageKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { key: 'clientes',      label: 'Clientes',       icon: Users },
  { key: 'contratos',     label: 'Contratos',      icon: FileText },
  { key: 'processos',     label: 'Processos',      icon: Gavel },
  { key: 'honorarios',    label: 'Honorários',     icon: DollarSign },
  { key: 'inadimplencia', label: 'Inadimplência',  icon: TrendingDown },
  { key: 'avisos',        label: 'Avisos',         icon: AlertTriangle },
  { key: 'configuracoes', label: 'Configurações',  icon: Settings },
];

interface LayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen]             = useState(false);

  const naoLidos = AvisosDB.getNaoLidos().length;

  const roleColors: Record<string, string> = {
    admin:      'text-amber-400',
    advogado:   'text-blue-400',
    assistente: 'text-green-400',
  };
  const roleLabels: Record<string, string> = {
    admin:      'Administrador',
    advogado:   'Advogado(a)',
    assistente: 'Assistente',
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        style={{ width: sidebarCollapsed ? undefined : undefined }}
        className={[
          'fixed lg:static inset-y-0 left-0 z-30',
          'bg-[#141414] border-r border-[#2a2a2a]',
          'flex flex-col shrink-0',
          'transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'w-64 lg:w-[68px]' : 'w-64',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#2a2a2a] overflow-hidden min-h-[72px]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-white" />
          </div>

          {/* Title text — hidden on desktop when collapsed */}
          <div className={`flex-1 overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <h1 className="font-playfair text-sm font-bold text-[#f5f5f5] leading-tight whitespace-nowrap">
              MSK Consultation
            </h1>
            <p className="text-[10px] text-[#a0a0a0] leading-tight whitespace-nowrap">
              Sistema Jurídico
            </p>
          </div>

          {/* Mobile close button */}
          <button
            className={`ml-auto lg:hidden text-[#a0a0a0] hover:text-[#f5f5f5] shrink-0 ${sidebarCollapsed ? 'hidden' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                className={[
                  'w-full flex items-center gap-3 rounded-xl text-sm font-medium',
                  'transition-colors duration-150 group relative',
                  sidebarCollapsed
                    ? 'lg:justify-center lg:px-2 px-3 py-2.5'
                    : 'px-3 py-2.5',
                  active
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-white/5 border border-transparent',
                ].join(' ')}
              >
                {/* Icon */}
                <span className="relative shrink-0">
                  <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-[#505050] group-hover:text-[#a0a0a0]'}`} />
                  {/* Red dot on icon when collapsed + avisos badge */}
                  {sidebarCollapsed && item.key === 'avisos' && naoLidos > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full hidden lg:block" />
                  )}
                </span>

                {/* Label row — hidden on desktop when collapsed */}
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.key === 'avisos' && naoLidos > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shrink-0">
                        {naoLidos > 9 ? '9+' : naoLidos}
                      </span>
                    )}
                    {active && <ChevronRight className="w-3 h-3 text-amber-400 shrink-0" />}
                  </>
                )}

                {/* Label row on mobile when collapsed (sidebarCollapsed=true but mobile shows full) */}
                {sidebarCollapsed && (
                  <span className="flex-1 text-left truncate lg:hidden">{item.label}</span>
                )}

                {/* Tooltip on desktop collapsed */}
                {sidebarCollapsed && (
                  <span className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#2a2a2a] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 hidden lg:block shadow-lg">
                    {item.label}
                    {item.key === 'avisos' && naoLidos > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1">
                        {naoLidos}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-[#2a2a2a] px-2 py-3">
          <div
            className={`flex items-center gap-3 px-2 py-2 rounded-lg bg-[#1e1e1e] ${
              sidebarCollapsed ? 'lg:flex-col lg:gap-2 lg:px-1 lg:py-2' : ''
            }`}
            title={sidebarCollapsed ? user?.nome : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-amber-400" />
            </div>
            {/* Name / role — hidden on desktop when collapsed */}
            <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-xs font-medium text-[#f5f5f5] truncate">
                {user?.nome.split(' ')[0]} {user?.nome.split(' ')[1]}
              </p>
              <p className={`text-[10px] ${roleColors[user?.role || 'assistente']}`}>
                {roleLabels[user?.role || 'assistente']}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="text-[#505050] hover:text-red-400 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapse toggle — desktop only */}
        <div className="border-t border-[#2a2a2a] p-2 hidden lg:block shrink-0">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="w-full flex items-center justify-center py-2 rounded-lg text-[#505050] hover:text-amber-400 hover:bg-white/5 transition-colors"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <span className="flex items-center gap-2 text-xs">
                <ChevronLeft className="w-4 h-4" />
                Recolher
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="bg-[#141414] border-b border-[#2a2a2a] px-5 py-3 flex items-center gap-3 shrink-0">
          <button
            className="lg:hidden text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[#f5f5f5]">
              {NAV_ITEMS.find(n => n.key === currentPage)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setNotifOpen(true)}
              className="relative text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
            >
              <Bell className="w-5 h-5" />
              {naoLidos > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                  {naoLidos > 9 ? '9+' : naoLidos}
                </span>
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] p-5">
          {children}
        </main>
      </div>

      {/* Notificações panel */}
      <NotificacoesPanel open={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={onNavigate} />
    </div>
  );
}
