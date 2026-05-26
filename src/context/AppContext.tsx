import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Cliente, Contrato, Processo, Honorario, Aviso, Escritorio, ModuleKey
} from '../types';
import {
  mockClientes, mockContratos, mockProcessos,
  mockHonorarios, mockAvisos, mockEscritorio
} from '../data/mockData';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  // Navigation
  activeModule: ModuleKey;
  setActiveModule: (m: ModuleKey) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (v: boolean) => void;

  // Data
  clientes: Cliente[];
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  contratos: Contrato[];
  setContratos: React.Dispatch<React.SetStateAction<Contrato[]>>;
  processos: Processo[];
  setProcessos: React.Dispatch<React.SetStateAction<Processo[]>>;
  honorarios: Honorario[];
  setHonorarios: React.Dispatch<React.SetStateAction<Honorario[]>>;
  avisos: Aviso[];
  setAvisos: React.Dispatch<React.SetStateAction<Aviso[]>>;
  escritorio: Escritorio;
  setEscritorio: React.Dispatch<React.SetStateAction<Escritorio>>;

  // Toast
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Computed
  unreadAvisosCount: number;
  inadimplenteCount: number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>(mockClientes);
  const [contratos, setContratos] = useState<Contrato[]>(mockContratos);
  const [processos, setProcessos] = useState<Processo[]>(mockProcessos);
  const [honorarios, setHonorarios] = useState<Honorario[]>(mockHonorarios);
  const [avisos, setAvisos] = useState<Aviso[]>(mockAvisos);
  const [escritorio, setEscritorio] = useState<Escritorio>(mockEscritorio);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const unreadAvisosCount = avisos.filter(a => !a.lido && a.status === 'Pendente').length;
  const inadimplenteCount = clientes.filter(c => c.status === 'Inadimplente').length;

  return (
    <AppContext.Provider value={{
      activeModule, setActiveModule,
      sidebarCollapsed, setSidebarCollapsed,
      notificationPanelOpen, setNotificationPanelOpen,
      clientes, setClientes,
      contratos, setContratos,
      processos, setProcessos,
      honorarios, setHonorarios,
      avisos, setAvisos,
      escritorio, setEscritorio,
      toasts, addToast, removeToast,
      unreadAvisosCount, inadimplenteCount,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
