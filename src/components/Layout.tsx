import React, { useState, useEffect, useRef } from 'react';
import {
  Scale, LayoutDashboard, Users, FileText, Gavel, DollarSign,
  AlertTriangle, Bell, Settings, LogOut, Menu, X, ChevronRight,
  UserCircle, TrendingDown, Calendar, Search, BarChart2,
} from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { useAuth } from '../context/AuthContext';
import { avisosApi } from '../services/api';
import NotificacoesPanel from './NotificacoesPanel';

export type PageKey =
  | 'dashboard'
  | 'clientes'
  | 'contratos'
  | 'processos'
  | 'honorarios'
  | 'agenda'
  | 'inadimplencia'
  | 'avisos'
  | 'relatorios'
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
  { key: 'agenda',        label: 'Agenda',         icon: Calendar },
  { key: 'inadimplencia', label: 'Inadimplência',  icon: TrendingDown },
  { key: 'avisos',        label: 'Avisos',         icon: AlertTriangle },
  { key: 'relatorios',   label: 'Relatórios',     icon: BarChart2 },
  { key: 'configuracoes', label: 'Configurações',  icon: Settings },
];

interface LayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

const EASING   = 'cubic-bezier(0.4, 0, 0.2, 1)';
const DURATION = '200ms';
const PILL_H   = 24; // px — height of the sliding active indicator

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen,        setNotifOpen]        = useState(false);
  const [naoLidos,         setNaoLidos]         = useState(0);

  // Sliding indicator
  const navRef      = useRef<HTMLElement>(null);
  const mainRef     = useRef<HTMLElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const [searchOpen,   setSearchOpen]   = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>('[data-active="true"]');
    if (!btn) return;
    setIndicatorTop(btn.offsetTop + Math.round((btn.offsetHeight - PILL_H) / 2));
  }, [currentPage]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentPage]);

  // Ctrl+K / Cmd+K → abre busca global
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    avisosApi.getAll()
      .then(data => setNaoLidos(data.filter(a => !a.lido).length))
      .catch(() => {});
    const interval = setInterval(() => {
      avisosApi.getAll()
        .then(data => setNaoLidos(data.filter(a => !a.lido).length))
        .catch(() => {});
    }, 120_000);
    return () => clearInterval(interval);
  }, []);

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

  const EXPANDED_W  = 256;
  const COLLAPSED_W = 64;

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
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          bg-[#141414] border-r border-[#2a2a2a]
          flex flex-col shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        style={{
          width: sidebarCollapsed ? `${COLLAPSED_W}px` : `${EXPANDED_W}px`,
          transition: `width ${DURATION} ${EASING}, transform ${DURATION} ${EASING}`,
          willChange: 'width',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-5 border-b border-[#2a2a2a] overflow-hidden shrink-0"
          style={{ minHeight: '72px' }}
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <Scale className="w-5 h-5 text-white" />
          </div>

          {/* Animated title */}
          <div
            className="overflow-hidden whitespace-nowrap"
            style={{
              maxWidth: sidebarCollapsed ? '0' : `${EXPANDED_W}px`,
              opacity: sidebarCollapsed ? 0 : 1,
              // max-width snaps instantly; only opacity is animated
              transition: sidebarCollapsed
                ? 'opacity 80ms ease, max-width 0ms 80ms'
                : 'opacity 100ms 140ms ease, max-width 0ms 0ms',
              flex: '1 1 0%',
            }}
          >
            <p className="font-playfair text-sm font-bold text-[#f5f5f5] leading-tight">MSK Gestor</p>
            <p className="text-[10px] text-[#a0a0a0] leading-tight">Sistema Jurídico</p>
          </div>

          {/* Mobile close */}
          <button
            className="ml-auto lg:hidden text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav
          ref={navRef as React.RefObject<HTMLElement>}
          className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden space-y-0.5 relative"
        >
          {/* Sliding active indicator pill */}
          {indicatorTop !== null && (
            <div
              className="absolute left-0 w-[3px] rounded-r-full bg-amber-400 pointer-events-none z-10"
              style={{
                top: `${indicatorTop}px`,
                height: `${PILL_H}px`,
                opacity: sidebarCollapsed ? 0 : 1,
                transition: `top 200ms ${EASING}, opacity 150ms ease`,
              }}
            />
          )}

          {NAV_ITEMS.map(item => {
            const Icon  = item.icon;
            const active = currentPage === item.key;
            return (
              <button
                key={item.key}
                data-active={active ? 'true' : 'false'}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => { onNavigate(item.key); setSidebarOpen(false); }}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'transition-colors duration-150 group relative border',
                  active
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-[#a0a0a0] hover:text-white hover:bg-white/5 border-transparent',
                ].join(' ')}
                style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
              >
                {/* Icon */}
                <span className="relative shrink-0">
                  <Icon
                    className={[
                      'w-4 h-4 transition-all duration-200',
                      active
                        ? 'text-amber-400 scale-110'
                        : 'text-[#505050] group-hover:text-[#a0a0a0] group-hover:scale-105',
                    ].join(' ')}
                  />
                  {sidebarCollapsed && item.key === 'avisos' && naoLidos > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </span>

                {/* Animated label + badge */}
                <span
                  className="overflow-hidden whitespace-nowrap flex items-center gap-2 shrink-0"
                  style={{
                    maxWidth:      sidebarCollapsed ? '0' : '200px',
                    opacity:       sidebarCollapsed ? 0 : 1,
                    transition:    sidebarCollapsed
                      ? 'opacity 80ms ease, max-width 0ms 80ms'
                      : 'opacity 100ms 140ms ease, max-width 0ms 0ms',
                    pointerEvents: sidebarCollapsed ? 'none' : 'auto',
                  }}
                >
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === 'avisos' && naoLidos > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                      {naoLidos > 9 ? '9+' : naoLidos}
                    </span>
                  )}
                </span>

                {/* Hover tooltip — desktop collapsed only */}
                {sidebarCollapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#252525] border border-[#333] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg hidden lg:flex items-center gap-2">
                    {item.label}
                    {item.key === 'avisos' && naoLidos > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
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
        <div className="border-t border-[#2a2a2a] px-2 py-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-[#1e1e1e]">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 flex items-center justify-center shrink-0"
              title={sidebarCollapsed ? user?.nome : undefined}
            >
              <UserCircle className="w-5 h-5 text-amber-400" />
            </div>

            {/* Animated name / role */}
            <div
              className="overflow-hidden whitespace-nowrap min-w-0"
              style={{
                maxWidth:   sidebarCollapsed ? '0' : '160px',
                opacity:    sidebarCollapsed ? 0 : 1,
                transition: sidebarCollapsed
                  ? 'opacity 80ms ease, max-width 0ms 80ms'
                  : 'opacity 100ms 140ms ease, max-width 0ms 0ms',
                flex: '1 1 0%',
              }}
            >
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
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[#505050] hover:text-amber-400 hover:bg-white/5 transition-colors overflow-hidden"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {/* Single chevron that rotates — points right when collapsed, left when expanded */}
            <ChevronRight
              className="w-4 h-4 shrink-0 transition-transform duration-200"
              style={{ transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
            />
            <span
              className="text-xs whitespace-nowrap overflow-hidden"
              style={{
                maxWidth:   sidebarCollapsed ? '0' : '80px',
                opacity:    sidebarCollapsed ? 0 : 1,
                transition: sidebarCollapsed
                  ? 'opacity 80ms ease, max-width 0ms 80ms'
                  : 'opacity 100ms 140ms ease, max-width 0ms 0ms',
              }}
            >
              Recolher
            </span>
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
            {/* Busca global */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 rounded-lg text-[#505050] hover:text-[#a0a0a0] text-xs transition-colors"
              title="Busca global (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar</span>
              <kbd className="ml-1 px-1 py-0.5 bg-[#2a2a2a] rounded text-[10px] font-mono">⌘K</kbd>
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="sm:hidden text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
              title="Busca global"
            >
              <Search className="w-5 h-5" />
            </button>

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

        {/* Content — page-enter triggers a quick fade+slide on every navigation */}
        <main ref={mainRef as React.RefObject<HTMLElement>} className="flex-1 overflow-y-auto bg-[#0a0a0a] p-5">
          <div key={currentPage} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Notificações panel */}
      <NotificacoesPanel open={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={onNavigate} />

      {/* Busca global */}
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(page) => { onNavigate(page); setSearchOpen(false); }}
      />
    </div>
  );
}
