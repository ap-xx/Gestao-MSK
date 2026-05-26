import React, { useState } from 'react';
import {
  Scale, LayoutDashboard, Users, FileText, Gavel, DollarSign,
  AlertTriangle, Bell, Settings, LogOut, Menu, X, ChevronRight,
  UserCircle, TrendingDown,
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
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'contratos', label: 'Contratos', icon: FileText },
  { key: 'processos', label: 'Processos', icon: Gavel },
  { key: 'honorarios', label: 'Honorários', icon: DollarSign },
  { key: 'inadimplencia', label: 'Inadimplência', icon: TrendingDown },
  { key: 'avisos', label: 'Avisos', icon: AlertTriangle },
  { key: 'configuracoes', label: 'Configurações', icon: Settings },
];

interface LayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const naoLidos = AvisosDB.getNaoLidos().length;

  const roleColors: Record<string, string> = {
    admin: 'text-amber-400',
    advogado: 'text-blue-400',
    assistente: 'text-green-400',
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    advogado: 'Advogado(a)',
    assistente: 'Assistente',
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#141414] border-r border-[#2a2a2a] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#2a2a2a]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-playfair text-sm font-bold text-[#f5f5f5] leading-tight">MSK Consultation</h1>
            <p className="text-[10px] text-[#a0a0a0] leading-tight">Sistema Jurídico</p>
          </div>
          <button
            className="ml-auto lg:hidden text-[#a0a0a0] hover:text-[#f5f5f5]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  active
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    : 'text-[#a0a0a0] hover:bg-[#1e1e1e] hover:text-[#f5f5f5]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-[#505050] group-hover:text-[#a0a0a0]'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === 'avisos' && naoLidos > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {naoLidos > 9 ? '9+' : naoLidos}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 text-amber-400" />}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-[#2a2a2a] px-3 py-4">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-[#1e1e1e]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#f5f5f5] truncate">{user?.nome.split(' ')[0]} {user?.nome.split(' ')[1]}</p>
              <p className={`text-[10px] ${roleColors[user?.role || 'assistente']}`}>
                {roleLabels[user?.role || 'assistente']}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="text-[#505050] hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-[#141414] border-b border-[#2a2a2a] px-5 py-3 flex items-center gap-3 shrink-0">
          <button
            className="lg:hidden text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb / título */}
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[#f5f5f5]">
              {NAV_ITEMS.find(n => n.key === currentPage)?.label}
            </h2>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Notificações */}
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

            {/* Avatar */}
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

      {/* Painel Notificações */}
      <NotificacoesPanel open={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={onNavigate} />
    </div>
  );
}
