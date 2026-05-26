import React from 'react';
import {
  LayoutDashboard, Users, FileText, Scale, DollarSign,
  AlertTriangle, Bell, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModuleKey } from '../../types';

const navItems: { key: ModuleKey; label: string; icon: React.ReactNode; badgeKey?: 'avisos' | 'inadimplencia' }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { key: 'clientes', label: 'Clientes', icon: <Users size={20} /> },
  { key: 'contratos', label: 'Contratos', icon: <FileText size={20} /> },
  { key: 'processos', label: 'Processos', icon: <Scale size={20} /> },
  { key: 'honorarios', label: 'Honorários', icon: <DollarSign size={20} /> },
  { key: 'inadimplencia', label: 'Inadimplência', icon: <AlertTriangle size={20} />, badgeKey: 'inadimplencia' },
  { key: 'avisos', label: 'Avisos', icon: <Bell size={20} />, badgeKey: 'avisos' },
  { key: 'configuracoes', label: 'Configurações', icon: <Settings size={20} /> },
];

export default function Sidebar() {
  const { activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed, unreadAvisosCount, inadimplenteCount } = useApp();

  const getBadgeCount = (key?: 'avisos' | 'inadimplencia') => {
    if (key === 'avisos') return unreadAvisosCount;
    if (key === 'inadimplencia') return inadimplenteCount;
    return 0;
  };

  return (
    <aside
      className={`sidebar-transition flex flex-col shrink-0 h-screen border-r z-30 relative`}
      style={{
        width: sidebarCollapsed ? '70px' : '260px',
        background: '#0f0f0f',
        borderColor: '#1e1e1e',
      }}
    >
      {/* Logo */}
      <div className="flex items-center px-4 py-5 border-b shrink-0"
        style={{ borderColor: '#1e1e1e', minHeight: '72px' }}>
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Logo mark */}
          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-dark-900 text-sm"
            style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
            M
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="msk-logo text-sm font-bold text-white whitespace-nowrap leading-tight">
                MSK Consultation
              </p>
              <p className="text-xs whitespace-nowrap" style={{ color: '#d97706' }}>
                Advocacia & Jurídico
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1 px-2">
          {navItems.map(item => {
            const isActive = activeModule === item.key;
            const badge = getBadgeCount(item.badgeKey);
            return (
              <li key={item.key}>
                <button
                  onClick={() => setActiveModule(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 relative group border-l-2
                    ${isActive
                      ? 'text-amber-400 bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-amber-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent'
                    }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  )}
                  {badge > 0 && (
                    <span
                      className={`badge-pulse shrink-0 min-w-[20px] h-5 rounded-full flex items-center justify-center text-xs font-bold
                        ${sidebarCollapsed ? 'absolute top-1 right-1 min-w-[16px] h-4 text-[10px]' : ''}
                      `}
                      style={{
                        background: badge > 0 ? '#ef4444' : '#d97706',
                        color: 'white',
                        fontSize: sidebarCollapsed ? '9px' : '11px',
                      }}
                    >
                      {badge}
                    </span>
                  )}
                  {/* Tooltip for collapsed */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-dark-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                      style={{ background: '#2e2e2e' }}>
                      {item.label}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse button */}
      <div className="p-2 border-t shrink-0" style={{ borderColor: '#1e1e1e' }}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-white/5 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : (
            <span className="flex items-center gap-2 text-xs">
              <ChevronLeft size={16} />
              Recolher
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
