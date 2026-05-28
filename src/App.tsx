import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { initializeDatabase, LicenseDB } from './data/db';
import { generateLicenseKey, validateLicenseKey } from './utils/license';
import Login from './pages/Login';
import LicenseGate from './components/LicenseGate';

// ── Bootstrap ─────────────────────────────────────────────────
// Check for existing user data BEFORE seeding so we can distinguish
// a returning machine from a brand-new one.
const _hadData      = !!localStorage.getItem('msk_users');
// If this machine ever saw the LicenseGate it's NOT a legacy machine —
// it's a new install where initializeDatabase() seeded msk_users on
// the first visit, causing a false-positive on every subsequent visit.
const _gateShown    = !!localStorage.getItem('msk_gate_shown');

// Seed localStorage with initial data if this is a fresh browser
initializeDatabase();

// Auto-license ONLY machines that had real pre-existing data AND never
// saw the LicenseGate (i.e. were running before the license system was
// introduced). New machines will see the gate, which sets msk_gate_shown.
if (!LicenseDB.get() && _hadData && !_gateShown) {
  LicenseDB.set({
    machineId:   LicenseDB.getMachineId(),
    machineName: 'PC Registrado',
    licenseKey:  generateLicenseKey(),
    activatedAt: new Date().toISOString(),
    lastLogin:   new Date().toISOString(),
    loginCount:  0,
  });
}
// ──────────────────────────────────────────────────────────────

import Layout, { type PageKey } from './components/Layout';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useRecorrencia } from './hooks/useRecorrencia';
import Dashboard     from './pages/Dashboard';
import Clientes      from './pages/Clientes';
import Contratos     from './pages/Contratos';
import Processos     from './pages/Processos';
import Honorarios    from './pages/Honorarios';
import Inadimplencia from './pages/Inadimplencia';
import Avisos        from './pages/Avisos';
import Agenda        from './pages/Agenda';
import Configuracoes from './pages/Configuracoes';
import Relatorios    from './pages/Relatorios';
import Licencas      from './pages/Licencas';
import Documentos    from './pages/Documentos';
import { useState, useEffect } from 'react';
import { canAccessPage } from './utils/permissions';

/** Roda o hook de backup + recorrência apenas quando o usuário está autenticado. */
function AutoBackupChecker() {
  useAutoBackup();
  useRecorrencia();
  return null;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  // Redirect to dashboard if the user's role doesn't allow the current page
  useEffect(() => {
    if (user && !canAccessPage(user.role, currentPage)) {
      setCurrentPage('dashboard');
    }
  }, [user?.role, currentPage]);

  // License check — shown before login if no valid license in localStorage
  const [licensed, setLicensed] = useState<boolean>(
    () => validateLicenseKey(LicenseDB.get()?.licenseKey ?? '')
  );

  if (!licensed) {
    return <LicenseGate onActivated={() => setLicensed(true)} />;
  }

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
    licencas:      <Licencas />,
    documentos:    <Documentos />,
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <AutoBackupChecker />
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
