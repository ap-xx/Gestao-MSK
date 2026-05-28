import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { initializeDatabase } from './data/db';
import Login from './pages/Login';

// Seed localStorage with initial data if this is a fresh browser
initializeDatabase();
import Layout, { type PageKey } from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Contratos from './pages/Contratos';
import Processos from './pages/Processos';
import Honorarios from './pages/Honorarios';
import Inadimplencia from './pages/Inadimplencia';
import Avisos from './pages/Avisos';
import Agenda from './pages/Agenda';
import Configuracoes from './pages/Configuracoes';
import Relatorios from './pages/Relatorios';
import { useState } from 'react';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-[#a0a0a0] text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const pages: Record<PageKey, React.ReactNode> = {
    dashboard:     <Dashboard />,
    clientes:      <Clientes />,
    contratos:     <Contratos />,
    processos:     <Processos />,
    honorarios:    <Honorarios />,
    agenda:        <Agenda />,
    inadimplencia: <Inadimplencia />,
    avisos:        <Avisos />,
    relatorios:    <Relatorios />,
    configuracoes: <Configuracoes />,
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pages[currentPage]}
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
